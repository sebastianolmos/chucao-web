-- Shared fail-closed guard for trusted private mutations. Status/retry lifecycle
-- calls intentionally do not use this function.
create or replace function private.assert_active_account()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'account_not_authenticated';
  end if;
  if not private.is_active_account() then
    raise exception using errcode = '55000', message = 'account_deletion_pending';
  end if;
end;
$$;
revoke all on function private.assert_active_account() from public, anon, authenticated;
grant execute on function private.assert_active_account() to authenticated;

-- Direct preference writes use this policy; all other browser table writes are
-- already revoked and must use their trusted RPC.
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_account()))
  with check (id = (select auth.uid()) and (select private.is_active_account()));

-- The common list lock is used by rename, concept, round, and associated
-- practice mutation RPCs. Check lifecycle before attempting any row lookup.
create or replace function public.lock_active_owned_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_archived_at timestamptz;
begin
  perform private.assert_active_account();
  select l.archived_at into v_archived_at
  from public.lists as l
  where l.id = p_list_id and l.owner_id = auth.uid()
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'list_not_owned';
  end if;
  if v_archived_at is not null then
    raise exception using errcode = '55000', message = 'list_archived_read_only';
  end if;
end;
$$;
revoke all on function public.lock_active_owned_list(uuid) from public, anon, authenticated;

-- Keep each public RPC contract stable while placing the account guard before
-- its existing implementation. Internal delegates are no longer client-callable.
alter function public.ensure_profile() rename to ensure_profile_before_account_guard;
revoke all on function public.ensure_profile_before_account_guard() from public, anon, authenticated;
create function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  return public.ensure_profile_before_account_guard();
end; $$;
revoke all on function public.ensure_profile() from public, anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;

alter function public.create_private_list(text) rename to create_private_list_before_account_guard;
revoke all on function public.create_private_list_before_account_guard(text) from public, anon, authenticated;
create function public.create_private_list(p_name text) returns public.lists
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  return public.create_private_list_before_account_guard(p_name);
end; $$;
revoke all on function public.create_private_list(text) from public, anon, authenticated;
grant execute on function public.create_private_list(text) to authenticated;

alter function public.archive_private_list(uuid) rename to archive_private_list_before_account_guard;
revoke all on function public.archive_private_list_before_account_guard(uuid) from public, anon, authenticated;
create function public.archive_private_list(p_list_id uuid) returns public.lists
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  return public.archive_private_list_before_account_guard(p_list_id);
end; $$;
revoke all on function public.archive_private_list(uuid) from public, anon, authenticated;
grant execute on function public.archive_private_list(uuid) to authenticated;

alter function public.restore_private_list(uuid) rename to restore_private_list_before_account_guard;
revoke all on function public.restore_private_list_before_account_guard(uuid) from public, anon, authenticated;
create function public.restore_private_list(p_list_id uuid) returns public.lists
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  return public.restore_private_list_before_account_guard(p_list_id);
end; $$;
revoke all on function public.restore_private_list(uuid) from public, anon, authenticated;
grant execute on function public.restore_private_list(uuid) to authenticated;

