create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  locale text check (locale is null or locale in ('es', 'en')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  name_normalized text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint lists_name_trimmed_check check (name = btrim(name)),
  constraint lists_name_length_check check (char_length(name) between 1 and 80),
  constraint lists_owner_name_normalized_key unique (owner_id, name_normalized)
);

create index lists_owner_created_at_idx
  on public.lists (owner_id, created_at, id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger lists_set_updated_at
before update on public.lists
for each row
execute function public.set_updated_at();

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'profile_not_authenticated';
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = v_user_id;

  return v_profile;
end;
$$;

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
    raise exception using
      errcode = '28000',
      message = 'list_not_authenticated';
  end if;

  if v_name is null
     or char_length(v_name) = 0
     or char_length(v_name) > 80 then
    raise exception using
      errcode = '22023',
      message = 'list_name_invalid';
  end if;

  v_name_normalized := lower(v_name);

  select true
  into v_profile_exists
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if coalesce(v_profile_exists, false) = false then
    raise exception using
      errcode = 'P0001',
      message = 'profile_not_initialized';
  end if;

  select count(*)::integer
  into v_active_count
  from public.lists as l
  where l.owner_id = v_user_id;

  if v_active_count >= 100 then
    raise exception using
      errcode = 'P0001',
      message = 'list_limit_reached';
  end if;

  begin
    insert into public.lists (
      owner_id,
      name,
      name_normalized
    )
    values (
      v_user_id,
      v_name,
      v_name_normalized
    )
    returning * into v_list;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'list_name_duplicate';
  end;

  return v_list;
end;
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.lists enable row level security;
alter table public.lists force row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy lists_select_own
on public.lists
for select
to authenticated
using (owner_id = auth.uid());

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.lists from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (locale) on table public.profiles to authenticated;
grant select on table public.lists to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.ensure_profile() from public, anon, authenticated;
revoke all on function public.create_private_list(text) from public, anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.create_private_list(text) to authenticated;
