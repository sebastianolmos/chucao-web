-- VS-05 storage boundary. This migration creates storage only; trusted
-- write/read RPCs are introduced with the corresponding service task.
create table public.practices (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  list_id uuid not null references public.lists (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete set null,
  round_id uuid references public.rounds (id) on delete set null,
  appearance_id uuid references public.round_appearances (id) on delete set null,
  title_snapshot text,
  independent_label text,
  duration_minutes smallint not null,
  completed_at timestamptz not null,
  saved_at timestamptz not null default timezone('utc', now()),
  rating smallint,
  request_fingerprint text not null,
  constraint practices_kind_check check (kind in ('associated', 'independent')),
  constraint practices_duration_check check (duration_minutes between 1 and 59),
  constraint practices_rating_check check (rating is null or rating between 0 and 5),
  constraint practices_fingerprint_check check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint practices_identity_check check (
    (kind = 'associated'
      and concept_id is not null
      and title_snapshot is not null
      and char_length(title_snapshot) between 1 and 50
      and independent_label is null)
    or
    (kind = 'independent'
      and concept_id is null and round_id is null and appearance_id is null
      and title_snapshot is null
      and independent_label is not null
      and char_length(btrim(independent_label)) between 1 and 50)
  ),
  constraint practices_list_id_id_key unique (list_id, id)
);

create index practices_owner_completed_idx
  on public.practices (owner_id, completed_at desc, id desc);
create index practices_list_completed_idx
  on public.practices (list_id, completed_at desc, id desc);
create index practices_concept_completed_idx
  on public.practices (concept_id, completed_at desc, id desc)
  where concept_id is not null;

create table public.practice_notes (
  practice_id uuid primary key references public.practices (id) on delete cascade,
  body text not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint practice_notes_revision_check check (revision > 0),
  constraint practice_notes_body_check check (
    char_length(btrim(body)) between 1 and 2000
  )
);

create table public.practice_note_operations (
  owner_id uuid not null references auth.users (id) on delete cascade,
  practice_id uuid not null,
  operation_id uuid not null,
  operation_kind text not null,
  expected_revision bigint not null,
  resulting_revision bigint,
  outcome text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (practice_id, operation_id),
  constraint practice_note_operations_kind_check
    check (operation_kind in ('update', 'delete')),
  constraint practice_note_operations_revision_check check (
    expected_revision > 0 and (resulting_revision is null or resulting_revision > 0)
  ),
  constraint practice_note_operations_outcome_check check (
    outcome in ('updated', 'deleted', 'stale', 'not_found')
  ),
  constraint practice_note_operations_practice_id_fkey
    foreign key (practice_id) references public.practices (id) on delete cascade
);

alter table public.practices enable row level security;
alter table public.practices force row level security;
alter table public.practice_notes enable row level security;
alter table public.practice_notes force row level security;
alter table public.practice_note_operations enable row level security;
alter table public.practice_note_operations force row level security;

create policy practices_select_own on public.practices
  for select to authenticated using (owner_id = (select auth.uid()));
create policy practice_notes_select_own on public.practice_notes
  for select to authenticated using (
    exists (
      select 1 from public.practices p
      where p.id = practice_notes.practice_id and p.owner_id = (select auth.uid())
    )
  );
create policy practice_note_operations_select_own on public.practice_note_operations
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on table public.practices from public, anon, authenticated;
revoke all on table public.practice_notes from public, anon, authenticated;
revoke all on table public.practice_note_operations from public, anon, authenticated;
grant select on table public.practices, public.practice_notes,
  public.practice_note_operations to authenticated;

comment on table public.practices is
  'Private completed practice metadata; ownership is the authenticated Supabase user.';
comment on table public.practice_notes is
  'Optional private user-authored note, separate from immutable practice metadata.';
comment on table public.practice_note_operations is
  'Text-free idempotency receipts for note changes; cascades with owner or practice.';

-- Preserve titles in already available appearance snapshots on future concept
-- deletion. Legacy null snapshots remain null and require the UI fallback.
alter table public.round_appearances
  drop constraint round_appearances_title_snapshot_check;
alter table public.round_appearances
  add constraint round_appearances_title_snapshot_check check (
    (concept_deleted and (title_snapshot is null or char_length(title_snapshot) between 1 and 50))
    or (not concept_deleted and title_snapshot is not null
      and char_length(title_snapshot) between 1 and 50)
  );

create or replace function public.delete_concept(
  p_concept_id uuid, p_expected_updated_at timestamptz
)
returns public.concepts
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id uuid;
  v_concept public.concepts;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'concept_not_authenticated';
  end if;
  select c.list_id into v_list_id from public.concepts as c
  where c.id = p_concept_id and c.deleted_at is null;
  if not found then
    raise exception using errcode = '42501', message = 'concept_not_found';
  end if;
  perform 1 from public.lists as l
  where l.id = v_list_id and l.owner_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'concept_not_found';
  end if;
  update public.round_appearances as a
  set concept_deleted = true
  where a.concept_id = p_concept_id and not a.concept_deleted;
  update public.concepts as c
  set title = null, description = null, deleted_at = timezone('utc', now())
  where c.id = p_concept_id and c.list_id = v_list_id and c.deleted_at is null
    and c.updated_at = p_expected_updated_at
  returning c.* into v_concept;
  if not found then
    raise exception using errcode = '40001', message = 'concept_conflict';
  end if;
  return v_concept;
end;
$$;
revoke all on function public.delete_concept(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.delete_concept(uuid, timestamptz) to authenticated;
