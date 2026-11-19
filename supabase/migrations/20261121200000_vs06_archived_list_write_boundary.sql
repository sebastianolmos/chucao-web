-- Keep the established mutation implementations as private delegates. Public
-- RPC names become active-list guards so direct calls cannot bypass archive.
alter function public.rename_private_list(uuid, text) rename to rename_private_list_before_archived_guard;
alter function public.create_concept(uuid, text, text) rename to create_concept_before_archived_guard;
alter function public.create_concepts_batch(uuid, jsonb) rename to create_concepts_batch_before_archived_guard;
alter function public.update_concept(uuid, text, text, timestamptz) rename to update_concept_before_archived_guard;
alter function public.delete_concept(uuid, timestamptz) rename to delete_concept_before_archived_guard;
alter function public.get_or_create_current_round(uuid) rename to get_or_create_current_round_before_archived_guard;
alter function public.perform_round_operation(uuid, uuid, text, uuid) rename to perform_round_operation_before_archived_guard;
alter function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  rename to save_completed_practice_before_archived_guard;
alter function public.update_practice_note(uuid, uuid, bigint, text) rename to update_practice_note_before_archived_guard;
alter function public.delete_practice_note(uuid, uuid, bigint) rename to delete_practice_note_before_archived_guard;

revoke all on function public.rename_private_list_before_archived_guard(uuid, text) from public, anon, authenticated;
revoke all on function public.create_concept_before_archived_guard(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_concepts_batch_before_archived_guard(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_concept_before_archived_guard(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_concept_before_archived_guard(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.get_or_create_current_round_before_archived_guard(uuid) from public, anon, authenticated;
revoke all on function public.perform_round_operation_before_archived_guard(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.save_completed_practice_before_archived_guard(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  from public, anon, authenticated;
revoke all on function public.update_practice_note_before_archived_guard(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.delete_practice_note_before_archived_guard(uuid, uuid, bigint) from public, anon, authenticated;

create or replace function public.lock_active_owned_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;
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

create or replace function public.rename_private_list(p_list_id uuid, p_name text)
returns public.lists
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_exists boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;
  select true into v_profile_exists
  from public.profiles as p where p.id = v_user_id for update;
  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;
  perform public.lock_active_owned_list(p_list_id);
  return public.rename_private_list_before_archived_guard(p_list_id, p_name);
end;
$$;

create or replace function public.create_concept(p_list_id uuid, p_title text, p_description text default '')
returns public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.lock_active_owned_list(p_list_id);
  return public.create_concept_before_archived_guard(p_list_id, p_title, p_description);
end;
$$;

create or replace function public.create_concepts_batch(p_list_id uuid, p_items jsonb)
returns setof public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.lock_active_owned_list(p_list_id);
  return query select * from public.create_concepts_batch_before_archived_guard(p_list_id, p_items);
end;
$$;

create or replace function public.update_concept(
  p_concept_id uuid, p_title text, p_description text, p_expected_updated_at timestamptz
)
returns public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_list_id uuid;
begin
  select c.list_id into v_list_id
  from public.concepts as c
  join public.lists as l on l.id = c.list_id
  where c.id = p_concept_id and l.owner_id = auth.uid();
  if found then
    perform public.lock_active_owned_list(v_list_id);
  end if;
  return public.update_concept_before_archived_guard(
    p_concept_id, p_title, p_description, p_expected_updated_at
  );
end;
$$;

create or replace function public.delete_concept(p_concept_id uuid, p_expected_updated_at timestamptz)
returns public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_list_id uuid;
begin
  select c.list_id into v_list_id
  from public.concepts as c
  join public.lists as l on l.id = c.list_id
  where c.id = p_concept_id and l.owner_id = auth.uid();
  if found then
    perform public.lock_active_owned_list(v_list_id);
  end if;
  return public.delete_concept_before_archived_guard(p_concept_id, p_expected_updated_at);
end;
$$;

create or replace function public.get_or_create_current_round(p_list_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.lock_active_owned_list(p_list_id);
  return public.get_or_create_current_round_before_archived_guard(p_list_id);
end;
$$;

create or replace function public.perform_round_operation(
  p_list_id uuid, p_operation_id uuid, p_action text, p_concept_id uuid default null
)
returns table (
  action text, outcome text, round_id uuid, appearance_id uuid,
  appearance_order bigint, concept_id uuid, title text, result_state text,
  pending_count bigint, seen_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.lock_active_owned_list(p_list_id);
  return query select * from public.perform_round_operation_before_archived_guard(
    p_list_id, p_operation_id, p_action, p_concept_id
  );
end;
$$;

create or replace function public.get_current_round_readonly(p_list_id uuid)
returns setof public.rounds
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'round_not_authenticated';
  end if;
  if not exists (
    select 1 from public.lists as l where l.id = p_list_id and l.owner_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'round_unauthorized';
  end if;
  return query
  select r.* from public.rounds as r
  where r.list_id = p_list_id and r.status = 'open';
end;
$$;

create or replace function public.save_completed_practice(
  p_id uuid, p_kind text, p_list_id uuid, p_concept_id uuid, p_round_id uuid,
  p_appearance_id uuid, p_duration_minutes smallint, p_completed_at timestamptz,
  p_label text, p_note text, p_rating smallint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if p_kind = 'associated' then
    perform public.lock_active_owned_list(p_list_id);
  end if;
  return public.save_completed_practice_before_archived_guard(
    p_id, p_kind, p_list_id, p_concept_id, p_round_id, p_appearance_id,
    p_duration_minutes, p_completed_at, p_label, p_note, p_rating
  );
end;
$$;

create or replace function public.update_practice_note(
  p_practice_id uuid, p_operation_id uuid, p_expected_revision bigint, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_list_id uuid;
begin
  select p.list_id into v_list_id from public.practices as p
  where p.id = p_practice_id and p.owner_id = auth.uid();
  if found and v_list_id is not null then
    perform public.lock_active_owned_list(v_list_id);
  end if;
  return public.update_practice_note_before_archived_guard(
    p_practice_id, p_operation_id, p_expected_revision, p_body
  );
end;
$$;

create or replace function public.delete_practice_note(
  p_practice_id uuid, p_operation_id uuid, p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_list_id uuid;
begin
  select p.list_id into v_list_id from public.practices as p
  where p.id = p_practice_id and p.owner_id = auth.uid();
  if found and v_list_id is not null then
    perform public.lock_active_owned_list(v_list_id);
  end if;
  return public.delete_practice_note_before_archived_guard(
    p_practice_id, p_operation_id, p_expected_revision
  );
end;
$$;

revoke all on function public.rename_private_list(uuid, text) from public, anon, authenticated;
revoke all on function public.create_concept(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_concepts_batch(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_concept(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_concept(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.get_or_create_current_round(uuid) from public, anon, authenticated;
revoke all on function public.perform_round_operation(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.get_current_round_readonly(uuid) from public, anon, authenticated;
revoke all on function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  from public, anon, authenticated;
revoke all on function public.update_practice_note(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.delete_practice_note(uuid, uuid, bigint) from public, anon, authenticated;

grant execute on function public.rename_private_list(uuid, text) to authenticated;
grant execute on function public.create_concept(uuid, text, text) to authenticated;
grant execute on function public.create_concepts_batch(uuid, jsonb) to authenticated;
grant execute on function public.update_concept(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.delete_concept(uuid, timestamptz) to authenticated;
grant execute on function public.get_or_create_current_round(uuid) to authenticated;
grant execute on function public.get_current_round_readonly(uuid) to authenticated;
grant execute on function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint)
  to authenticated;
grant execute on function public.update_practice_note(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.delete_practice_note(uuid, uuid, bigint) to authenticated;

-- Round action aliases remain the exposed RPCs; the central guard is internal.
revoke all on function public.mark_concept_seen(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.draw_pending_concept(uuid, uuid) from public, anon, authenticated;
revoke all on function public.return_concept_to_pending(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_new_round(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_concept_seen(uuid, uuid, uuid) to authenticated;
grant execute on function public.draw_pending_concept(uuid, uuid) to authenticated;
grant execute on function public.return_concept_to_pending(uuid, uuid, uuid) to authenticated;
grant execute on function public.start_new_round(uuid, uuid) to authenticated;
