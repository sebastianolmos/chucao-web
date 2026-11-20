-- The Edge Function reconciles the deletion marker through the Data API.
grant select (user_id, state), update (state, completed_at)
on table public.account_deletion_requests
to service_role;
