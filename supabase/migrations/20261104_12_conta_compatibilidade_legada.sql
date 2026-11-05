-- SERÁ QUEM FAZ? v3.9.4 — Compatibilidade de conta com esquema legado.
-- Aplicar primeiro EM HOMOLOGAÇÃO e com backup. Não apaga nem modifica
-- public.users, user_profiles, providers, categories ou services.
-- Compatível com contas existentes no auth.users; não atribui aprovação
-- de prestador, acesso administrativo nem autorização de publicação.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.sqf_account_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 120),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 120),
  state text CHECK (state IS NULL OR state ~ '^[A-Z]{2}$'),
  avatar_path text CHECK (avatar_path IS NULL OR (
    avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
    AND split_part(avatar_path,'/',1)=user_id::text
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sqf_account_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sqf_account_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_account_settings FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sqf_account_settings TO authenticated;
DROP POLICY IF EXISTS sqf_account_own_select ON public.sqf_account_settings;
DROP POLICY IF EXISTS sqf_account_own_insert ON public.sqf_account_settings;
DROP POLICY IF EXISTS sqf_account_own_update ON public.sqf_account_settings;
DROP POLICY IF EXISTS sqf_account_own_delete ON public.sqf_account_settings;
CREATE POLICY sqf_account_own_select ON public.sqf_account_settings
  FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE POLICY sqf_account_own_insert ON public.sqf_account_settings
  FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY sqf_account_own_update ON public.sqf_account_settings
  FOR UPDATE TO authenticated USING (user_id=(select auth.uid()))
  WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY sqf_account_own_delete ON public.sqf_account_settings
  FOR DELETE TO authenticated USING (user_id=(select auth.uid()));
-- Proteções restritivas: uma política permissiva adicional nunca dá acesso
-- a dados de outra conta.
DROP POLICY IF EXISTS sqf_account_read_guard ON public.sqf_account_settings;
DROP POLICY IF EXISTS sqf_account_insert_guard ON public.sqf_account_settings;
DROP POLICY IF EXISTS sqf_account_update_guard ON public.sqf_account_settings;
DROP POLICY IF EXISTS sqf_account_delete_guard ON public.sqf_account_settings;
CREATE POLICY sqf_account_read_guard ON public.sqf_account_settings AS RESTRICTIVE
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE POLICY sqf_account_insert_guard ON public.sqf_account_settings AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY sqf_account_update_guard ON public.sqf_account_settings AS RESTRICTIVE
 FOR UPDATE TO authenticated USING (user_id=(select auth.uid()))
 WITH CHECK(user_id=(select auth.uid()));
CREATE POLICY sqf_account_delete_guard ON public.sqf_account_settings AS RESTRICTIVE
 FOR DELETE TO authenticated USING (user_id=(select auth.uid()));

-- Backfill de dados não sensíveis do esquema anterior, caso exista.
-- Não cria usuários de Auth e não modifica dados preexistentes.
DO $sql$
BEGIN
 IF to_regclass('public.user_profiles') IS NOT NULL THEN
   EXECUTE $backfill$
     INSERT INTO public.sqf_account_settings(user_id,display_name,city,state)
     SELECT a.id,
       left(CASE WHEN char_length(btrim(coalesce(up.name,''))) BETWEEN 2 AND 120 THEN btrim(up.name)
         WHEN char_length(btrim(coalesce(a.raw_user_meta_data->>'full_name',''))) BETWEEN 2 AND 120
           THEN btrim(a.raw_user_meta_data->>'full_name')
         ELSE 'Usuário' END,120),
       left(coalesce(up.city,''),120),
       CASE WHEN upper(coalesce(up.state,'')) ~ '^[A-Z]{2}$' THEN upper(up.state) ELSE NULL END
     FROM auth.users a LEFT JOIN public.user_profiles up ON up.user_id=a.id
     ON CONFLICT(user_id) DO NOTHING
   $backfill$;
 ELSE
   INSERT INTO public.sqf_account_settings(user_id,display_name)
   SELECT a.id,
     left(CASE WHEN char_length(btrim(coalesce(a.raw_user_meta_data->>'full_name',''))) >= 2
     THEN btrim(a.raw_user_meta_data->>'full_name') ELSE 'Usuário' END,120)
   FROM auth.users a ON CONFLICT(user_id) DO NOTHING;
 END IF;
END;
$sql$;

-- Fotos da conta: bucket PRIVADO. Nunca compartilhar URL pública.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('sqf-account-photos','sqf-account-photos',false,1572864,array['image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

DROP POLICY IF EXISTS sqf_account_photo_read ON storage.objects;
DROP POLICY IF EXISTS sqf_account_photo_insert ON storage.objects;
DROP POLICY IF EXISTS sqf_account_photo_delete ON storage.objects;
DROP POLICY IF EXISTS sqf_account_photo_read_guard ON storage.objects;
DROP POLICY IF EXISTS sqf_account_photo_insert_guard ON storage.objects;
DROP POLICY IF EXISTS sqf_account_photo_delete_guard ON storage.objects;
DROP POLICY IF EXISTS sqf_account_photo_update_guard ON storage.objects;
CREATE POLICY sqf_account_photo_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='sqf-account-photos' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY sqf_account_photo_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='sqf-account-photos'
 AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$');
CREATE POLICY sqf_account_photo_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='sqf-account-photos' AND (storage.foldername(name))[1]=(select auth.uid())::text);
-- Barreiras restritivas impedem vazamento mesmo se outra policy permissiva
-- for criada futuramente para storage.objects.
CREATE POLICY sqf_account_photo_read_guard ON storage.objects AS RESTRICTIVE
 FOR SELECT TO authenticated USING(bucket_id<>'sqf-account-photos'
 OR (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY sqf_account_photo_insert_guard ON storage.objects AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK(bucket_id<>'sqf-account-photos'
 OR ((storage.foldername(name))[1]=(select auth.uid())::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'));
CREATE POLICY sqf_account_photo_delete_guard ON storage.objects AS RESTRICTIVE
 FOR DELETE TO authenticated USING(bucket_id<>'sqf-account-photos'
 OR (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY sqf_account_photo_update_guard ON storage.objects AS RESTRICTIVE
 FOR UPDATE TO authenticated USING(bucket_id<>'sqf-account-photos')
 WITH CHECK(bucket_id<>'sqf-account-photos');

-- Não criar e nem aprovar public.profiles nesta migração.
NOTIFY pgrst, 'reload schema';
COMMIT;
