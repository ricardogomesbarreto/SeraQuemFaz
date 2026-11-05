-- SERÁ QUEM FAZ? | cadastro público, serviços, portfólio e avaliações.
-- Aplicar no SQL Editor do MESMO projeto Supabase usado pelo site.
-- Pré-requisito: public.categories(id, name, description, image_url, status).
-- O identificador original de categories pode ser UUID ou BIGINT; mantemos
-- category_id como TEXT e validamos sua existência por uma função no Postgres.
-- Roda em Supabase PostgreSQL 15+; não altera as colunas de categories.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuário',
  account_type text not null default 'cliente' check (account_type in ('cliente', 'prestador')),
  city text not null default '',
  bio text not null default '',
  avatar_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(full_name) between 2 and 120),
  constraint profiles_city_length check (char_length(city) <= 100),
  constraint profiles_bio_length check (char_length(bio) <= 1500),
  constraint profiles_avatar_length check (avatar_path is null or char_length(avatar_path) <= 300),
  constraint profiles_avatar_owner check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  constraint profiles_public_provider_only check (account_type = 'prestador' or is_public = false)
);

create or replace function public.sqf_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, account_type)
  values (new.id,
    left(case when char_length(trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))) >= 2
      then trim(new.raw_user_meta_data ->> 'full_name')
      when char_length(coalesce(split_part(new.email, '@', 1), '')) >= 2
      then split_part(new.email, '@', 1)
      else 'Usuário' end, 120),
    case when new.raw_user_meta_data ->> 'account_type' = 'prestador' then 'prestador' else 'cliente' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists sqf_new_user on auth.users;
create trigger sqf_new_user after insert on auth.users
for each row execute procedure public.sqf_user_created();

-- Registrar contas anteriores à migração (sem sobrescrever quem já editou perfil).
-- Nomes de uma letra ou vazios recebem um nome de exibição válido.

insert into public.profiles(id, full_name, account_type)
select u.id,
  left(case when char_length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) >= 2
    then trim(u.raw_user_meta_data ->> 'full_name')
    when char_length(coalesce(split_part(u.email, '@', 1), '')) >= 2
    then split_part(u.email, '@', 1)
    else 'Usuário' end, 120),
  case when u.raw_user_meta_data ->> 'account_type' = 'prestador' then 'prestador' else 'cliente' end
from auth.users u
on conflict (id) do nothing;

-- Aceita qualquer tipo preexistente de ID da tabela categories, mas só um ID válido/ativo.
create or replace function public.sqf_category_available(p_category_id text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.categories c
    where c.id::text = p_category_id and c.status = 'active'
  );
$$;

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  category_id text not null,
  service_title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (provider_id, category_id, service_title),
  constraint service_title_length check (char_length(service_title) between 3 and 100),
  constraint service_description_length check (char_length(description) <= 500),
  constraint service_category_valid check (char_length(category_id) between 1 and 80)
);

create or replace function public.sqf_validate_service_category()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.sqf_category_available(new.category_id) then
    raise exception 'Categoria indisponível';
  end if;
  return new;
end;
$$;
drop trigger if exists sqf_valid_service_category on public.provider_services;
create trigger sqf_valid_service_category before insert or update of category_id
on public.provider_services for each row execute procedure public.sqf_validate_service_category();

create table if not exists public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  caption text not null default '',
  created_at timestamptz not null default now(),
  constraint photo_caption_length check (char_length(caption) <= 160),
  constraint photo_path_length check (char_length(storage_path) <= 300),
  constraint photo_path_owner check (split_part(storage_path, '/', 1) = provider_id::text)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, reviewer_id),
  constraint review_not_self check (provider_id <> reviewer_id),
  constraint review_comment_length check (char_length(trim(comment)) between 15 and 1500)
);

create index if not exists idx_services_category on public.provider_services(category_id);
create index if not exists idx_services_provider on public.provider_services(provider_id);
create index if not exists idx_photos_provider on public.portfolio_photos(provider_id, created_at desc);
create index if not exists idx_reviews_provider on public.reviews(provider_id, created_at desc);

create or replace function public.sqf_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now(); return new;
end;
$$;
drop trigger if exists sqf_profiles_update on public.profiles;
create trigger sqf_profiles_update before update on public.profiles
for each row execute procedure public.sqf_touch_updated_at();
drop trigger if exists sqf_reviews_update on public.reviews;
create trigger sqf_reviews_update before update on public.reviews
for each row execute procedure public.sqf_touch_updated_at();

alter table public.profiles enable row level security;
alter table public.provider_services enable row level security;
alter table public.portfolio_photos enable row level security;
alter table public.reviews enable row level security;