alter function public.duplicate_private_list(uuid, uuid, text) rename to duplicate_private_list_before_account_guard;
revoke all on function public.duplicate_private_list_before_account_guard(uuid, uuid, text) from public, anon, authenticated;
create function public.duplicate_private_list(p_source_list_id uuid, p_operation_id uuid, p_name text)
returns public.lists language plpgsql security definer
set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  return public.duplicate_private_list_before_account_guard(p_source_list_id, p_operation_id, p_name);
end; $$;
revoke all on function public.duplicate_private_list(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.duplicate_private_list(uuid, uuid, text) to authenticated;

alter function public.delete_private_list(uuid) rename to delete_private_list_before_account_guard;
revoke all on function public.delete_private_list_before_account_guard(uuid) from public, anon, authenticated;
create function public.delete_private_list(p_list_id uuid) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  return public.delete_private_list_before_account_guard(p_list_id);
end; $$;
revoke all on function public.delete_private_list(uuid) from public, anon, authenticated;
grant execute on function public.delete_private_list(uuid) to authenticated;

-- These two concept wrappers only lock when a caller-owned row is found. Add
-- an unconditional lifecycle check so missing IDs cannot bypass the boundary.
create or replace function public.update_concept(
  p_concept_id uuid, p_title text, p_description text, p_expected_updated_at timestamptz
) returns public.concepts
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare v_list_id uuid;
begin
  perform private.assert_active_account();
  select c.list_id into v_list_id from public.concepts c
  join public.lists l on l.id = c.list_id
  where c.id = p_concept_id and l.owner_id = auth.uid();
  if found then perform public.lock_active_owned_list(v_list_id); end if;
  return public.update_concept_before_archived_guard(
    p_concept_id, p_title, p_description, p_expected_updated_at);
end; $$;

create or replace function public.delete_concept(p_concept_id uuid, p_expected_updated_at timestamptz)
returns public.concepts
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare v_list_id uuid;
begin
  perform private.assert_active_account();
  select c.list_id into v_list_id from public.concepts c
  join public.lists l on l.id = c.list_id
  where c.id = p_concept_id and l.owner_id = auth.uid();
  if found then perform public.lock_active_owned_list(v_list_id); end if;
  return public.delete_concept_before_archived_guard(p_concept_id, p_expected_updated_at);
end; $$;

-- Preserve active behavior for the mixed round RPC; while pending it raises
-- the same safe lifecycle error before invoking its mutating delegate.
create or replace function public.get_or_create_current_round(p_list_id uuid)
returns public.rounds
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
begin
  perform private.assert_active_account();
  perform public.lock_active_owned_list(p_list_id);
  return public.get_or_create_current_round_before_archived_guard(p_list_id);
end; $$;

alter function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  rename to save_completed_practice_before_account_guard;
revoke all on function public.save_completed_practice_before_account_guard(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  from public, anon, authenticated;
create function public.save_completed_practice(
  p_id uuid, p_kind text, p_list_id uuid, p_concept_id uuid, p_round_id uuid,
  p_appearance_id uuid, p_duration_minutes smallint, p_completed_at timestamptz,
  p_label text, p_note text, p_rating smallint
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions as $$
begin
  perform private.assert_active_account();
  if p_kind = 'associated' then perform public.lock_active_owned_list(p_list_id); end if;
  return public.save_completed_practice_before_account_guard(
    p_id, p_kind, p_list_id, p_concept_id, p_round_id, p_appearance_id,
    p_duration_minutes, p_completed_at, p_label, p_note, p_rating);
end; $$;
revoke all on function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  from public, anon, authenticated;
grant execute on function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  to authenticated;

alter function public.update_practice_note(uuid, uuid, bigint, text) rename to update_practice_note_before_account_guard;
revoke all on function public.update_practice_note_before_account_guard(uuid, uuid, bigint, text) from public, anon, authenticated;
create function public.update_practice_note(p_practice_id uuid, p_operation_id uuid, p_expected_revision bigint, p_body text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions as $$
begin
  perform private.assert_active_account();
  return public.update_practice_note_before_account_guard(p_practice_id, p_operation_id, p_expected_revision, p_body);
end; $$;
revoke all on function public.update_practice_note(uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.update_practice_note(uuid, uuid, bigint, text) to authenticated;

alter function public.delete_practice_note(uuid, uuid, bigint) rename to delete_practice_note_before_account_guard;
revoke all on function public.delete_practice_note_before_account_guard(uuid, uuid, bigint) from public, anon, authenticated;
create function public.delete_practice_note(p_practice_id uuid, p_operation_id uuid, p_expected_revision bigint)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions as $$
begin
  perform private.assert_active_account();
  return public.delete_practice_note_before_account_guard(p_practice_id, p_operation_id, p_expected_revision);
end; $$;
revoke all on function public.delete_practice_note(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.delete_practice_note(uuid, uuid, bigint) to authenticated;
