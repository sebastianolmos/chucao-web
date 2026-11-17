create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  title text,
  description text,
  state text not null default 'pending',
  position bigint not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint concepts_state_check check (state in ('pending', 'seen')),
  constraint concepts_position_check check (position > 0),
  constraint concepts_active_title_check check (
    deleted_at is not null
    or (
      title is not null
      and title = btrim(title)
      and char_length(title) between 1 and 50
    )
  ),
  constraint concepts_active_description_check check (
    deleted_at is not null
    or (
      description is not null
      and description = btrim(description)
      and char_length(description) <= 2000
    )
  ),
  constraint concepts_tombstone_content_check check (
    deleted_at is null
    or (title is null and description is null)
  )
);

create index concepts_list_active_position_idx
  on public.concepts (list_id, position, id)
  where deleted_at is null;

create index concepts_list_id_idx
  on public.concepts (list_id);

create unique index concepts_active_title_key
  on public.concepts (list_id, title)
  where deleted_at is null;

create trigger concepts_set_updated_at
before update on public.concepts
for each row
execute function public.set_updated_at();

create or replace function public.create_concept(
  p_list_id uuid,
  p_title text,
  p_description text default ''
)
returns public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(p_title);
  v_description text := btrim(coalesce(p_description, ''));
  v_next_position bigint;
  v_concept public.concepts;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'concept_not_authenticated';
  end if;

  if v_title is null
     or char_length(v_title) = 0
     or char_length(v_title) > 50 then
    raise exception using
      errcode = '22023',
      message = 'concept_title_invalid';
  end if;

  if char_length(v_description) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'concept_description_invalid';
  end if;

  perform 1
  from public.lists as l
  where l.id = p_list_id
    and l.owner_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'concept_unauthorized';
  end if;

  if exists (
    select 1
    from public.concepts as c
    where c.list_id = p_list_id
      and c.deleted_at is null
      and c.title = v_title
  ) then
    raise exception using
      errcode = '23505',
      message = 'concept_duplicate';
  end if;

  select coalesce(max(c.position), 0) + 1
  into v_next_position
  from public.concepts as c
  where c.list_id = p_list_id;

  begin
    insert into public.concepts (list_id, title, description, position)
    values (p_list_id, v_title, v_description, v_next_position)
    returning * into v_concept;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'concept_duplicate';
  end;

  return v_concept;
end;
$$;

