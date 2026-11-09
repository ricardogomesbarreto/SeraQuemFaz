-- SERÁ QUEM FAZ? — Correção de leitura das 51 categorias ativas por prestadores autenticados.
-- As categorias já existiam. A política anterior cobria só "anon"; "authenticated" via RLS via 0 linhas.
-- Política idempotente e estritamente SELECT, sem abrir INSERT/UPDATE/DELETE.
BEGIN;
DO $policy$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='categories'
     AND policyname='authenticated_read_active_categories'
 ) THEN
   CREATE POLICY authenticated_read_active_categories
     ON public.categories FOR SELECT TO authenticated
     USING (status = 'active');
 END IF;
END;
$policy$;
COMMIT;
