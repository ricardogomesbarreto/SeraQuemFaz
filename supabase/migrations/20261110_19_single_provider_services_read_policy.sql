-- SERÁ QUEM FAZ? v3.11.2 — consolidar a leitura de serviços em uma única RLS.
-- Migration idempotente. A política redundante não amplia nem restringe acesso.
-- A verificação conservadora impede remoção se alguém mudou as regras de acesso.
BEGIN;
DO $$
DECLARE
  current_policy text;
  duplicate_policy text;
BEGIN
  SELECT pg_get_expr(polqual,polrelid)
    INTO current_policy FROM pg_policy
    WHERE polrelid='public.provider_services'::regclass
      AND polname='sqf_provider_services_read' AND polcmd='r';
  SELECT pg_get_expr(polqual,polrelid)
    INTO duplicate_policy FROM pg_policy
    WHERE polrelid='public.provider_services'::regclass
      AND polname='sqf_services_approval_guard' AND polcmd='r';
  IF current_policy IS NULL THEN
    RAISE EXCEPTION 'Política principal de leitura ausente; interrupção preventiva';
  END IF;
  IF duplicate_policy IS NOT NULL AND current_policy IS DISTINCT FROM duplicate_policy THEN
    RAISE EXCEPTION 'Políticas não equivalentes; revisão manual obrigatória';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='provider_services'
      AND policyname='sqf_provider_services_read'
      AND roles @> ARRAY['anon','authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Política principal mudou de papéis; verificar antes de continuar';
  END IF;
  -- As duas condições eram literalmente idênticas. Preservar a principal.
  DROP POLICY IF EXISTS sqf_services_approval_guard ON public.provider_services;
END;
$$;
COMMIT;
