-- A note-operation receipt must have the same owner as its practice.
alter table public.practices
  add constraint practices_owner_id_id_key unique (owner_id, id);

alter table public.practice_note_operations
  drop constraint practice_note_operations_practice_id_fkey;
alter table public.practice_note_operations
  add constraint practice_note_operations_owner_practice_fkey
  foreign key (owner_id, practice_id)
  references public.practices (owner_id, id) on delete cascade;

drop policy practice_note_operations_select_own on public.practice_note_operations;
create policy practice_note_operations_select_own on public.practice_note_operations
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.practices p
      where p.id = practice_note_operations.practice_id
        and p.owner_id = practice_note_operations.owner_id
    )
  );
