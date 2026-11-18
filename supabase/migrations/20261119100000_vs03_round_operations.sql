create or replace function public.get_or_create_current_round(p_list_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.rounds;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'round_not_authenticated';
  end if;

  perform 1 from public.lists as l
  where l.id = p_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'round_unauthorized';
  end if;

  select r.* into v_round from public.rounds as r
  where r.list_id = p_list_id and r.status = 'open';
  if not found then
    insert into public.rounds (list_id, status, opened_at)
    values (p_list_id, 'open', timezone('utc', now()))
    returning * into v_round;
  end if;
  return v_round;
end;
$$;

create or replace function public.perform_round_operation(
  p_list_id uuid,
  p_operation_id uuid,
  p_action text,
  p_concept_id uuid default null
)
returns table (
  action text,
  outcome text,
  round_id uuid,
  appearance_id uuid,
  appearance_order bigint,
  concept_id uuid,
  title text,
  result_state text,
  pending_count bigint,
  seen_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.rounds;
  v_saved public.round_operations;
  v_concept public.concepts;
  v_appearance public.round_appearances;
  v_outcome text;
  v_state text;
  v_title text;
  v_pending_count bigint;
  v_seen_count bigint;
  v_offset bigint;
  v_next_order bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'round_not_authenticated';
  end if;
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'round_operation_id_required';
  end if;
  if p_action not in ('mark_seen', 'draw', 'return_pending', 'new_round') then
    raise exception using errcode = '22023', message = 'round_action_invalid';
  end if;

  -- All list mutations take this lock before touching concepts or round data.
  perform 1 from public.lists as l
  where l.id = p_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'round_unauthorized';
  end if;

  select o.* into v_saved from public.round_operations as o
  where o.list_id = p_list_id and o.operation_id = p_operation_id;
  if found then
    select r.* into v_round from public.rounds as r where r.id = v_saved.round_id;
    select a.* into v_appearance from public.round_appearances as a
    where a.id = v_saved.appearance_id;
    select c.* into v_concept from public.concepts as c
    where c.id = v_saved.concept_id and c.deleted_at is null;
    v_title := case
      when v_appearance.concept_deleted then null
      else v_appearance.title_snapshot
    end;
    if v_saved.appearance_id is null and v_saved.concept_id is not null then
      v_title := v_concept.title;
    end if;
    select count(*) filter (where c.state = 'pending'),
           count(*) filter (where c.state = 'seen')
      into v_pending_count, v_seen_count
    from public.concepts as c
    where c.list_id = p_list_id and c.deleted_at is null;
    return query select v_saved.action, v_saved.outcome, v_round.id,
      v_saved.appearance_id, v_appearance.appearance_order,
      v_saved.concept_id, v_title, v_saved.result_state,
      v_pending_count, v_seen_count;
    return;
  end if;

  select r.* into v_round from public.rounds as r
  where r.list_id = p_list_id and r.status = 'open';
  if p_action = 'new_round' then
    if found then
      update public.rounds set status = 'closed', closed_at = timezone('utc', now())
      where id = v_round.id;
    end if;
    insert into public.rounds (list_id, status, opened_at)
    values (p_list_id, 'open', timezone('utc', now()))
    returning * into v_round;
    update public.concepts set state = 'pending', updated_at = timezone('utc', now())
    where list_id = p_list_id and deleted_at is null;
    v_outcome := 'applied';
    v_state := 'pending';
    v_concept := null;
  else
    if not found then
      insert into public.rounds (list_id, status, opened_at)
      values (p_list_id, 'open', timezone('utc', now()))
      returning * into v_round;
    end if;

    if p_action = 'draw' then
      select count(*) into v_pending_count from public.concepts as c
      where c.list_id = p_list_id and c.deleted_at is null and c.state = 'pending';
      if v_pending_count = 0 then
        v_outcome := 'exhausted';
        v_state := null;
      else
        v_offset := floor(random() * v_pending_count)::bigint;
        select c.* into v_concept from public.concepts as c
        where c.list_id = p_list_id and c.deleted_at is null and c.state = 'pending'
        order by c.position, c.id offset v_offset limit 1;
        v_outcome := 'applied';
        v_state := 'seen';
      end if;
    else
      select c.* into v_concept from public.concepts as c
      where c.id = p_concept_id and c.list_id = p_list_id and c.deleted_at is null
      for update;
      if not found
         or (p_action = 'mark_seen' and v_concept.state <> 'pending')
         or (p_action = 'return_pending' and v_concept.state <> 'seen') then
        v_outcome := 'rejected';
        v_state := case when v_concept.id is null then null else v_concept.state end;
        v_concept := null;
      else
        v_outcome := 'applied';
        v_state := case when p_action = 'mark_seen' then 'seen' else 'pending' end;
      end if;
    end if;

    if v_outcome = 'applied' and v_concept.id is not null then
      update public.concepts as c set state = v_state, updated_at = timezone('utc', now())
      where c.id = v_concept.id;
      if p_action in ('mark_seen', 'draw') then
        select coalesce(max(a.appearance_order), 0) + 1 into v_next_order
        from public.round_appearances as a where a.round_id = v_round.id;
        insert into public.round_appearances
          (round_id, concept_id, appearance_order, origin, title_snapshot)
        values
          (v_round.id, v_concept.id, v_next_order,
           case when p_action = 'draw' then 'draw' else 'manual' end,
           v_concept.title)
        returning * into v_appearance;
      end if;
    end if;
  end if;

  insert into public.round_operations
    (list_id, operation_id, round_id, action, outcome, appearance_id,
     concept_id, result_state)
  values
    (p_list_id, p_operation_id, v_round.id, p_action, v_outcome,
     v_appearance.id, v_concept.id, v_state);

  select count(*) filter (where c.state = 'pending'),
         count(*) filter (where c.state = 'seen')
    into v_pending_count, v_seen_count
  from public.concepts as c
  where c.list_id = p_list_id and c.deleted_at is null;
  return query select p_action, v_outcome, v_round.id, v_appearance.id,
    v_appearance.appearance_order, v_concept.id,
    coalesce(v_appearance.title_snapshot, v_concept.title), v_state,
    v_pending_count, v_seen_count;
end;
$$;

create or replace function public.mark_concept_seen(
  p_list_id uuid, p_concept_id uuid, p_operation_id uuid
)
returns table (
  action text, outcome text, round_id uuid, appearance_id uuid,
  appearance_order bigint, concept_id uuid, title text, result_state text,
  pending_count bigint, seen_count bigint
)
language sql security definer
set search_path = pg_catalog, public, auth
as $$ select * from public.perform_round_operation(p_list_id, p_operation_id, 'mark_seen', p_concept_id) $$;

create or replace function public.draw_pending_concept(
  p_list_id uuid, p_operation_id uuid
)
returns table (
  action text, outcome text, round_id uuid, appearance_id uuid,
  appearance_order bigint, concept_id uuid, title text, result_state text,
  pending_count bigint, seen_count bigint
)
language sql security definer
set search_path = pg_catalog, public, auth
as $$ select * from public.perform_round_operation(p_list_id, p_operation_id, 'draw', null) $$;

create or replace function public.return_concept_to_pending(
  p_list_id uuid, p_concept_id uuid, p_operation_id uuid
)
returns table (
  action text, outcome text, round_id uuid, appearance_id uuid,
  appearance_order bigint, concept_id uuid, title text, result_state text,
  pending_count bigint, seen_count bigint
)
language sql security definer
set search_path = pg_catalog, public, auth
as $$ select * from public.perform_round_operation(p_list_id, p_operation_id, 'return_pending', p_concept_id) $$;

create or replace function public.start_new_round(
  p_list_id uuid, p_operation_id uuid
)
returns table (
  action text, outcome text, round_id uuid, appearance_id uuid,
  appearance_order bigint, concept_id uuid, title text, result_state text,
  pending_count bigint, seen_count bigint
)
language sql security definer
set search_path = pg_catalog, public, auth
as $$ select * from public.perform_round_operation(p_list_id, p_operation_id, 'new_round', null) $$;

-- Serialize edits/deletes with round operations using the parent list lock.
create or replace function public.update_concept(
  p_concept_id uuid, p_title text, p_description text,
  p_expected_updated_at timestamptz
)
returns public.concepts
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id uuid;
  v_title text := btrim(p_title);
  v_description text := btrim(coalesce(p_description, ''));
  v_concept public.concepts;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'concept_not_authenticated';
  end if;
  select c.list_id into v_list_id from public.concepts as c
  where c.id = p_concept_id and c.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'concept_not_found';
  end if;
  perform 1 from public.lists as l
  where l.id = v_list_id and l.owner_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'concept_not_found';
  end if;
  if v_title is null or char_length(v_title) = 0 or char_length(v_title) > 50 then
    raise exception using errcode = '22023', message = 'concept_title_invalid';
  end if;
  if char_length(v_description) > 2000 then
    raise exception using errcode = '22023', message = 'concept_description_invalid';
  end if;
  if exists (
    select 1 from public.concepts as other
    where other.list_id = v_list_id and other.id <> p_concept_id
      and other.deleted_at is null and other.title = v_title
  ) then
    raise exception using errcode = '23505', message = 'concept_duplicate';
  end if;
  update public.concepts as c set title = v_title, description = v_description
  where c.id = p_concept_id and c.list_id = v_list_id and c.deleted_at is null
    and c.updated_at = p_expected_updated_at
  returning c.* into v_concept;
  if not found then
    raise exception using errcode = '40001', message = 'concept_conflict';
  end if;
  return v_concept;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'concept_duplicate';
end;
$$;

create or replace function public.delete_concept(
  p_concept_id uuid, p_expected_updated_at timestamptz
)
returns public.concepts
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id uuid;
  v_concept public.concepts;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'concept_not_authenticated';
  end if;
  select c.list_id into v_list_id from public.concepts as c
  where c.id = p_concept_id and c.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'concept_not_found';
  end if;
  perform 1 from public.lists as l
  where l.id = v_list_id and l.owner_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'concept_not_found';
  end if;
  update public.round_appearances as a
  set title_snapshot = null, concept_deleted = true
  where a.concept_id = p_concept_id and not a.concept_deleted;
  update public.concepts as c
  set title = null, description = null, deleted_at = timezone('utc', now())
  where c.id = p_concept_id and c.list_id = v_list_id and c.deleted_at is null
    and c.updated_at = p_expected_updated_at
  returning c.* into v_concept;
  if not found then
    raise exception using errcode = '40001', message = 'concept_conflict';
  end if;
  return v_concept;
end;
$$;

revoke all on function public.get_or_create_current_round(uuid) from public, anon, authenticated;
revoke all on function public.perform_round_operation(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_concept_seen(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.draw_pending_concept(uuid, uuid) from public, anon, authenticated;
revoke all on function public.return_concept_to_pending(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_new_round(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_concept(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_concept(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.get_or_create_current_round(uuid) to authenticated;
grant execute on function public.mark_concept_seen(uuid, uuid, uuid) to authenticated;
grant execute on function public.draw_pending_concept(uuid, uuid) to authenticated;
grant execute on function public.return_concept_to_pending(uuid, uuid, uuid) to authenticated;
grant execute on function public.start_new_round(uuid, uuid) to authenticated;
grant execute on function public.update_concept(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.delete_concept(uuid, timestamptz) to authenticated;
