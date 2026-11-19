create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.lists
  add column archived_at timestamptz,
  add column name_search_key text;

-- The derived search-key backfill is not a user edit; preserve each list's
-- existing updated_at value while the current timestamp trigger is bypassed.
alter table public.lists disable trigger lists_set_updated_at;

update public.lists
set name_search_key = lower(extensions.unaccent(name));

alter table public.lists enable trigger lists_set_updated_at;
alter table public.lists alter column name_search_key set not null;

create or replace function public.set_list_search_key()
returns trigger
language plpgsql
set search_path = pg_catalog, extensions
as $$
begin
  new.name_search_key := lower(extensions.unaccent(new.name));
  return new;
end;
$$;

create trigger lists_set_search_key
before insert or update on public.lists
for each row
execute function public.set_list_search_key();

create index lists_collection_name_sort_idx
  on public.lists (owner_id, (archived_at is not null), name_normalized asc, id asc);

create index lists_collection_created_newest_idx
  on public.lists (owner_id, (archived_at is not null), created_at desc, name_normalized asc, id asc);

create index lists_collection_created_oldest_idx
  on public.lists (owner_id, (archived_at is not null), created_at asc, name_normalized asc, id asc);

create index lists_collection_modified_newest_idx
  on public.lists (owner_id, (archived_at is not null), updated_at desc, name_normalized asc, id asc);

create index lists_name_search_gin_idx
  on public.lists using gin (name_search_key extensions.gin_trgm_ops);

create or replace function public.list_owned_lists(
  p_collection text,
  p_search text default null,
  p_sort text default 'name_asc',
  p_cursor_name text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_page_size integer default 51
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  name_normalized text,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_search text := nullif(extensions.unaccent(lower(btrim(p_search))), '');
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'list_not_authenticated';
  end if;

  if p_collection not in ('active', 'archived') then
    raise exception using errcode = '22023', message = 'list_collection_invalid';
  end if;

  if p_sort not in ('name_asc', 'name_desc', 'created_newest', 'created_oldest', 'modified_newest') then
    raise exception using errcode = '22023', message = 'list_sort_invalid';
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 101 then
    raise exception using errcode = '22023', message = 'list_page_size_invalid';
  end if;

  if (p_cursor_id is null and (
        p_cursor_name is not null or p_cursor_created_at is not null or p_cursor_updated_at is not null
      ))
     or (p_cursor_id is not null and p_cursor_name is null)
     or (p_cursor_id is not null and p_sort in ('created_newest', 'created_oldest') and p_cursor_created_at is null)
     or (p_cursor_id is not null and p_sort = 'modified_newest' and p_cursor_updated_at is null) then
    raise exception using errcode = '22023', message = 'list_cursor_invalid';
  end if;

  if v_search is not null then
    -- LIKE metacharacters remain literal user text, in addition to being passed
    -- as RPC parameters rather than interpolated SQL.
    v_search := replace(v_search, E'\\', E'\\\\');
    v_search := replace(v_search, '%', E'\\%');
    v_search := replace(v_search, '_', E'\\_');
  end if;

  return query
  select
    l.id,
    l.owner_id,
    l.name,
    l.name_normalized,
    l.created_at,
    l.updated_at,
    l.archived_at
  from public.lists as l
  where l.owner_id = v_user_id
    and (l.archived_at is not null) = (p_collection = 'archived')
    and (v_search is null or l.name_search_key like '%' || v_search || '%' escape E'\\')
    and case
      when p_cursor_id is null then true
      when p_sort = 'name_asc' then
        l.name_normalized > p_cursor_name
        or (l.name_normalized = p_cursor_name and l.id > p_cursor_id)
      when p_sort = 'name_desc' then
        l.name_normalized < p_cursor_name
        or (l.name_normalized = p_cursor_name and l.id > p_cursor_id)
      when p_sort = 'created_newest' then
        l.created_at < p_cursor_created_at
        or (l.created_at = p_cursor_created_at and
          (l.name_normalized > p_cursor_name or (l.name_normalized = p_cursor_name and l.id > p_cursor_id)))
      when p_sort = 'created_oldest' then
        l.created_at > p_cursor_created_at
        or (l.created_at = p_cursor_created_at and
          (l.name_normalized > p_cursor_name or (l.name_normalized = p_cursor_name and l.id > p_cursor_id)))
      when p_sort = 'modified_newest' then
        l.updated_at < p_cursor_updated_at
        or (l.updated_at = p_cursor_updated_at and
          (l.name_normalized > p_cursor_name or (l.name_normalized = p_cursor_name and l.id > p_cursor_id)))
    end
  order by
    case when p_sort = 'name_asc' then l.name_normalized end asc,
    case when p_sort = 'name_desc' then l.name_normalized end desc,
    case when p_sort = 'created_newest' then l.created_at end desc,
    case when p_sort = 'created_oldest' then l.created_at end asc,
    case when p_sort = 'modified_newest' then l.updated_at end desc,
    case when p_sort in ('created_newest', 'created_oldest', 'modified_newest') then l.name_normalized end asc,
    l.id asc
  limit p_page_size;
end;
$$;

revoke all on function public.set_list_search_key() from public, anon, authenticated;
revoke all on function public.list_owned_lists(text, text, text, text, timestamptz, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_owned_lists(text, text, text, text, timestamptz, timestamptz, uuid, integer)
  to authenticated;
