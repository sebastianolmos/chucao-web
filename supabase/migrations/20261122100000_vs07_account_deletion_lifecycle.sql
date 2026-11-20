create table public.account_deletion_requests (
  user_id uuid primary key,
  state text not null default 'pending',
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint account_deletion_requests_state_check
    check (state in ('pending', 'completed')),
  constraint account_deletion_requests_completion_check
    check ((state = 'pending' and completed_at is null)
      or (state = 'completed' and completed_at is not null))
);

comment on table public.account_deletion_requests is
  'Restricted lifecycle marker retained outside auth.users cascades so deletion can be reconciled during recovery.';
comment on column public.account_deletion_requests.user_id is
  'Supabase Auth UUID only; no email or authored content is retained.';

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_requests force row level security;
revoke all on table public.account_deletion_requests from public, anon, authenticated;

create or replace function public.get_account_deletion_status()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'account_deletion_not_authenticated';
  end if;

  if exists (
    select 1
    from public.account_deletion_requests as request
    where request.user_id = v_user_id
  ) then
    return 'deletion_pending';
  end if;

  return 'active';
end;
$$;

revoke all on function public.get_account_deletion_status() from public, anon, authenticated;
grant execute on function public.get_account_deletion_status() to authenticated;

create or replace function public.begin_account_deletion()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_state text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'account_deletion_not_authenticated';
  end if;

  -- The unique user_id key serializes concurrent first requests. Locking the
  -- resulting row serializes retries and prevents a completed marker reopening.
  insert into public.account_deletion_requests (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select request.state
  into v_state
  from public.account_deletion_requests as request
  where request.user_id = v_user_id
  for update;

  if v_state = 'pending' then
    -- Delete linked rounds before any account/list cascade can invoke the
    -- list-delete anonymization trigger. Earlier detached totals have no link
    -- to this account and are deliberately retained.
    delete from public.rounds as round
    using public.lists as list
    where round.list_id = list.id
      and list.owner_id = v_user_id;
  end if;

  return 'deletion_pending';
end;
$$;

revoke all on function public.begin_account_deletion() from public, anon, authenticated;
grant execute on function public.begin_account_deletion() to authenticated;
