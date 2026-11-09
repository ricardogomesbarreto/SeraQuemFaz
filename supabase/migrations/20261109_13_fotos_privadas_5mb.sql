-- SERÁ QUEM FAZ? v3.9.17 — limite uniforme para fotos privadas.
-- Não altera visibilidade, permissões de leitura nem políticas de RLS.
-- O navegador aceita JPG, PNG e WebP e remove metadados na conversão para WebP.
BEGIN;
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id IN ('sqf-account-photos','sqf-client-avatars','sqf-request-attachments');
DO $check$
BEGIN
  IF (SELECT count(*) FROM storage.buckets
      WHERE id IN ('sqf-account-photos','sqf-client-avatars','sqf-request-attachments')
        AND public = false AND file_size_limit = 5242880) <> 3 THEN
    RAISE EXCEPTION 'Faltam buckets privados de imagens ou a configuração é insegura';
  END IF;
END;
$check$;
COMMIT;
