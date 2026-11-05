-- SERÁ QUEM FAZ? v3.7.1 — campos profissionais opcionais
-- APLICAR SOMENTE EM HOMOLOGAÇÃO após as migrações 01 a 06.
-- Preserva perfis e serviços anteriores; não armazena CPF, documentos,
-- endereço residencial, informações bancárias ou avaliações nesta tabela.
-- Nenhum dado deste cadastro comprova formação ou habilitação profissional.

create table if not exists public.provider_professional_details (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  professional_title text not null default '',
  specialties text not null default '',
  experience_years smallint,
  service_mode text not null default 'nao_informado',
  coverage_area text not null default '',
  workdays integer[] not null default '{}'::integer[],
  work_period text not null default 'nao_informado',
  quote_policy text not null default 'sob_consulta',
  professional_website text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sqf_details_title_length check (char_length(professional_title) <= 100),
  constraint sqf_details_specialties_length check (char_length(specialties) <= 220),
  constraint sqf_details_experience_range check (experience_years is null or experience_years between 0 and 60),
  constraint sqf_details_mode_valid check (service_mode in ('nao_informado','presencial','remoto','hibrido')),
  constraint sqf_details_coverage_length check (char_length(coverage_area) <= 240),
  constraint sqf_details_weekdays_valid check (
    cardinality(workdays) <= 7 and workdays <@ array[1,2,3,4,5,6,7]::integer[]
  ),
  constraint sqf_details_period_valid check (work_period in ('nao_informado','manha','tarde','noite','flexivel')),
  constraint sqf_details_quote_valid check (quote_policy in ('sob_consulta','orcamento_gratuito','orcamento_pago')),
  constraint sqf_details_website_valid check (
    professional_website = '' or
    (char_length(professional_website) <= 300 and professional_website ~ '^https://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$')
  )
);

comment on table public.provider_professional_details is
  'Dados complementares de atendimento declarados pelo prestador, sujeitos a revisão; não representam certificação.';

alter table public.provider_professional_details enable row level security;
revoke all on table public.provider_professional_details from public, anon, authenticated;
grant select on public.provider_professional_details to anon, authenticated;
grant insert on public.provider_professional_details to authenticated;
grant update (professional_title,specialties,experience_years,service_mode,coverage_area,
  workdays,work_period,quote_policy,professional_website)
  on public.provider_professional_details to authenticated;

-- Dados não ficam públicos antes da aprovação (verificação + perfil público).
drop policy if exists sqf_details_select on public.provider_professional_details;
create policy sqf_details_select on public.provider_professional_details
  for select to anon,authenticated
  using (provider_id = (select auth.uid()) or public.sqf_provider_public(provider_id));

drop policy if exists sqf_details_insert on public.provider_professional_details;
create policy sqf_details_insert on public.provider_professional_details
  for insert to authenticated
  with check (
    provider_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = provider_id and p.account_type = 'prestador'
    )
  );

drop policy if exists sqf_details_update on public.provider_professional_details;
create policy sqf_details_update on public.provider_professional_details
  for update to authenticated
  using (provider_id = (select auth.uid()))
  with check (
    provider_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = provider_id and p.account_type = 'prestador'
    )
  );

-- Uma edição do perfil público aprovado requer nova revisão, tal como a
-- alteração de serviços e portfólio já exige nas migrações anteriores.
create or replace function public.sqf_details_review_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.provider_id is distinct from old.provider_id then
      raise exception 'Não é possível transferir dados profissionais entre contas';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.sqf_details_review_guard() from public, anon, authenticated;
drop trigger if exists sqf_details_guard on public.provider_professional_details;
create trigger sqf_details_guard before update on public.provider_professional_details
  for each row execute function public.sqf_details_review_guard();

create or replace function public.sqf_details_require_reapproval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if row(old.professional_title,old.specialties,old.experience_years,old.service_mode,
          old.coverage_area,old.workdays,old.work_period,old.quote_policy,old.professional_website)
       is not distinct from
       row(new.professional_title,new.specialties,new.experience_years,new.service_mode,
          new.coverage_area,new.workdays,new.work_period,new.quote_policy,new.professional_website)
    then
      return null;
    end if;
  end if;
  update public.provider_verifications
    set status = 'pending', reviewed_at = null, reviewed_by = null
    where provider_id = new.provider_id and status = 'approved';
  return null;
end;
$$;
revoke all on function public.sqf_details_require_reapproval() from public, anon, authenticated;
drop trigger if exists sqf_details_reapproval on public.provider_professional_details;
create trigger sqf_details_reapproval
  after insert or update on public.provider_professional_details
  for each row execute function public.sqf_details_require_reapproval();

-- Revisão administrativa com MFA: não abre acesso direto à tabela privada de
-- prestadores pendentes, nem amplia privilégios de moderadores.
create or replace function public.sqf_staff_provider_professional_details(p_provider uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.sqf_require_staff(true);
  if p_provider is null then return null; end if;
  return (
    select pg_catalog.jsonb_build_object(
      'professional_title',d.professional_title,
      'specialties',d.specialties,
      'experience_years',d.experience_years,
      'service_mode',d.service_mode,
      'coverage_area',d.coverage_area,
      'workdays',d.workdays,
      'work_period',d.work_period,
      'quote_policy',d.quote_policy,
      'professional_website',d.professional_website,
      'updated_at',d.updated_at
    )
    from public.provider_professional_details d where d.provider_id=p_provider
  );
end;
$$;
revoke all on function public.sqf_staff_provider_professional_details(uuid) from public,anon,authenticated;
grant execute on function public.sqf_staff_provider_professional_details(uuid) to authenticated;
