alter table public.practices alter column list_id drop not null;
alter table public.practices drop constraint practices_identity_check;
alter table public.practices add constraint practices_identity_check check (
  (kind = 'associated'
    and list_id is not null and concept_id is not null
    and title_snapshot is not null and char_length(title_snapshot) between 1 and 50
    and independent_label is null)
  or
  (kind = 'independent'
    and list_id is null and concept_id is null and round_id is null and appearance_id is null
    and title_snapshot is null and independent_label is not null
    and char_length(btrim(independent_label)) between 1 and 50)
);
