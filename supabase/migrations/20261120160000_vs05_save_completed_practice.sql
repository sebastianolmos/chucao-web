create or replace function public.vs05_trim_characters()
returns text
language sql immutable parallel safe
set search_path = pg_catalog
as $$
  select E'\t\n\v\f\r ' || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
    || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
    || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
    || chr(12288) || chr(65279);
$$;
revoke all on function public.vs05_trim_characters() from public, anon, authenticated;

create or replace function public.save_completed_practice(
  p_id uuid,
  p_kind text,
  p_list_id uuid,
  p_concept_id uuid,
  p_round_id uuid,
  p_appearance_id uuid,
  p_duration_minutes smallint,
  p_completed_at timestamptz,
  p_label text,
  p_note text,
  p_rating smallint
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_title text;
  v_fingerprint text;
  v_existing public.practices;
  v_practice public.practices;
  v_label text := coalesce(p_label, '');
  v_note_length integer;
begin
  if v_owner is null then
    raise exception using errcode = '28000', message = 'practice_not_authenticated';
  end if;
  if p_id is null or p_duration_minutes not between 1 and 59 or p_completed_at is null
     or p_rating is not null and p_rating not between 0 and 5 then
    raise exception using errcode = '22023', message = 'practice_input_invalid';
  end if;
  v_note_length := char_length(btrim(coalesce(p_note, ''), public.vs05_trim_characters()));
  if v_note_length > 2000 then
    raise exception using errcode = '22023', message = 'practice_note_invalid';
  end if;
  if p_kind = 'associated' then
    if p_list_id is null or p_concept_id is null or p_label is not null then
      raise exception using errcode = '22023', message = 'practice_context_invalid';
    end if;
    perform 1 from public.lists l where l.id = p_list_id and l.owner_id = v_owner for update;
    if not found then
      raise exception using errcode = '42501', message = 'practice_context_unavailable';
    end if;
    select c.title into v_title from public.concepts c
      where c.id = p_concept_id and c.list_id = p_list_id and c.deleted_at is null;
    if not found then
      raise exception using errcode = '42501', message = 'practice_context_unavailable';
    end if;
    if p_round_id is not null and not exists (
      select 1 from public.rounds r where r.id = p_round_id and r.list_id = p_list_id
    ) then
      raise exception using errcode = '42501', message = 'practice_context_unavailable';
    end if;
    if p_appearance_id is not null and not exists (
      select 1 from public.round_appearances a join public.rounds r on r.id = a.round_id
      where a.id = p_appearance_id and a.concept_id = p_concept_id
        and (p_round_id is null or a.round_id = p_round_id) and r.list_id = p_list_id
    ) then
      raise exception using errcode = '42501', message = 'practice_context_unavailable';
    end if;
  elsif p_kind = 'independent' then
    if p_list_id is not null or p_concept_id is not null or p_round_id is not null
       or p_appearance_id is not null
       or char_length(btrim(v_label, public.vs05_trim_characters())) not between 1 and 50 then
      raise exception using errcode = '22023', message = 'practice_label_invalid';
    end if;
    v_title := null;
  else
    raise exception using errcode = '22023', message = 'practice_kind_invalid';
  end if;

  v_fingerprint := encode(digest(convert_to(jsonb_build_array(
    p_kind, p_list_id, p_concept_id, p_round_id, p_appearance_id,
    p_duration_minutes, p_completed_at, p_label, p_note, p_rating
  )::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_existing from public.practices p where p.id = p_id;
  if found then
    if v_existing.owner_id = v_owner and v_existing.request_fingerprint = v_fingerprint then
      return jsonb_build_object('practice', to_jsonb(v_existing), 'note',
        (select n.body from public.practice_notes n where n.practice_id = p_id), 'replayed', true);
    end if;
    raise exception using errcode = '23505', message = 'practice_identity_conflict';
  end if;

  insert into public.practices (
    id, owner_id, kind, list_id, concept_id, round_id, appearance_id,
    title_snapshot, independent_label, duration_minutes, completed_at, rating, request_fingerprint
  ) values (
    p_id, v_owner, p_kind, p_list_id, p_concept_id, p_round_id, p_appearance_id,
    v_title, case when p_kind = 'independent' then p_label else null end,
    p_duration_minutes, p_completed_at, p_rating, v_fingerprint
  ) returning * into v_practice;

  if v_note_length > 0 then
    insert into public.practice_notes (practice_id, body) values (p_id, p_note);
  end if;
  return jsonb_build_object('practice', to_jsonb(v_practice), 'note',
    case when v_note_length > 0 then p_note else null end, 'replayed', false);
end;
$$;

create or replace function public.get_saved_practice(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_practice public.practices;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'practice_not_authenticated';
  end if;
  select * into v_practice from public.practices p
    where p.id = p_id and p.owner_id = auth.uid();
  if not found then
    raise exception using errcode = '42501', message = 'practice_unavailable';
  end if;
  return jsonb_build_object('practice', to_jsonb(v_practice), 'note',
    (select n.body from public.practice_notes n where n.practice_id = p_id));
end;
$$;

revoke all on function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint) from public, anon, authenticated;
revoke all on function public.get_saved_practice(uuid) from public, anon, authenticated;
grant execute on function public.save_completed_practice(uuid, text, uuid, uuid, uuid, uuid, smallint, timestamptz, text, text, smallint) to authenticated;
grant execute on function public.get_saved_practice(uuid) to authenticated;
