-- SERÁ QUEM FAZ? v3.11.0 — serviços, capa de portfólio e categorias favoritas.
-- Migração aditiva: preserva todos os dados e políticas de escrita existentes.
BEGIN;

ALTER TABLE public.provider_services
  ADD COLUMN IF NOT EXISTS price_min_cents integer,
  ADD COLUMN IF NOT EXISTS price_max_cents integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DO $check$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sqf_provider_services_price_bounds') THEN
  ALTER TABLE public.provider_services ADD CONSTRAINT sqf_provider_services_price_bounds CHECK (
    (price_min_cents IS NULL AND price_max_cents IS NULL)
    OR (price_min_cents BETWEEN 0 AND 100000000
        AND price_max_cents BETWEEN price_min_cents AND 100000000)
  );
 END IF;
END;
$check$;

-- O prestador consegue ver seus serviços inativos; para os demais,
-- somente serviços ativos de um perfil legitimamente publicado.
DROP POLICY IF EXISTS sqf_provider_services_read ON public.provider_services;
CREATE POLICY sqf_provider_services_read ON public.provider_services
  FOR SELECT TO anon,authenticated
  USING (
    provider_id=(SELECT auth.uid())
    OR (is_active=true AND public.sqf_provider_public(provider_id))
  );
DROP POLICY IF EXISTS sqf_services_approval_guard ON public.provider_services;
CREATE POLICY sqf_services_approval_guard ON public.provider_services
  FOR SELECT TO anon,authenticated
  USING (
    provider_id=(SELECT auth.uid())
    OR (is_active=true AND public.sqf_provider_public(provider_id))
  );

ALTER TABLE public.portfolio_photos
 ADD COLUMN IF NOT EXISTS is_cover boolean NOT NULL DEFAULT false;

-- Capa única por serviço ou do portfólio geral (sem vínculo).
CREATE UNIQUE INDEX IF NOT EXISTS sqf_portfolio_cover_per_service
 ON public.portfolio_photos(provider_id,service_id)
 WHERE is_cover=true AND service_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sqf_portfolio_cover_general
 ON public.portfolio_photos(provider_id) WHERE is_cover=true AND service_id IS NULL;

-- Alteração da capa requer vínculo de propriedade e é atômica;
-- não conceder UPDATE direto sobre fotografias.
CREATE OR REPLACE FUNCTION public.sqf_set_portfolio_cover(p_photo uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid := (SELECT auth.uid());
 target public.portfolio_photos%ROWTYPE;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
 SELECT * INTO target FROM public.portfolio_photos
 WHERE id=p_photo AND provider_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fotografia indisponível'; END IF;
 UPDATE public.portfolio_photos
   SET is_cover=false
   WHERE provider_id=actor
     AND service_id IS NOT DISTINCT FROM target.service_id
     AND is_cover=true;
 UPDATE public.portfolio_photos SET is_cover=true
 WHERE id=target.id AND provider_id=actor;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_set_portfolio_cover(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_set_portfolio_cover(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.sqf_client_category_favorites(
 client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (client_id,category_id)
);
CREATE INDEX IF NOT EXISTS sqf_category_favorites_category_idx
 ON public.sqf_client_category_favorites(category_id);
ALTER TABLE public.sqf_client_category_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_client_category_favorites FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.sqf_client_category_favorites TO authenticated;
DROP POLICY IF EXISTS sqf_category_favorites_owner_read ON public.sqf_client_category_favorites;
CREATE POLICY sqf_category_favorites_owner_read ON public.sqf_client_category_favorites
 FOR SELECT TO authenticated USING(client_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS sqf_category_favorites_owner_add ON public.sqf_client_category_favorites;
CREATE POLICY sqf_category_favorites_owner_add ON public.sqf_client_category_favorites
 FOR INSERT TO authenticated WITH CHECK(
  client_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.account_type='cliente')
  AND EXISTS(SELECT 1 FROM public.categories c WHERE c.id=category_id AND c.status='active')
 );
DROP POLICY IF EXISTS sqf_category_favorites_owner_delete ON public.sqf_client_category_favorites;
CREATE POLICY sqf_category_favorites_owner_delete ON public.sqf_client_category_favorites
 FOR DELETE TO authenticated USING(client_id=(SELECT auth.uid()));

COMMIT;
