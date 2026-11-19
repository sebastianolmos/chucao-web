-- The receipt stores only a keyed-by-operation SHA-256 fingerprint, not the
-- requested list name. It lets the same authenticated request recover its
-- created identity after an ambiguous response without making a second copy.
create table public.list_duplicate_operations (
  owner_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  source_list_id uuid not null references public.lists (id) on delete cascade,
  request_fingerprint bytea not null,
  result_list_id uuid references public.lists (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner_id, operation_id),
  constraint list_duplicate_operations_fingerprint_check
    check (octet_length(request_fingerprint) = 32)
);

alter table public.list_duplicate_operations enable row level security;
alter table public.list_duplicate_operations force row level security;
revoke all on table public.list_duplicate_operations from public, anon, authenticated;

comment on table public.list_duplicate_operations is
  'Private text-free operation receipts for list duplication retries; cascades with owner/source and clears deleted results.';

create or replace function public.duplicate_private_list(
  p_source_list_id uuid,
  p_operation_id uuid,
  p_name text
)
returns public.lists
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_name);
  v_name_normalized text;
  v_fingerprint bytea;
  v_profile_exists boolean;
  v_active_count integer;
  v_source public.lists;
  v_existing public.list_duplicate_operations;
  v_list public.lists;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'list_operation_id_required';
  end if;
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'list_name_invalid';
  end if;

  v_name_normalized := lower(v_name);
  v_fingerprint := extensions.digest(
    v_user_id::text || ':' || p_source_list_id::text || ':' || v_name_normalized,
    'sha256'
  );

  select true into v_profile_exists
  from public.profiles as p where p.id = v_user_id for update;
  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;

  select l.* into v_source
  from public.lists as l
  where l.id = p_source_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'list_not_owned';
  end if;

  select o.* into v_existing
  from public.list_duplicate_operations as o
  where o.owner_id = v_user_id and o.operation_id = p_operation_id
  for update;
  if found then
    if v_existing.source_list_id <> p_source_list_id
       or v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode = 'P0001', message = 'duplicate_operation_conflict';
    end if;
    if v_existing.result_list_id is null then
      raise exception using errcode = 'P0001', message = 'duplicate_result_deleted';
    end if;

    select l.* into v_list
    from public.lists as l
    where l.id = v_existing.result_list_id and l.owner_id = v_user_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'duplicate_result_deleted';
    end if;
    return v_list;
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

  insert into public.concepts (id, list_id, title, description, state, position)
  select gen_random_uuid(), v_list.id, c.title, c.description, 'pending', c.position
  from public.concepts as c
  where c.list_id = v_source.id and c.deleted_at is null
  order by c.position, c.id;

  insert into public.list_duplicate_operations (
    owner_id, operation_id, source_list_id, request_fingerprint, result_list_id
  ) values (
    v_user_id, p_operation_id, v_source.id, v_fingerprint, v_list.id
  );

  return v_list;
end;
$$;

create or replace function public.delete_private_list(p_list_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_exists boolean;
  v_list_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;

  select true into v_profile_exists
  from public.profiles as p where p.id = v_user_id for update;
  if coalesce(v_profile_exists, false) = false then
    raise exception using errcode = 'P0001', message = 'profile_not_initialized';
  end if;

  select l.id into v_list_id
  from public.lists as l
  where l.id = p_list_id and l.owner_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'list_not_owned';
  end if;

  -- The existing BEFORE DELETE trigger performs round anonymization; normal
  -- foreign-key cascades remove list concepts and associated private practice.
  delete from public.lists as l where l.id = v_list_id;
  return v_list_id;
end;
$$;

revoke all on function public.duplicate_private_list(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.delete_private_list(uuid) from public, anon, authenticated;
grant execute on function public.duplicate_private_list(uuid, uuid, text) to authenticated;
grant execute on function public.delete_private_list(uuid) to authenticated;
