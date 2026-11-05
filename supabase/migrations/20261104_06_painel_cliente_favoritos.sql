-- SERÁ QUEM FAZ? v3.7.0 — Favoritos privados de clientes.
-- PRÉ-REQUISITOS: migrações 01 a 05 aplicadas EM ORDEM em ambiente de homologação.
-- Não modifica tabelas de atendimento, avaliações ou administração.

create table if not exists public.sqf_client_favorites (
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, provider_id),
  constraint sqf_favorite_no_self check (client_id <> provider_id)
);
create index if not exists sqf_favorites_user_recent_idx
  on public.sqf_client_favorites(client_id, created_at desc);

alter table public.sqf_client_favorites enable row level security;
revoke all on public.sqf_client_favorites from public, anon, authenticated;
grant select (client_id, provider_id, created_at) on public.sqf_client_favorites to authenticated;
grant insert (client_id, provider_id) on public.sqf_client_favorites to authenticated;
grant delete on public.sqf_client_favorites to authenticated;

drop policy if exists sqf_favorites_private_read on public.sqf_client_favorites;
create policy sqf_favorites_private_read on public.sqf_client_favorites
  for select to authenticated
  using (client_id=(select auth.uid()));

drop policy if exists sqf_favorites_private_insert on public.sqf_client_favorites;
create policy sqf_favorites_private_insert on public.sqf_client_favorites
  for insert to authenticated
  with check (
    client_id=(select auth.uid())
    and provider_id<>client_id
    and exists (
      select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.account_type='cliente'
    )
    and public.sqf_provider_public(provider_id)
  );

drop policy if exists sqf_favorites_private_delete on public.sqf_client_favorites;
create policy sqf_favorites_private_delete on public.sqf_client_favorites
  for delete to authenticated
  using (client_id=(select auth.uid()));

-- Sem política de UPDATE: favoritos somente podem ser adicionados ou removidos.
-- O catálogo consulta apenas os perfis que continuam públicos e aprovados.
