-- StudyMate 0009: cross-entity global search.

-- Subjects were the one searchable table without an index; add it for parity.
alter table public.subjects add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(instructor, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index subjects_search_idx on public.subjects using gin (search_tsv);

-- search_all is deliberately SECURITY INVOKER (the default): it runs as the
-- caller, so the RLS policies from 0007 scope every branch of the union to that
-- user automatically. Making this DEFINER would silently expose every student's
-- data through one RPC.
--
-- websearch_to_tsquery is used rather than to_tsquery because it accepts raw
-- human input -- quotes, OR, leading punctuation -- without ever raising a
-- syntax error on text a student actually typed.
create or replace function public.search_all(
  q          text,
  p_types    text[] default null,
  p_subject_id uuid default null,
  p_limit    integer default 40
)
returns table (
  entity_type text,
  id          uuid,
  title       text,
  snippet     text,
  subject_id  uuid,
  rank        real,
  occurred_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with parsed as (
    select websearch_to_tsquery('english', q) as tsq
  ),
  hits as (
    select 'subject'::text, s.id, s.name,
           coalesce(s.description, s.instructor, s.code, ''),
           s.id, ts_rank(s.search_tsv, p.tsq), s.updated_at
    from public.subjects s, parsed p
    where s.search_tsv @@ p.tsq

    union all
    select 'note', n.id, nullif(n.title, ''),
           left(n.content_text, 240), n.subject_id,
           ts_rank(n.search_tsv, p.tsq), n.updated_at
    from public.notes n, parsed p
    where n.search_tsv @@ p.tsq and n.archived_at is null

    union all
    select 'resource', r.id, r.title,
           coalesce(r.description, r.file_name, r.external_url, ''),
           r.subject_id, ts_rank(r.search_tsv, p.tsq), r.updated_at
    from public.resources r, parsed p
    where r.search_tsv @@ p.tsq

    union all
    select 'task', t.id, t.title,
           coalesce(t.description, ''), t.subject_id,
           ts_rank(t.search_tsv, p.tsq), t.updated_at
    from public.tasks t, parsed p
    where t.search_tsv @@ p.tsq

    union all
    -- Transcripts are searchable in their own right (section 45).
    select 'voice_note', v.id, v.title,
           left(coalesce(v.transcript, ''), 240), v.subject_id,
           ts_rank(v.search_tsv, p.tsq), v.updated_at
    from public.voice_notes v, parsed p
    where v.search_tsv @@ p.tsq
  )
  select *
  from hits as h(entity_type, id, title, snippet, subject_id, rank, occurred_at)
  where (p_types is null or h.entity_type = any(p_types))
    and (p_subject_id is null or h.subject_id = p_subject_id)
    and nullif(trim(q), '') is not null
  order by h.rank desc, h.occurred_at desc
  limit least(coalesce(p_limit, 40), 100);
$$;

comment on function public.search_all is
  'Cross-entity search scoped to the caller by RLS. Filters: types, subject.';

revoke all on function public.search_all(text, text[], uuid, integer) from public, anon;
grant execute on function public.search_all(text, text[], uuid, integer) to authenticated;
