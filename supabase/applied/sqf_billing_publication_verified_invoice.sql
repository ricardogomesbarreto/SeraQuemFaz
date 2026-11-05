-- Migration registered remotely as sqf_billing_publication_verified_invoice.
-- Use verified invoice rows so a stale paid_until cache cannot authorize publication.
create or replace function public.sqf_billing_permits_publication(p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select require_paid_subscription from public.sqf_billing_settings where singleton) is false
      then true
    else exists (
      select 1
      from public.sqf_billing_subscriptions s
      join public.sqf_billing_invoices i on i.subscription_id = s.id
      where s.user_id = p_provider
        and i.status = 'approved'
        and i.currency = s.currency
        and i.amount_cents = s.price_cents
        and i.paid_at <= now()
        and i.paid_period_end > now()
    )
  end;
$$;

revoke execute on function public.sqf_billing_permits_publication(uuid) from public, anon, authenticated;
