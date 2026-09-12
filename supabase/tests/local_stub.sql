-- Minimal stand-ins for the Supabase-managed schemas, so the StudyMate
-- migrations and their test suites can run against a plain PostgreSQL server.
--
-- Purpose: prove the migrations in supabase/migrations/ apply CLEANLY FROM
-- SCRATCH, IN ORDER. Applying them incrementally to a live project (which is
-- how they were authored) does not prove that -- a later migration can depend
-- on state an earlier one never created. This is what a new contributor or a CI
-- run actually does.
--
-- Only the surface the migrations touch is reproduced:
--   auth.uid(), auth.users, storage.foldername(), storage.objects,
--   storage.buckets, and the anon / authenticated / service_role roles.
--
-- This file is for local verification only. It is never applied to a Supabase
-- project, where the real versions of these objects already exist.

-- ---------------------------------------------------------------- roles
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ---------------------------------------------------------------- schemas
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

grant usage on schema public     to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase grants table privileges to these roles by default; RLS is what
-- actually gates access. Reproduce that, or every policy would be untestable
-- because the role could not reach the table at all.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;

-- gen_random_uuid() is built into PostgreSQL 13+, but crypt()/gen_salt() come
-- from pgcrypto. The test fixtures use both, so make them reachable unqualified.
grant execute on all functions in schema extensions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  instance_id        uuid,
  aud                text,
  role               text,
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  identity_data   jsonb not null,
  provider        text not null,
  provider_id     text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (provider, provider_id)
);

/*
 * Mirrors Supabase's auth.uid(): the caller's id read out of the request JWT
 * claims GUC. Tests impersonate a user by setting request.jwt.claims, which is
 * exactly how PostgREST passes identity through.
 *
 * Returns null when unset, so an unauthenticated caller matches no RLS policy.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'role', ''),
    'anon'
  );
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- ---------------------------------------------------------------- storage
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);

-- Storage policies are the security boundary for uploaded files, so RLS must be
-- on here too or migration 0008's policies would be inert in the test.
alter table storage.objects enable row level security;

/*
 * Splits an object key into its path segments, 1-indexed, dropping the final
 * filename -- matching Supabase's storage.foldername().
 *
 *   storage.foldername('users/abc/notes/x.pdf') -> {users, abc, notes}
 *
 * Migration 0008 pins segment 1 to 'users' and segment 2 to auth.uid(), which is
 * what makes each bucket a set of private per-user trees.
 */
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;
