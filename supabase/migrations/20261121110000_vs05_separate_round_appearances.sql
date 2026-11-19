create or replace function public.list_round_history(
  p_list_id uuid default null,
  p_cursor_opened_at timestamptz default null,
  p_cursor_id uuid default null,
  p_page_size integer default 50,
  p_direction text default 'newest'
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_owner uuid := auth.uid();
  v_limit integer;
  v_result jsonb;
begin
  if v_owner is null then
    raise exception using errcode = '28000', message = 'history_not_authenticated';
  end if;
  if ((p_cursor_opened_at is null) <> (p_cursor_id is null))
    or (p_direction not in ('newest', 'oldest'))
    or p_page_size is null or p_page_size < 1 then
    raise exception using errcode = '22023', message = 'history_filter_invalid';
  end if;
  v_limit := least(p_page_size, 100);

  with filtered as (
    select r.id, r.list_id, l.name as list_name, r.status, r.opened_at, r.closed_at
    from public.rounds r
    join public.lists l on l.id = r.list_id
    where l.owner_id = v_owner and r.list_id is not null
      and (p_list_id is null or r.list_id = p_list_id)
      and r.opened_at is not null
      and (p_cursor_id is null or
        (p_direction = 'newest' and (r.opened_at, r.id) < (p_cursor_opened_at, p_cursor_id)) or
        (p_direction = 'oldest' and (r.opened_at, r.id) > (p_cursor_opened_at, p_cursor_id)))
  ), ordered as (
    select * from filtered
    order by
      case when p_direction = 'newest' then opened_at end desc,
      case when p_direction = 'oldest' then opened_at end asc,
      case when p_direction = 'newest' then id end desc,
      case when p_direction = 'oldest' then id end asc
    limit v_limit + 1
  ), visible as (
    select * from ordered
    order by
      case when p_direction = 'newest' then opened_at end desc,
      case when p_direction = 'oldest' then opened_at end asc,
      case when p_direction = 'newest' then id end desc,
      case when p_direction = 'oldest' then id end asc
    limit v_limit
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'list_id', v.list_id, 'list_name', v.list_name,
      'status', v.status, 'opened_at', v.opened_at, 'closed_at', v.closed_at
    ) order by
      case when p_direction = 'newest' then v.opened_at end desc,
      case when p_direction = 'oldest' then v.opened_at end asc,
      case when p_direction = 'newest' then v.id end desc,
      case when p_direction = 'oldest' then v.id end asc) from visible v), '[]'::jsonb),
    'has_more', (select count(*) > v_limit from ordered),
    'next_cursor', (select jsonb_build_object('timestamp', opened_at, 'id', id)
      from visible order by
        case when p_direction = 'newest' then opened_at end asc,
        case when p_direction = 'oldest' then opened_at end desc,
        case when p_direction = 'newest' then id end asc,
        case when p_direction = 'oldest' then id end desc
      limit 1 offset v_limit - 1)
  ) into v_result;
  if not (v_result ->> 'has_more')::boolean then
    v_result := jsonb_set(v_result, '{next_cursor}', 'null'::jsonb);
  end if;
  return v_result;
end;
$$;

create or replace function public.list_round_appearances(p_round_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_owner uuid := auth.uid();
  v_result jsonb;
  v_accessible integer;
begin
  if v_owner is null then
    raise exception using errcode = '28000', message = 'history_not_authenticated';
  end if;
  if p_round_ids is null or cardinality(p_round_ids) > 100
    or array_position(p_round_ids, null) is not null then
    raise exception using errcode = '22023', message = 'history_round_ids_invalid';
  end if;
  select count(*) into v_accessible
    from public.rounds r join public.lists l on l.id = r.list_id
    where r.id = any(p_round_ids) and l.owner_id = v_owner;
  if v_accessible <> cardinality(p_round_ids) then
    raise exception using errcode = '42501', message = 'history_round_unavailable';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'round_id', selected.id,
    'appearances', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'appearance_order', a.appearance_order, 'origin', a.origin,
      'title_snapshot', a.title_snapshot, 'concept_deleted', a.concept_deleted,
      'created_at', a.created_at
    ) order by a.appearance_order, a.id)
    from public.round_appearances a where a.round_id = selected.id), '[]'::jsonb)
  )), '[]'::jsonb) into v_result
    from public.rounds selected
    join public.lists l on l.id = selected.list_id
    where selected.id = any(p_round_ids) and l.owner_id = v_owner;
  return v_result;
end;
$$;

revoke all on function public.list_round_history(uuid, timestamptz, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.list_round_appearances(uuid[]) from public, anon, authenticated;
grant execute on function public.list_round_history(uuid, timestamptz, uuid, integer, text) to authenticated;
grant execute on function public.list_round_appearances(uuid[]) to authenticated;
