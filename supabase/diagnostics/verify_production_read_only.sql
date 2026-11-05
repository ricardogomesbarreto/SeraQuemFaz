-- Read-only verification; safe to execute in Supabase SQL Editor. No personal data returned.
SELECT
 (SELECT count(*) FROM auth.users) auth_accounts,
 (SELECT count(*) FROM public.profiles) modern_profiles,
 (SELECT count(*) FROM public.categories WHERE status='active') active_categories,
 (SELECT count(*) FROM public.services) legacy_services,
 (SELECT count(*) FROM public.sqf_ibge_municipalities) ibge_municipalities,
 (SELECT count(*) FROM public.provider_services) provider_services,
 (SELECT count(*) FROM public.sqf_service_requests) requests,
 (SELECT count(*) FROM public.sqf_request_messages) messages,
 (SELECT count(*) FROM public.sqf_billing_subscriptions) subscriptions,
 (SELECT coalesce(require_paid_subscription,false) FROM public.sqf_billing_settings WHERE singleton=true) payment_required;
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
 count(p.policyname) AS rls_policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
WHERE n.nspname='public' AND c.relkind='r'
GROUP BY c.relname,c.relrowsecurity ORDER BY c.relname;
SELECT id,public,file_size_limit FROM storage.buckets ORDER BY id;
