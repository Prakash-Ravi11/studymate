-- StudyMate 0004: resources + notes
-- Tags are text[] + GIN rather than a join table: they are only ever filtered
-- and searched, never joined to attributes of their own.

-- ---------------------------------------------------------------- resources
create table public.resources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Nullable: a resource may be captured before the student files it.
  subject_id    uuid references public.subjects(id) on delete set null,
  title         text not null check (length(trim(title)) between 1 and 300),
  description   text check (description is null or length(description) <= 2000),
  resource_type public.resource_type not null default 'other',

  -- Storage-backed fields (null for link resources)
  file_path     text,
  file_name     text,
  file_size     bigint check (file_size is null or file_size >= 0),
  mime_type     text,

  -- Link resources
  external_url  text check (external_url is null or external_url ~* '^https?://'),

  thumbnail_path text,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A resource is either a stored file or an external link. Enforcing this here
  -- means no client bug can create a row that renders as neither.
  constraint resources_has_payload
    check (file_path is not null or external_url is not null),
  -- Storage rows must carry the metadata the UI needs to render a file card.
  constraint resources_file_metadata_complete
    check (file_path is null or (file_name is not null and mime_type is not null))
);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

create index resources_user_idx    on public.resources (user_id, created_at desc);
create index resources_subject_idx on public.resources (subject_id, created_at desc)
  where subject_id is not null;
create index resources_type_idx    on public.resources (user_id, resource_type);
create index resources_tags_idx    on public.resources using gin (tags);

-- One storage object maps to exactly one resource row, so a retried upload can
-- never leave two rows pointing at the same file.
create unique index resources_file_path_key on public.resources (file_path)
  where file_path is not null;

alter table public.resources add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(file_name, '')), 'C') ||
    setweight(to_tsvector('english', public.tags_to_text(tags)), 'C')
  ) stored;

create index resources_search_idx on public.resources using gin (search_tsv);

-- ---------------------------------------------------------------- notes
create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title      text not null default '' check (length(title) <= 300),
  -- Rich text stored as sanitised HTML produced by the editor.
  content    text not null default '',
  note_type  public.note_type not null default 'quick',
  tags       text[] not null default '{}',
  is_pinned   boolean not null default false,
  is_favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Plain-text mirror for search snippets and list previews. Derived in the
-- database from content so a buggy client cannot desynchronise it.
alter table public.notes add column content_text text
  generated always as (
    regexp_replace(coalesce(content, ''), '<[^>]*>', ' ', 'g')
  ) stored;

alter table public.notes add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english',
      regexp_replace(coalesce(content, ''), '<[^>]*>', ' ', 'g')), 'B') ||
    setweight(to_tsvector('english', public.tags_to_text(tags)), 'C')
  ) stored;

create index notes_user_idx    on public.notes (user_id, updated_at desc);
create index notes_subject_idx on public.notes (subject_id, updated_at desc)
  where subject_id is not null;
create index notes_pinned_idx  on public.notes (user_id, updated_at desc)
  where is_pinned and archived_at is null;
create index notes_tags_idx    on public.notes using gin (tags);
create index notes_search_idx  on public.notes using gin (search_tsv);

-- Attachments let a note carry files without duplicating resource metadata.
create table public.note_attachments (
  note_id     uuid not null references public.notes(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (note_id, resource_id)
);

create index note_attachments_resource_idx on public.note_attachments (resource_id);
create index note_attachments_user_idx     on public.note_attachments (user_id);
