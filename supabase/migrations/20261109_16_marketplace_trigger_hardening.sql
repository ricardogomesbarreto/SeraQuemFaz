-- Reconstituição idempotente do endurecimento já aplicado ao Supabase
-- em 09/11/2026 (sqf_marketplace_trigger_hardening_20261109).
-- Funções de gatilho nunca devem ser executáveis diretamente via Data API.
BEGIN;
REVOKE ALL ON FUNCTION public.sqf_notify_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sqf_notify_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sqf_notify_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sqf_queue_notification_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sqf_support_rate_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sqf_notify_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.sqf_notify_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.sqf_notify_appointment() TO service_role;
GRANT EXECUTE ON FUNCTION public.sqf_queue_notification_email() TO service_role;
GRANT EXECUTE ON FUNCTION public.sqf_support_rate_guard() TO service_role;
COMMIT;
