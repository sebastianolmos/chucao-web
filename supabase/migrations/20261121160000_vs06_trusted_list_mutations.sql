-- List count changes are serialized through the owner's profile row. Archived
-- lists remain private and retain their complete linked history.
create or replace function public.create_private_list(p_name text)
returns public.lists
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_name);
  v_name_normalized text;
  v_profile_exists boolean;
  v_active_count integer;
  v_list public.lists;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;

  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'list_name_invalid';
  end if;

  v_name_normalized := lower(v_name);

  select true into v_profile_exists
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;

  select count(*)::integer into v_active_count
  from public.lists as l
  where l.owner_id = v_user_id and l.archived_at is null;

  if v_active_count >= 100 then
    raise exception using errcode = 'P0001', message = 'list_limit_reached';
  end if;

  begin
    insert into public.lists (owner_id, name, name_normalized)
    values (v_user_id, v_name, v_name_normalized)
    returning * into v_list;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'list_name_duplicate';
  end;

  return v_list;
end;
$$;

create or replace function public.rename_private_list(p_list_id uuid, p_name text)
returns public.lists
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_name);
  v_profile_exists boolean;
  v_list public.lists;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'list_name_invalid';
  end if;

  select true into v_profile_exists
  from public.profiles as p where p.id = v_user_id for update;
  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;

  select l.* into v_list
  from public.lists as l
  where l.id = p_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'list_not_owned';
  end if;

  begin
    update public.lists as l
    set name = v_name, name_normalized = lower(v_name)
    where l.id = p_list_id
    returning l.* into v_list;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'list_name_duplicate';
  end;

  return v_list;
end;
$$;

create or replace function public.archive_private_list(p_list_id uuid)
returns public.lists
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_exists boolean;
  v_list public.lists;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;

  select true into v_profile_exists
  from public.profiles as p where p.id = v_user_id for update;
  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;

  select l.* into v_list
  from public.lists as l
  where l.id = p_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'list_not_owned';
  end if;

  if v_list.archived_at is null then
    update public.lists as l
    set archived_at = timezone('utc', now())
    where l.id = p_list_id
    returning l.* into v_list;
  end if;
  return v_list;
end;
$$;

create or replace function public.restore_private_list(p_list_id uuid)
returns public.lists
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_exists boolean;
  v_active_count integer;
  v_list public.lists;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;

  select true into v_profile_exists
  from public.profiles as p where p.id = v_user_id for update;
  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;

  select l.* into v_list
  from public.lists as l
  where l.id = p_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'list_not_owned';
  end if;

  if v_list.archived_at is not null then
    select count(*)::integer into v_active_count
    from public.lists as l
    where l.owner_id = v_user_id and l.archived_at is null;
    if v_active_count >= 100 then
      raise exception using errcode = 'P0001', message = 'list_limit_reached';
    end if;

    update public.lists as l
    set archived_at = null
    where l.id = p_list_id
    returning l.* into v_list;
  end if;
  return v_list;
end;
$$;

revoke all on function public.rename_private_list(uuid, text) from public, anon, authenticated;
revoke all on function public.archive_private_list(uuid) from public, anon, authenticated;
revoke all on function public.restore_private_list(uuid) from public, anon, authenticated;
grant execute on function public.rename_private_list(uuid, text) to authenticated;
grant execute on function public.archive_private_list(uuid) to authenticated;
grant execute on function public.restore_private_list(uuid) to authenticated;