create or replace function public.create_concepts_batch(
  p_list_id uuid,
  p_items jsonb
)
returns setof public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_title text;
  v_description text;
  v_item_count integer;
  v_payload_length integer := 0;
  v_next_position bigint;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'concept_not_authenticated';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'concept_batch_invalid';
  end if;

  select jsonb_array_length(p_items)
  into v_item_count;

  if v_item_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'concept_batch_empty';
  end if;

  if v_item_count > 100 then
    raise exception using
      errcode = '22023',
      message = 'batch_limit_exceeded';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'title') <> 'string'
       or (
         v_item ? 'description'
         and jsonb_typeof(v_item -> 'description') <> 'string'
       ) then
      raise exception using
        errcode = '22023',
        message = 'concept_batch_invalid';
    end if;

    v_title := btrim(v_item ->> 'title');
    v_description := btrim(coalesce(v_item ->> 'description', ''));

    if v_title is null
       or char_length(v_title) = 0
       or char_length(v_title) > 50 then
      raise exception using
        errcode = '22023',
        message = 'concept_title_invalid';
    end if;

    if char_length(v_description) > 2000 then
      raise exception using
        errcode = '22023',
        message = 'concept_description_invalid';
    end if;

    v_payload_length := v_payload_length
      + char_length(v_title)
      + char_length(v_description)
      + 3;
  end loop;

  if v_payload_length > 20000 then
    raise exception using
      errcode = '22023',
      message = 'batch_limit_exceeded';
  end if;

  perform 1
  from public.lists as l
  where l.id = p_list_id
    and l.owner_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'concept_unauthorized';
  end if;

  if exists (
    select 1
    from (
      select btrim(value ->> 'title') as title
      from jsonb_array_elements(p_items)
    ) as batch_items
    join public.concepts as c
      on c.list_id = p_list_id
     and c.deleted_at is null
     and c.title = batch_items.title
  ) then
    raise exception using
      errcode = '23505',
      message = 'concept_duplicate';
  end if;

  if exists (
    select 1
    from (
      select btrim(value ->> 'title') as title
      from jsonb_array_elements(p_items)
    ) as batch_items
    group by batch_items.title
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'concept_duplicate';
  end if;

  select coalesce(max(c.position), 0) + 1
  into v_next_position
  from public.concepts as c
  where c.list_id = p_list_id;

  begin
    return query
    insert into public.concepts (
      list_id,
      title,
      description,
      position
    )
    select
      p_list_id,
      btrim(items.value ->> 'title'),
      btrim(coalesce(items.value ->> 'description', '')),
      v_next_position + items.ordinality - 1
    from jsonb_array_elements(p_items) with ordinality as items
    order by items.ordinality
    returning public.concepts.*;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'concept_duplicate';
  end;
end;
$$;

create or replace function public.update_concept(
  p_concept_id uuid,
  p_title text,
  p_description text,
  p_expected_updated_at timestamptz
)
returns public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(p_title);
  v_description text := btrim(coalesce(p_description, ''));
  v_concept public.concepts;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'concept_not_authenticated';
  end if;

  if v_title is null
     or char_length(v_title) = 0
     or char_length(v_title) > 50 then
    raise exception using
      errcode = '22023',
      message = 'concept_title_invalid';
  end if;

  if char_length(v_description) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'concept_description_invalid';
  end if;

  if exists (
    select 1
    from public.concepts as current_concept
    join public.lists as l
      on l.id = current_concept.list_id
    join public.concepts as other
      on other.list_id = current_concept.list_id
     and other.id <> current_concept.id
     and other.deleted_at is null
     and other.title = v_title
    where current_concept.id = p_concept_id
      and current_concept.deleted_at is null
      and l.owner_id = v_user_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'concept_duplicate';
  end if;

  update public.concepts as c
  set title = v_title,
      description = v_description
  where c.id = p_concept_id
    and c.deleted_at is null
    and c.updated_at = p_expected_updated_at
    and exists (
      select 1
      from public.lists as l
      where l.id = c.list_id
        and l.owner_id = v_user_id
    )
    and not exists (
      select 1
      from public.concepts as other
      where other.list_id = c.list_id
        and other.deleted_at is null
        and other.id <> c.id
        and other.title = v_title
    )
  returning c.* into v_concept;

  if not found then
    if exists (
      select 1
      from public.concepts as c
      where c.id = p_concept_id
        and c.deleted_at is null
        and exists (
          select 1
          from public.lists as l
          where l.id = c.list_id
            and l.owner_id = v_user_id
        )
    ) then
      raise exception using
        errcode = '40001',
        message = 'concept_conflict';
    end if;

    raise exception using
      errcode = '42501',
      message = 'concept_not_found';
  end if;

  return v_concept;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'concept_duplicate';
end;
$$;

create or replace function public.delete_concept(
  p_concept_id uuid,
  p_expected_updated_at timestamptz
)
returns public.concepts
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_concept public.concepts;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'concept_not_authenticated';
  end if;

  update public.concepts as c
  set title = null,
      description = null,
      deleted_at = timezone('utc', now())
  where c.id = p_concept_id
    and c.deleted_at is null
    and c.updated_at = p_expected_updated_at
    and exists (
      select 1
      from public.lists as l
      where l.id = c.list_id
        and l.owner_id = v_user_id
    )
  returning c.* into v_concept;

  if not found then
    if exists (
      select 1
      from public.concepts as c
      where c.id = p_concept_id
        and c.deleted_at is null
        and exists (
          select 1
          from public.lists as l
          where l.id = c.list_id
            and l.owner_id = v_user_id
        )
    ) then
      raise exception using
        errcode = '40001',
        message = 'concept_conflict';
    end if;

    raise exception using
      errcode = '42501',
      message = 'concept_not_found';
  end if;

  return v_concept;
end;
$$;

alter table public.concepts enable row level security;
alter table public.concepts force row level security;

create policy concepts_select_own
on public.concepts
for select
to authenticated
using (
  exists (
    select 1
    from public.lists as l
    where l.id = concepts.list_id
      and l.owner_id = auth.uid()
  )
);

revoke all on table public.concepts from anon, authenticated;
grant select on table public.concepts to authenticated;

revoke all on function public.create_concept(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.create_concepts_batch(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_concept(uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.delete_concept(uuid, timestamptz)
  from public, anon, authenticated;

grant execute on function public.create_concept(uuid, text, text)
  to authenticated;
grant execute on function public.create_concepts_batch(uuid, jsonb)
  to authenticated;
grant execute on function public.update_concept(uuid, text, text, timestamptz)
  to authenticated;
grant execute on function public.delete_concept(uuid, timestamptz)
  to authenticated;
