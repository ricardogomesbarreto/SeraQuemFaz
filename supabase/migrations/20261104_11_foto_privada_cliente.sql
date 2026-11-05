-- SERÁ QUEM FAZ? v3.9.2 — fotos de clientes em bucket privado.
-- Aplicar SOMENTE após as dez migrações anteriores e após backup/homologação.
-- Não altera o bucket público de prestadores nem os perfis profissionais.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('sqf-client-avatars','sqf-client-avatars',false,1572864,array['image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Criar permissões positivas exclusivamente para o titular da foto.
drop policy if exists sqf_client_avatar_select on storage.objects;
create policy sqf_client_avatar_select on storage.objects for select to authenticated
  using (bucket_id='sqf-client-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='cliente'));

drop policy if exists sqf_client_avatar_insert on storage.objects;
create policy sqf_client_avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id='sqf-client-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
    and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='cliente'));

drop policy if exists sqf_client_avatar_delete on storage.objects;
create policy sqf_client_avatar_delete on storage.objects for delete to authenticated
  using (bucket_id='sqf-client-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='cliente'));

-- Nunca permitir leitura, upload ou exclusão de fotos de clientes de terceiros,
-- mesmo se outra migration futura criar policies permissivas mais abrangentes.
drop policy if exists sqf_client_avatar_select_cap on storage.objects;
create policy sqf_client_avatar_select_cap on storage.objects as restrictive for select to authenticated
  using (bucket_id<>'sqf-client-avatars' or
    ((storage.foldername(name))[1]=(select auth.uid())::text and
     exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='cliente')));
drop policy if exists sqf_client_avatar_insert_cap on storage.objects;
create policy sqf_client_avatar_insert_cap on storage.objects as restrictive for insert to authenticated
  with check (bucket_id<>'sqf-client-avatars' or
    ((storage.foldername(name))[1]=(select auth.uid())::text and
     name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$' and
     exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='cliente')));
drop policy if exists sqf_client_avatar_delete_cap on storage.objects;
create policy sqf_client_avatar_delete_cap on storage.objects as restrictive for delete to authenticated
  using (bucket_id<>'sqf-client-avatars' or (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists sqf_client_avatar_update_cap on storage.objects;
create policy sqf_client_avatar_update_cap on storage.objects as restrictive for update to authenticated
  using (bucket_id<>'sqf-client-avatars')
  with check (bucket_id<>'sqf-client-avatars');

-- Proteção adicional: nenhum cliente recebe capacidade de publicar perfil profissional.
-- A lógica preexistente (account_type, is_public, RLS) permanece válida.
