alter table public.practice_note_operations
  add column request_fingerprint text not null
  default encode(digest(convert_to('legacy-note-operation', 'UTF8'), 'sha256'), 'hex');

create or replace function public.update_practice_note(
  p_practice_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_body text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_list_id uuid;
  v_practice public.practices;
  v_note public.practice_notes;
  v_operation public.practice_note_operations;
  v_fingerprint text;
  v_outcome text;
begin
  if v_owner is null then
    raise exception using errcode = '28000', message = 'note_not_authenticated';
  end if;
  if p_practice_id is null or p_operation_id is null or p_expected_revision < 1
    or p_body is null or char_length(btrim(p_body, public.vs05_trim_characters())) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'note_input_invalid';
  end if;

  select p.list_id into v_list_id from public.practices p where p.id = p_practice_id;
  if not found then
    raise exception using errcode = '42501', message = 'note_unavailable';
  end if;
  if v_list_id is not null then
    perform 1 from public.lists l where l.id = v_list_id and l.owner_id = v_owner for update;
    if not found then raise exception using errcode = '42501', message = 'note_unavailable'; end if;
  end if;
  select * into v_practice from public.practices p
    where p.id = p_practice_id and p.owner_id = v_owner for update;
  if not found then raise exception using errcode = '42501', message = 'note_unavailable'; end if;

  v_fingerprint := encode(digest(convert_to(jsonb_build_array('update', p_expected_revision, p_body)::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_operation from public.practice_note_operations o
    where o.practice_id = p_practice_id and o.operation_id = p_operation_id;
  if found then
    if v_operation.owner_id <> v_owner or v_operation.operation_kind <> 'update'
      or v_operation.expected_revision <> p_expected_revision or v_operation.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'note_operation_conflict';
    end if;
    select * into v_note from public.practice_notes n where n.practice_id = p_practice_id;
    return jsonb_build_object('outcome', v_operation.outcome, 'note', v_note.body, 'revision', v_note.revision);
  end if;

  select * into v_note from public.practice_notes n where n.practice_id = p_practice_id for update;
  if not found then
    v_outcome := 'not_found';
  elsif v_note.revision <> p_expected_revision then
    v_outcome := 'stale';
  else
    update public.practice_notes n set body = p_body, revision = n.revision + 1,
      updated_at = timezone('utc', now()) where n.practice_id = p_practice_id returning * into v_note;
    v_outcome := 'updated';
  end if;
  insert into public.practice_note_operations (
    owner_id, practice_id, operation_id, operation_kind, expected_revision,
    resulting_revision, outcome, request_fingerprint
  ) values (v_owner, p_practice_id, p_operation_id, 'update', p_expected_revision,
    v_note.revision, v_outcome, v_fingerprint);
  return jsonb_build_object('outcome', v_outcome, 'note', v_note.body, 'revision', v_note.revision);
end;
$$;

create or replace function public.delete_practice_note(
  p_practice_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_list_id uuid;
  v_practice public.practices;
  v_note public.practice_notes;
  v_operation public.practice_note_operations;
  v_fingerprint text;
  v_outcome text;
  v_revision bigint;
begin
  if v_owner is null then
    raise exception using errcode = '28000', message = 'note_not_authenticated';
  end if;
  if p_practice_id is null or p_operation_id is null or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'note_input_invalid';
  end if;

  select p.list_id into v_list_id from public.practices p where p.id = p_practice_id;
  if not found then
    raise exception using errcode = '42501', message = 'note_unavailable';
  end if;
  if v_list_id is not null then
    perform 1 from public.lists l where l.id = v_list_id and l.owner_id = v_owner for update;
    if not found then raise exception using errcode = '42501', message = 'note_unavailable'; end if;
  end if;
  select * into v_practice from public.practices p
    where p.id = p_practice_id and p.owner_id = v_owner for update;
  if not found then raise exception using errcode = '42501', message = 'note_unavailable'; end if;

  v_fingerprint := encode(digest(convert_to(jsonb_build_array('delete', p_expected_revision)::text, 'UTF8'), 'sha256'), 'hex');
  select * into v_operation from public.practice_note_operations o
    where o.practice_id = p_practice_id and o.operation_id = p_operation_id;
  if found then
    if v_operation.owner_id <> v_owner or v_operation.operation_kind <> 'delete'
      or v_operation.expected_revision <> p_expected_revision or v_operation.request_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'note_operation_conflict';
    end if;
    select * into v_note from public.practice_notes n where n.practice_id = p_practice_id;
    return jsonb_build_object('outcome', v_operation.outcome, 'note', v_note.body, 'revision', v_note.revision);
  end if;

  select * into v_note from public.practice_notes n where n.practice_id = p_practice_id for update;
  if not found then
    v_outcome := 'not_found';
  elsif v_note.revision <> p_expected_revision then
    v_outcome := 'stale';
  else
    v_revision := v_note.revision;
    delete from public.practice_notes n where n.practice_id = p_practice_id;
    v_note.body := null;
    v_note.revision := null;
    v_outcome := 'deleted';
  end if;
  insert into public.practice_note_operations (
    owner_id, practice_id, operation_id, operation_kind, expected_revision,
    resulting_revision, outcome, request_fingerprint
  ) values (v_owner, p_practice_id, p_operation_id, 'delete', p_expected_revision,
    null, v_outcome, v_fingerprint);
  return jsonb_build_object('outcome', v_outcome, 'note', v_note.body, 'revision', v_note.revision);
end;
$$;

revoke all on function public.update_practice_note(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.delete_practice_note(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.update_practice_note(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.delete_practice_note(uuid, uuid, bigint) to authenticated;
