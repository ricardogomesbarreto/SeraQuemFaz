-- SERÁ QUEM FAZ? v3.8.0 — Assinaturas Mercado Pago, sem cobrança automática ativada.
-- Aplicar após as migrações 01–07, primeiro em homologação e com backup.
-- Somente Edge Functions usando service_role podem modificar estes dados.
-- A cobrança pode ser ativada depois de homologada. O controle de publicação fica DESATIVADO por padrão.

create extension if not exists pgcrypto;

create table if not exists public.sqf_billing_settings (
  singleton boolean primary key default true check(singleton),
  require_paid_subscription boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.sqf_billing_settings (singleton, require_paid_subscription)
values (true,false) on conflict (singleton) do nothing;

create table if not exists public.sqf_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  external_reference uuid not null unique default gen_random_uuid(),
  mp_preapproval_id text unique,
  checkout_url text,
  cycle text not null check(cycle in ('monthly','yearly')),
  price_cents integer not null check(price_cents in (1490,14900)),
  currency text not null default 'BRL' check(currency='BRL'),
  state text not null default 'creating' check(state in ('creating','pending','authorized','paused','canceled','failed')),
  paid_until timestamptz,
  cancel_requested_at timestamptz,
  canceled_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sqf_billing_price_cycle check((cycle='monthly' and price_cents=1490) or (cycle='yearly' and price_cents=14900)),
  constraint sqf_billing_mp_identifier check(mp_preapproval_id is null or char_length(mp_preapproval_id) between 8 and 120)
);
create index if not exists sqf_billing_by_provider_id on public.sqf_billing_subscriptions(mp_preapproval_id);

create table if not exists public.sqf_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.sqf_billing_subscriptions(id) on delete cascade,
  mp_invoice_id text not null unique,
  mp_payment_id text,
  status text not null check(status in ('approved','pending','rejected','refunded','charged_back')),
  amount_cents integer not null check(amount_cents > 0),
  currency text not null default 'BRL' check(currency='BRL'),
  paid_at timestamptz,
  paid_period_end timestamptz,
  verified_at timestamptz not null default now(),
  constraint sqf_invoice_approved_period check (
    status <> 'approved' or (paid_at is not null and paid_period_end is not null)
  )
);
create unique index if not exists sqf_invoice_payment_unique
  on public.sqf_billing_invoices(mp_payment_id) where mp_payment_id is not null;
create index if not exists sqf_invoices_by_subscription on public.sqf_billing_invoices(subscription_id,status,paid_period_end);

alter table public.sqf_billing_settings enable row level security;
alter table public.sqf_billing_subscriptions enable row level security;
alter table public.sqf_billing_invoices enable row level security;
revoke all on public.sqf_billing_settings from public,anon,authenticated;
revoke all on public.sqf_billing_subscriptions from public,anon,authenticated;
revoke all on public.sqf_billing_invoices from public,anon,authenticated;
-- Nenhuma policy para usuários. service_role, em funções confiáveis, faz leitura e escrita.

-- Pagamento NÃO substitui análise cadastral. Ao habilitar o controle comercial, o perfil
-- aprovado só é público se existir período já pago e ainda vigente.
create or replace function public.sqf_billing_permits_publication(p_provider uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when not (select require_paid_subscription from public.sqf_billing_settings where singleton=true)
      then true
    else exists (
      select 1 from public.sqf_billing_subscriptions s
      where s.user_id = p_provider and s.paid_until > now()
    )
  end;
$$;
revoke all on function public.sqf_billing_permits_publication(uuid) from public,anon,authenticated;
-- Função chamada indiretamente por sqf_provider_public; não concede alteração de pagamento.

create or replace function public.sqf_provider_public(p_provider uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.provider_verifications v on v.provider_id = p.id
    where p.id = p_provider and p.account_type = 'prestador' and p.is_public
      and v.status = 'approved' and public.sqf_billing_permits_publication(p.id)
  );
$$;
revoke all on function public.sqf_provider_public(uuid) from public,anon,authenticated;
grant execute on function public.sqf_provider_public(uuid) to anon,authenticated;

-- A troca do modo para cobrança obrigatória deve ser feita exclusivamente após homologação,
-- pelo administrador no SQL Editor (jamais pelo browser ou por um prestador).
-- update public.sqf_billing_settings set require_paid_subscription=true,updated_at=now() where singleton=true;
