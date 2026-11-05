-- SOMENTE LEITURA. Executar em SQL Editor do Supabase da aplicação.
SELECT
 to_regclass('public.users') AS users,
 to_regclass('public.user_profiles') AS user_profiles,
 to_regclass('public.providers') AS providers,
 to_regclass('public.services') AS services,
 to_regclass('public.categories') AS categories,
 to_regclass('public.profiles') AS profiles,
 to_regclass('public.provider_services') AS provider_services,
 to_regclass('public.sqf_account_settings') AS sqf_account_settings,
 to_regclass('public.sqf_service_requests') AS sqf_service_requests,
 to_regclass('public.sqf_request_messages') AS sqf_request_messages;
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies WHERE schemaname='public'
  AND tablename IN('users','user_profiles','providers','profiles','sqf_account_settings','sqf_service_requests','sqf_request_messages')
ORDER BY tablename, policyname;
SELECT name, public FROM storage.buckets
WHERE name IN('sqf-account-photos','sqf-client-avatars','sqf-avatars');
SELECT status,count(*) AS total FROM public.categories GROUP BY status ORDER BY status;
