-- No list-delete RPC exists yet. Enforce the already-confirmed deletion
-- lifecycle at the database boundary for any trusted list deletion path.
create or replace function public.anonymize_rounds_before_list_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.rounds r
  set anonymous_appearance_total = (
        select count(*) from public.round_appearances a where a.round_id = r.id
      ),
      status = 'closed',
      closed_at = coalesce(r.closed_at, timezone('utc', now()))
  where r.list_id = old.id;

  delete from public.round_appearances a
  using public.rounds r
  where a.round_id = r.id and r.list_id = old.id;

  delete from public.round_operations o where o.list_id = old.id;

  update public.rounds r
  set list_id = null, opened_at = null, closed_at = null, created_at = null
  where r.list_id = old.id;
  return old;
end;
$$;

revoke all on function public.anonymize_rounds_before_list_delete() from public, anon, authenticated;
create trigger lists_anonymize_rounds_before_delete
before delete on public.lists
for each row execute function public.anonymize_rounds_before_list_delete();
