create or replace function public.anonymize_rounds_before_list_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_round_ids uuid[];
begin
  select coalesce(array_agg(r.id), '{}'::uuid[])
  into v_round_ids
  from public.rounds r
  where r.list_id = old.id;

  -- Set all detached-round fields together so the lifecycle CHECK remains
  -- valid at the end of this row update.
  update public.rounds r
  set anonymous_appearance_total = (
        select count(*) from public.round_appearances a where a.round_id = r.id
      ),
      list_id = null,
      status = 'closed',
      opened_at = null,
      closed_at = null,
      created_at = null
  where r.id = any(v_round_ids);

  delete from public.round_appearances a where a.round_id = any(v_round_ids);
  delete from public.round_operations o where o.list_id = old.id;
  return old;
end;
$$;

revoke all on function public.anonymize_rounds_before_list_delete() from public, anon, authenticated;