-- Informações públicas só de prestadores que optaram por publicar.
drop policy if exists sqf_profiles_read on public.profiles;
create policy sqf_profiles_read on public.profiles for select to anon, authenticated
using (id = (select auth.uid()) or (account_type = 'prestador' and is_public));
drop policy if exists sqf_profiles_update on public.profiles;
create policy sqf_profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists sqf_services_read on public.provider_services;
create policy sqf_services_read on public.provider_services for select to anon, authenticated
using (provider_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = provider_id and p.is_public and p.account_type = 'prestador'
));
drop policy if exists sqf_services_insert on public.provider_services;
create policy sqf_services_insert on public.provider_services for insert to authenticated
with check (provider_id = (select auth.uid()) and exists (
 select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'prestador'
));
drop policy if exists sqf_services_update on public.provider_services;
create policy sqf_services_update on public.provider_services for update to authenticated
using (provider_id = (select auth.uid()))
with check (provider_id = (select auth.uid()));
drop policy if exists sqf_services_delete on public.provider_services;
create policy sqf_services_delete on public.provider_services for delete to authenticated
using (provider_id = (select auth.uid()));

drop policy if exists sqf_photos_read on public.portfolio_photos;
create policy sqf_photos_read on public.portfolio_photos for select to anon, authenticated
using (provider_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = provider_id and p.is_public and p.account_type = 'prestador'
));
drop policy if exists sqf_photos_insert on public.portfolio_photos;
create policy sqf_photos_insert on public.portfolio_photos for insert to authenticated
with check (provider_id = (select auth.uid()) and split_part(storage_path, '/', 1) = (select auth.uid())::text and
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'prestador'));
drop policy if exists sqf_photos_delete on public.portfolio_photos;
create policy sqf_photos_delete on public.portfolio_photos for delete to authenticated
using (provider_id = (select auth.uid()));

-- Apenas cliente cadastrado pode avaliar. Uma avaliação por cliente/prestador.
-- VERSÃO INICIAL: não prova que um serviço foi efetivamente contratado.
drop policy if exists sqf_reviews_read on public.reviews;
create policy sqf_reviews_read on public.reviews for select to anon, authenticated
using (reviewer_id = (select auth.uid()) or provider_id = (select auth.uid()) or exists (
 select 1 from public.profiles p where p.id = provider_id and p.account_type = 'prestador' and p.is_public
));
drop policy if exists sqf_reviews_insert on public.reviews;
create policy sqf_reviews_insert on public.reviews for insert to authenticated
with check (reviewer_id = (select auth.uid()) and provider_id <> (select auth.uid()) and
 exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'cliente') and
 exists (select 1 from public.profiles p where p.id = provider_id and p.account_type = 'prestador' and p.is_public));
drop policy if exists sqf_reviews_update on public.reviews;
create policy sqf_reviews_update on public.reviews for update to authenticated
using (reviewer_id = (select auth.uid())) with check (reviewer_id = (select auth.uid()) and provider_id <> (select auth.uid()));
drop policy if exists sqf_reviews_delete on public.reviews;
create policy sqf_reviews_delete on public.reviews for delete to authenticated
using (reviewer_id = (select auth.uid()));

-- Bloquear alteração de identidade/papel. Sem INSERT direto de profiles pelo cliente.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (full_name, city, bio, avatar_path, is_public) on public.profiles to authenticated;
grant select on public.provider_services, public.portfolio_photos to anon, authenticated;
-- Não publicar o UUID de clientes avaliadores no endpoint anônimo.
revoke all on public.reviews from anon, authenticated;
grant select (id, provider_id, rating, comment, created_at, updated_at) on public.reviews to anon;
grant select on public.reviews to authenticated;
grant insert, update, delete on public.provider_services to authenticated;
grant insert, delete on public.portfolio_photos to authenticated;
grant delete on public.reviews to authenticated;
grant insert (provider_id, reviewer_id, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;
grant execute on function public.sqf_category_available(text) to authenticated;

-- Buckets PÚBLICOS: todo conteúdo enviado aqui fica acessível via URL.
-- Nunca enviar arquivos pessoais, documentos ou dados sensíveis a esses buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sqf-avatars', 'sqf-avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
       ('sqf-portfolios', 'sqf-portfolios', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sqf_avatar_insert on storage.objects;
create policy sqf_avatar_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sqf-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and
  storage.extension(name) in ('png','jpg','jpeg','webp'));
drop policy if exists sqf_avatar_delete on storage.objects;
create policy sqf_avatar_delete on storage.objects for delete to authenticated
using (bucket_id = 'sqf-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists sqf_portfolio_insert on storage.objects;
create policy sqf_portfolio_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sqf-portfolios' and (storage.foldername(name))[1] = (select auth.uid())::text and
  storage.extension(name) in ('png','jpg','jpeg','webp') and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'prestador'
));
drop policy if exists sqf_portfolio_delete on storage.objects;
create policy sqf_portfolio_delete on storage.objects for delete to authenticated
using (bucket_id = 'sqf-portfolios' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- NOTA LGPD: mesmo após tornar o perfil privado, URLs públicas de mídias já
-- distribuídas podem permanecer acessíveis; considere buckets privados + signed
-- URLs se essa garantia for necessária. Não declarar verificação de contratação.
