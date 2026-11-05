-- Migration registered remotely as sqf_dashboard_request_summary.
create function public.sqf_dashboard_request_summary()
returns table (active_count bigint, quote_count bigint, ongoing_count bigint, completed_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where r.status not in ('completed', 'declined', 'canceled')),
    count(*) filter (where r.status = 'quoted'),
    count(*) filter (where r.status in ('accepted', 'in_progress', 'awaiting_confirmation')),
    count(*) filter (where r.status = 'completed')
  from public.sqf_service_requests as r
  where r.client_id = (select auth.uid()) or r.provider_id = (select auth.uid());
$$;

revoke execute on function public.sqf_dashboard_request_summary() from public, anon;
grant execute on function public.sqf_dashboard_request_summary() to authenticated;
