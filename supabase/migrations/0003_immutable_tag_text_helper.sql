-- StudyMate 0003: immutable text[] flattener for generated tsvector columns.
--
-- array_to_string(anyarray, text) is only STABLE, because for a polymorphic
-- element type its result depends on that type's output function, which is not
-- guaranteed immutable. Generated columns require IMMUTABLE expressions.
--
-- Narrowing the signature to text[] removes that uncertainty: textout is
-- immutable, so joining a text[] with a constant separator is genuinely
-- deterministic and the IMMUTABLE declaration below is honest, not a cheat.
create or replace function public.tags_to_text(tags text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_to_string(tags, ' '), '');
$$;

comment on function public.tags_to_text is
  'Immutable text[] -> text join, for use in generated tsvector columns.';
