create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.lists (id) on delete set null,
  status text not null default 'open',
  opened_at timestamptz,
  closed_at timestamptz,
  anonymous_appearance_total bigint,
  created_at timestamptz default timezone('utc', now()),
  constraint rounds_status_check check (status in ('open', 'closed')),
  constraint rounds_lifecycle_check check (
    (
      list_id is not null
      and created_at is not null
      and opened_at is not null
      and anonymous_appearance_total is null
      and (
        (status = 'open' and closed_at is null)
        or (status = 'closed' and closed_at is not null)
      )
    )
    or (
      list_id is null
      and status = 'closed'
      and created_at is null
      and opened_at is null
      and closed_at is null
      and anonymous_appearance_total is not null
      and anonymous_appearance_total >= 0
    )
  )
);

create unique index rounds_one_open_per_list_key
  on public.rounds (list_id)
  where status = 'open' and list_id is not null;

create index rounds_list_history_idx
  on public.rounds (list_id, opened_at desc, id)
  where list_id is not null;

comment on column public.rounds.anonymous_appearance_total is
  'For a detached, anonymized round only: total appearances retained without event-level history.';

create table public.round_appearances (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete restrict,
  appearance_order bigint not null,
  origin text not null,
  title_snapshot text,
  concept_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint round_appearances_order_check check (appearance_order > 0),
  constraint round_appearances_origin_check check (origin in ('draw', 'manual')),
  constraint round_appearances_title_snapshot_check check (
    (concept_deleted and title_snapshot is null)
    or (
      not concept_deleted
      and title_snapshot is not null
      and char_length(title_snapshot) between 1 and 50
    )
  ),
  constraint round_appearances_round_order_key unique (round_id, appearance_order)
);

create index round_appearances_concept_id_idx
  on public.round_appearances (concept_id)
  where concept_id is not null;

create table public.round_operations (
  list_id uuid not null references public.lists (id) on delete cascade,
  operation_id uuid not null,
  round_id uuid not null references public.rounds (id) on delete cascade,
  action text not null,
  outcome text not null,
  appearance_id uuid references public.round_appearances (id) on delete set null,
  concept_id uuid references public.concepts (id) on delete set null,
  result_state text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint round_operations_action_check check (
    action in ('mark_seen', 'draw', 'return_pending', 'new_round')
  ),
  constraint round_operations_outcome_check check (
    outcome in ('applied', 'rejected', 'exhausted')
  ),
  constraint round_operations_result_state_check check (
    result_state is null or result_state in ('pending', 'seen', 'closed')
  ),
  constraint round_operations_list_operation_key primary key (list_id, operation_id)
);

create index round_operations_round_id_idx
  on public.round_operations (round_id);

alter table public.rounds enable row level security;
alter table public.rounds force row level security;

alter table public.round_appearances enable row level security;
alter table public.round_appearances force row level security;

alter table public.round_operations enable row level security;
alter table public.round_operations force row level security;

create policy rounds_select_own
on public.rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.lists as l
    where l.id = rounds.list_id
      and l.owner_id = auth.uid()
  )
);

create policy round_appearances_select_own
on public.round_appearances
for select
to authenticated
using (
  exists (
    select 1
    from public.rounds as r
    join public.lists as l on l.id = r.list_id
    where r.id = round_appearances.round_id
      and l.owner_id = auth.uid()
  )
);

revoke all on table public.rounds from anon, authenticated;
revoke all on table public.round_appearances from anon, authenticated;
revoke all on table public.round_operations from anon, authenticated;

grant select on table public.rounds to authenticated;
grant select on table public.round_appearances to authenticated;
