-- Central caller-scoped predicate used by RLS and read-only RPC boundaries.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select auth.uid() is not null
    and not exists (
      select 1 from public.account_deletion_requests request
      where request.user_id = auth.uid()
    );
$$;
revoke all on function private.is_active_account() from public, anon, authenticated;
grant execute on function private.is_active_account() to authenticated;

-- Direct reads across every private table stop returning rows once pending.
drop policy profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()) and (select private.is_active_account()));
drop policy lists_select_own on public.lists;
create policy lists_select_own on public.lists
  for select to authenticated using (owner_id = (select auth.uid()) and (select private.is_active_account()));
drop policy concepts_select_own on public.concepts;
create policy concepts_select_own on public.concepts
  for select to authenticated using (
    (select private.is_active_account()) and exists (
      select 1 from public.lists l where l.id = concepts.list_id and l.owner_id = (select auth.uid())
    )
  );
drop policy rounds_select_own on public.rounds;
create policy rounds_select_own on public.rounds
  for select to authenticated using (
    (select private.is_active_account()) and exists (
      select 1 from public.lists l where l.id = rounds.list_id and l.owner_id = (select auth.uid())
    )
  );
drop policy round_appearances_select_own on public.round_appearances;
create policy round_appearances_select_own on public.round_appearances
  for select to authenticated using (
    (select private.is_active_account()) and exists (
      select 1 from public.rounds r join public.lists l on l.id = r.list_id
      where r.id = round_appearances.round_id and l.owner_id = (select auth.uid())
    )
  );
drop policy practices_select_own on public.practices;
create policy practices_select_own on public.practices
  for select to authenticated using (owner_id = (select auth.uid()) and (select private.is_active_account()));
drop policy practice_notes_select_own on public.practice_notes;
create policy practice_notes_select_own on public.practice_notes
  for select to authenticated using (
    (select private.is_active_account()) and exists (
      select 1 from public.practices p where p.id = practice_notes.practice_id
        and p.owner_id = (select auth.uid())
    )
  );
drop policy practice_note_operations_select_own on public.practice_note_operations;
create policy practice_note_operations_select_own on public.practice_note_operations
  for select to authenticated using (owner_id = (select auth.uid()) and (select private.is_active_account()));

-- Keep the established query contracts while placing a pending check before
-- every definer-backed read, whose owner bypasses RLS internally.
alter function public.list_owned_lists(text, text, text, text, timestamptz, timestamptz, uuid, integer)
  rename to list_owned_lists_before_account_guard;
revoke all on function public.list_owned_lists_before_account_guard(text, text, text, text, timestamptz, timestamptz, uuid, integer)
  from public, anon, authenticated;
