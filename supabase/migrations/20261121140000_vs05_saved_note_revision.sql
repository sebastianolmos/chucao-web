create or replace function public.get_saved_practice(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_practice public.practices;
  v_note public.practice_notes;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'practice_not_authenticated';
  end if;
  select * into v_practice from public.practices p
    where p.id = p_id and p.owner_id = auth.uid();
  if not found then
    raise exception using errcode = '42501', message = 'practice_unavailable';
  end if;
  select * into v_note from public.practice_notes n where n.practice_id = p_id;
  return jsonb_build_object('practice', to_jsonb(v_practice), 'note', v_note.body,
    'note_revision', v_note.revision);
end;
$$;

revoke all on function public.get_saved_practice(uuid) from public, anon, authenticated;
grant execute on function public.get_saved_practice(uuid) to authenticated;
