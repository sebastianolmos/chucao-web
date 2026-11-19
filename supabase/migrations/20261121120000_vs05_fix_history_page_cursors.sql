create or replace function public.list_practice_history(
  p_from timestamptz default null,
  p_to_exclusive timestamptz default null,
  p_list_id uuid default null,
  p_concept_id uuid default null,
  p_independent_label text default null,
  p_kind text default null,
  p_rating_state text default null,
  p_cursor_completed_at timestamptz default null,
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
  if (p_from is not null and p_to_exclusive is not null and p_from >= p_to_exclusive)
    or ((p_cursor_completed_at is null) <> (p_cursor_id is null))
    or (p_direction not in ('newest', 'oldest'))
    or (p_kind is not null and p_kind not in ('associated', 'independent'))
    or (p_rating_state is not null and p_rating_state not in ('rated', 'unrated'))
    or p_page_size is null or p_page_size < 1 then
    raise exception using errcode = '22023', message = 'history_filter_invalid';
  end if;
  v_limit := least(p_page_size, 100);

  with filtered as (
    select p.id, p.kind, p.list_id, l.name as list_name, p.concept_id,
      p.title_snapshot, p.independent_label, p.completed_at,
      p.duration_minutes, p.rating,
      exists (select 1 from public.practice_notes n where n.practice_id = p.id) as has_note
    from public.practices p
    left join public.lists l on l.id = p.list_id and l.owner_id = v_owner
    where p.owner_id = v_owner
      and (p_from is null or p.completed_at >= p_from)
      and (p_to_exclusive is null or p.completed_at < p_to_exclusive)
      and (p_list_id is null or p.list_id = p_list_id)
      and (p_concept_id is null or (p.kind = 'associated' and p.concept_id = p_concept_id))
      and (p_independent_label is null or (p.kind = 'independent'
        and strpos(lower(p.independent_label), lower(p_independent_label)) > 0))
      and (p_kind is null or p.kind = p_kind)
      and (p_rating_state is null or (p_rating_state = 'rated' and p.rating is not null)
        or (p_rating_state = 'unrated' and p.rating is null))
      and (p_cursor_id is null or
        (p_direction = 'newest' and (p.completed_at, p.id) < (p_cursor_completed_at, p_cursor_id)) or
        (p_direction = 'oldest' and (p.completed_at, p.id) > (p_cursor_completed_at, p_cursor_id)))
  ), ordered as (
    select * from filtered
    order by
      case when p_direction = 'newest' then completed_at end desc,
      case when p_direction = 'oldest' then completed_at end asc,
      case when p_direction = 'newest' then id end desc,
      case when p_direction = 'oldest' then id end asc
    limit v_limit + 1
  ), visible as (
    select * from ordered
    order by
      case when p_direction = 'newest' then completed_at end desc,
      case when p_direction = 'oldest' then completed_at end asc,
      case when p_direction = 'newest' then id end desc,
      case when p_direction = 'oldest' then id end asc
    limit v_limit
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'list_id', list_id, 'list_name', list_name,
      'concept_id', concept_id, 'title_snapshot', title_snapshot,
      'independent_label', independent_label, 'completed_at', completed_at,
      'duration_minutes', duration_minutes, 'rating', rating, 'has_note', has_note
    ) order by
      case when p_direction = 'newest' then completed_at end desc,
      case when p_direction = 'oldest' then completed_at end asc,
      case when p_direction = 'newest' then id end desc,
      case when p_direction = 'oldest' then id end asc) from visible), '[]'::jsonb),
    'has_more', (select count(*) > v_limit from ordered),
    'next_cursor', (select jsonb_build_object('timestamp', completed_at, 'id', id)
      from visible order by
        case when p_direction = 'newest' then completed_at end desc,
        case when p_direction = 'oldest' then completed_at end asc,
        case when p_direction = 'newest' then id end desc,
        case when p_direction = 'oldest' then id end asc
      limit 1 offset v_limit - 1)
  ) into v_result;
  if not (v_result ->> 'has_more')::boolean then
    v_result := jsonb_set(v_result, '{next_cursor}', 'null'::jsonb);
  end if;
  return v_result;
end;
$$;

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
        case when p_direction = 'newest' then opened_at end desc,
        case when p_direction = 'oldest' then opened_at end asc,
        case when p_direction = 'newest' then id end desc,
        case when p_direction = 'oldest' then id end asc
      limit 1 offset v_limit - 1)
  ) into v_result;
  if not (v_result ->> 'has_more')::boolean then
    v_result := jsonb_set(v_result, '{next_cursor}', 'null'::jsonb);
  end if;
  return v_result;
end;
$$;