create function public.list_owned_lists(
  p_collection text, p_search text default null, p_sort text default 'name_asc',
  p_cursor_name text default null, p_cursor_created_at timestamptz default null,
  p_cursor_updated_at timestamptz default null, p_cursor_id uuid default null, p_page_size integer default 51
) returns table (id uuid, owner_id uuid, name text, name_normalized text,
  created_at timestamptz, updated_at timestamptz, archived_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return; end if;
  return query select * from public.list_owned_lists_before_account_guard(
    p_collection, p_search, p_sort, p_cursor_name, p_cursor_created_at,
    p_cursor_updated_at, p_cursor_id, p_page_size);
end; $$;
revoke all on function public.list_owned_lists(text, text, text, text, timestamptz, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.list_owned_lists(text, text, text, text, timestamptz, timestamptz, uuid, integer) to authenticated;

alter function public.get_current_round_readonly(uuid) rename to get_current_round_readonly_before_account_guard;
revoke all on function public.get_current_round_readonly_before_account_guard(uuid) from public, anon, authenticated;
create function public.get_current_round_readonly(p_list_id uuid) returns setof public.rounds
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return; end if;
  return query select * from public.get_current_round_readonly_before_account_guard(p_list_id);
end; $$;
revoke all on function public.get_current_round_readonly(uuid) from public, anon, authenticated;
grant execute on function public.get_current_round_readonly(uuid) to authenticated;

-- This established get-or-create RPC is also used as a round read. Deny its
-- result while pending; T03 separately guards the remaining mutation RPCs.
alter function public.get_or_create_current_round(uuid)
  rename to get_or_create_current_round_before_account_guard;
revoke all on function public.get_or_create_current_round_before_account_guard(uuid) from public, anon, authenticated;
create function public.get_or_create_current_round(p_list_id uuid) returns public.rounds
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return null; end if;
  return public.get_or_create_current_round_before_account_guard(p_list_id);
end; $$;
revoke all on function public.get_or_create_current_round(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_current_round(uuid) to authenticated;

alter function public.get_saved_practice(uuid) rename to get_saved_practice_before_account_guard;
revoke all on function public.get_saved_practice_before_account_guard(uuid) from public, anon, authenticated;
create function public.get_saved_practice(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return null; end if;
  return public.get_saved_practice_before_account_guard(p_id);
end; $$;
revoke all on function public.get_saved_practice(uuid) from public, anon, authenticated;
grant execute on function public.get_saved_practice(uuid) to authenticated;

alter function public.list_practice_history(timestamptz, timestamptz, uuid, uuid, text, text, text, timestamptz, uuid, integer, text)
  rename to list_practice_history_before_account_guard;
revoke all on function public.list_practice_history_before_account_guard(timestamptz, timestamptz, uuid, uuid, text, text, text, timestamptz, uuid, integer, text)
  from public, anon, authenticated;
create function public.list_practice_history(
  p_from timestamptz default null, p_to_exclusive timestamptz default null,
  p_list_id uuid default null, p_concept_id uuid default null,
  p_independent_label text default null, p_kind text default null,
  p_rating_state text default null, p_cursor_completed_at timestamptz default null,
  p_cursor_id uuid default null, p_page_size integer default 50, p_direction text default 'newest'
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return jsonb_build_object('items', '[]'::jsonb, 'has_more', false, 'next_cursor', null); end if;
  return public.list_practice_history_before_account_guard(
    p_from, p_to_exclusive, p_list_id, p_concept_id, p_independent_label, p_kind,
    p_rating_state, p_cursor_completed_at, p_cursor_id, p_page_size, p_direction);
end; $$;
revoke all on function public.list_practice_history(timestamptz, timestamptz, uuid, uuid, text, text, text, timestamptz, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.list_practice_history(timestamptz, timestamptz, uuid, uuid, text, text, text, timestamptz, uuid, integer, text) to authenticated;

alter function public.list_round_history(uuid, timestamptz, uuid, integer, text)
  rename to list_round_history_before_account_guard;
revoke all on function public.list_round_history_before_account_guard(uuid, timestamptz, uuid, integer, text) from public, anon, authenticated;
create function public.list_round_history(
  p_list_id uuid default null, p_cursor_opened_at timestamptz default null,
  p_cursor_id uuid default null, p_page_size integer default 50, p_direction text default 'newest'
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return jsonb_build_object('items', '[]'::jsonb, 'has_more', false, 'next_cursor', null); end if;
  return public.list_round_history_before_account_guard(p_list_id, p_cursor_opened_at, p_cursor_id, p_page_size, p_direction);
end; $$;
revoke all on function public.list_round_history(uuid, timestamptz, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.list_round_history(uuid, timestamptz, uuid, integer, text) to authenticated;

alter function public.list_round_appearances(uuid[]) rename to list_round_appearances_before_account_guard;
revoke all on function public.list_round_appearances_before_account_guard(uuid[]) from public, anon, authenticated;
create function public.list_round_appearances(p_round_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
begin
  if not private.is_active_account() then return '[]'::jsonb; end if;
  return public.list_round_appearances_before_account_guard(p_round_ids);
end; $$;
revoke all on function public.list_round_appearances(uuid[]) from public, anon, authenticated;
grant execute on function public.list_round_appearances(uuid[]) to authenticated;
