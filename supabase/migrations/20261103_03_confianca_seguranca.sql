-- SERÁ QUEM FAZ? v3.4.0 · segurança e confiança
-- DEPENDE das migrações 01 e 02. Aplicar em HOMOLOGAÇÃO, depois de backup.
-- O acesso público passa a exigir aprovação manual. Sem aprovação, perfil é invisível.
-- Importante: revisar policies adicionais instaladas anteriormente; policies RLS são OR entre si.
-- NÃO inserir documentos pessoais neste banco nem em buckets públicos.

create extension if not exists pgcrypto;

-- A aprovação não é uma declaração de inexistência de antecedentes nem garantia de segurança.
-- Apenas administradores via SQL Editor/service_role devem aprovar e suspender.
create table if not exists public.provider_verifications (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  internal_note text not null default '' check (char_length(internal_note) <= 2000)
);
create index if not exists sqf_verification_status_idx on public.provider_verifications(status);
alter table public.provider_verifications enable row level security;
revoke all on public.provider_verifications from anon, authenticated;
grant select (provider_id,status,requested_at,reviewed_at) on public.provider_verifications to authenticated;
drop policy if exists sqf_verification_owner on public.provider_verifications;
create policy sqf_verification_owner on public.provider_verifications for select to authenticated
  using (provider_id = (select auth.uid()));

-- Consultas SECURITY DEFINER usam schema explícito, não aceitam role informada pelo navegador.
create or replace function public.sqf_email_confirmed(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user = (select auth.uid()) and exists (
    select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.sqf_email_confirmed(uuid) from public, anon, authenticated;
grant execute on function public.sqf_email_confirmed(uuid) to authenticated;

create or replace function public.sqf_provider_public(p_provider uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.provider_verifications v on v.provider_id = p.id
    where p.id = p_provider and p.account_type = 'prestador' and p.is_public
      and v.status = 'approved'
  );
$$;
revoke all on function public.sqf_provider_public(uuid) from public, anon, authenticated;
grant execute on function public.sqf_provider_public(uuid) to anon, authenticated;

-- Solicitação não verifica identidade automaticamente. Requer e-mail, dados e serviço.
create or replace function public.sqf_request_verification()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid := (select auth.uid()); v_record public.profiles%rowtype; v_status text;
begin
  if v_id is null or not public.sqf_email_confirmed(v_id) then
    raise exception 'Confirme seu e-mail antes de solicitar análise';
  end if;
  select * into v_record from public.profiles where id = v_id;
  if not found or v_record.account_type <> 'prestador' or v_record.city_ibge is null
     or length(trim(v_record.full_name)) < 4 or length(trim(v_record.bio)) < 40
     or v_record.avatar_path is null then
    raise exception 'Complete foto, nome, cidade e apresentação (40 caracteres)';
  end if;
  if not exists (select 1 from public.provider_services s where s.provider_id = v_id) then
    raise exception 'Cadastre pelo menos um serviço antes da análise';
  end if;
  select status into v_status from public.provider_verifications where provider_id = v_id for update;
  if v_status = 'approved' then return 'approved'; end if;
  if v_status = 'suspended' then raise exception 'Conta suspensa: solicite revisão administrativa'; end if;
  if v_status is null then
    insert into public.provider_verifications (provider_id) values (v_id);
  elsif v_status = 'rejected' then
    update public.provider_verifications set status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null
      where provider_id = v_id;
  end if;
  return 'pending';
end;
$$;
revoke all on function public.sqf_request_verification() from public, anon, authenticated;
grant execute on function public.sqf_request_verification() to authenticated;

-- Novas RLS: usuário vê o próprio perfil; visitantes só prestadores aprovados e publicados.
drop policy if exists sqf_profiles_read on public.profiles;
create policy sqf_profiles_read on public.profiles for select to anon, authenticated
  using (id = (select auth.uid()) or public.sqf_provider_public(id));
drop policy if exists sqf_services_read on public.provider_services;
create policy sqf_services_read on public.provider_services for select to anon, authenticated
  using (provider_id = (select auth.uid()) or public.sqf_provider_public(provider_id));
drop policy if exists sqf_photos_read on public.portfolio_photos;
create policy sqf_photos_read on public.portfolio_photos for select to anon, authenticated
  using (provider_id = (select auth.uid()) or public.sqf_provider_public(provider_id));

-- Registro bilateral mínimo de atendimento: apenas ID das contas, sem documentos nem endereço.
create table if not exists public.service_engagements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','confirmed')),
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (client_id, provider_id),
  constraint sqf_engagement_no_self check (client_id <> provider_id)
);
create index if not exists sqf_engagement_provider_idx on public.service_engagements(provider_id,status);
alter table public.service_engagements enable row level security;
revoke all on public.service_engagements from anon, authenticated;
grant select on public.service_engagements to authenticated;
grant insert (client_id,provider_id) on public.service_engagements to authenticated;
grant update (status) on public.service_engagements to authenticated;
drop policy if exists sqf_engagement_read on public.service_engagements;
create policy sqf_engagement_read on public.service_engagements for select to authenticated
 using (client_id = (select auth.uid()) or provider_id = (select auth.uid()));
drop policy if exists sqf_engagement_insert on public.service_engagements;
create policy sqf_engagement_insert on public.service_engagements for insert to authenticated
 with check (client_id = (select auth.uid()) and client_id <> provider_id
   and public.sqf_email_confirmed(client_id) and public.sqf_provider_public(provider_id)
   and exists (select 1 from public.profiles p where p.id = client_id and p.account_type='cliente'));
drop policy if exists sqf_engagement_confirm on public.service_engagements;
create policy sqf_engagement_confirm on public.service_engagements for update to authenticated
 using (provider_id=(select auth.uid()) and status='requested' and public.sqf_provider_public(provider_id))
 with check (provider_id=(select auth.uid()) and status='confirmed');
create or replace function public.sqf_engagement_confirmation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.client_id <> new.client_id or old.provider_id <> new.provider_id or old.status <> 'requested' or new.status <> 'confirmed' then
      raise exception 'Transição de atendimento inválida';
    end if;
    new.confirmed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists sqf_engagement_confirmation on public.service_engagements;
create trigger sqf_engagement_confirmation before update on public.service_engagements
for each row execute function public.sqf_engagement_confirmation();

-- Avaliações antigas sem atendimento vinculado passam a 'pending' (não públicas).
-- Novas avaliações exigem atendimento confirmado + moderação.
alter table public.reviews add column if not exists engagement_id uuid references public.service_engagements(id);
alter table public.reviews add column if not exists moderation_status text not null default 'pending';
alter table public.reviews add column if not exists moderated_at timestamptz;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='sqf_review_moderation_state' and conrelid='public.reviews'::regclass) then
    alter table public.reviews add constraint sqf_review_moderation_state
      check (moderation_status in ('pending','published','rejected','hidden'));
  end if;
end $$;
create unique index if not exists sqf_reviews_engagement_unique on public.reviews(engagement_id) where engagement_id is not null;
update public.reviews set moderation_status='pending' where engagement_id is null;

create or replace function public.sqf_review_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.provider_id <> old.provider_id or new.reviewer_id <> old.reviewer_id
      or new.engagement_id is distinct from old.engagement_id) then
    raise exception 'Não é permitido trocar a identidade ou o atendimento da avaliação';
  end if;
  if new.engagement_id is null or not exists(
    select 1 from public.service_engagements e where e.id=new.engagement_id
      and e.provider_id=new.provider_id and e.client_id=new.reviewer_id and e.status='confirmed') then
    if tg_op = 'INSERT' or new.moderation_status='published' then
      raise exception 'Avaliação exige atendimento confirmado';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.moderation_status='published' and
     (new.rating <> old.rating or new.comment <> old.comment) then
    raise exception 'Avaliação publicada é imutável';
  end if;
  if new.moderation_status='published' then
    if tg_op='INSERT' then
      new.moderated_at := now();
    elsif old.moderation_status <> 'published' then
      new.moderated_at := now();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists sqf_review_integrity on public.reviews;
create trigger sqf_review_integrity before insert or update on public.reviews
  for each row execute function public.sqf_review_integrity();

-- Nenhum UUID de avaliador aparece na API pública. Apenas o autor acessa sua linha original.
drop policy if exists sqf_reviews_read on public.reviews;
create policy sqf_reviews_read on public.reviews for select to authenticated
 using (reviewer_id = (select auth.uid()));
drop policy if exists sqf_reviews_insert on public.reviews;
create policy sqf_reviews_insert on public.reviews for insert to authenticated
 with check (reviewer_id = (select auth.uid()) and reviewer_id <> provider_id
   and moderation_status='pending' and engagement_id is not null
   and public.sqf_email_confirmed(reviewer_id) and public.sqf_provider_public(provider_id)
   and exists (select 1 from public.service_engagements e
     where e.id=engagement_id and e.status='confirmed' and e.client_id=reviewer_id and e.provider_id=provider_id));
drop policy if exists sqf_reviews_update on public.reviews;
drop policy if exists sqf_reviews_delete on public.reviews;
create policy sqf_reviews_delete on public.reviews for delete to authenticated
 using (reviewer_id = (select auth.uid()));
revoke all on public.reviews from anon, authenticated;
grant select (id,provider_id,reviewer_id,rating,comment,created_at,moderation_status,engagement_id)
 on public.reviews to authenticated;
grant insert (provider_id,reviewer_id,engagement_id,rating,comment) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

-- RPC de avaliações moderadas. Nenhum reviewer_id é devolvido a terceiros.
create or replace function public.sqf_public_reviews(p_provider_ids uuid[])
returns table(id uuid, provider_id uuid, rating smallint, comment text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id,r.provider_id,r.rating,r.comment,r.created_at
  from public.reviews r
  where r.provider_id = any(p_provider_ids)
    and cardinality(p_provider_ids) between 1 and 100
    and r.moderation_status='published'
    and r.engagement_id is not null
    and public.sqf_provider_public(r.provider_id)
  order by r.created_at desc limit 1000;
$$;
revoke all on function public.sqf_public_reviews(uuid[]) from public, anon, authenticated;
grant execute on function public.sqf_public_reviews(uuid[]) to anon, authenticated;

-- Denúncias ficam privadas; revisão manual no SQL Editor / serviço de moderação futuro.
create table if not exists public.safety_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 provider_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(reason in ('impersonation','fraud','harassment','unsafe','other')),
 details text not null check(char_length(trim(details)) between 20 and 1200),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 unique(reporter_id,provider_id,reason)
);
alter table public.safety_reports enable row level security;
revoke all on public.safety_reports from anon, authenticated;
grant select (id,provider_id,reason,status,created_at) on public.safety_reports to authenticated;
grant insert (reporter_id,provider_id,reason,details) on public.safety_reports to authenticated;
drop policy if exists sqf_safety_read on public.safety_reports;
create policy sqf_safety_read on public.safety_reports for select to authenticated
 using (reporter_id = (select auth.uid()));
drop policy if exists sqf_safety_insert on public.safety_reports;
create policy sqf_safety_insert on public.safety_reports for insert to authenticated
 with check (reporter_id=(select auth.uid()) and reporter_id <> provider_id
   and public.sqf_email_confirmed(reporter_id) and public.sqf_provider_public(provider_id));

-- Direitos LGPD: pedido autenticado, sem dados sensíveis no corpo.
create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check(request_type in ('access','correction','deletion','portability')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved')),
  created_at timestamptz not null default now()
);
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon, authenticated;
grant select (id,request_type,status,created_at) on public.privacy_requests to authenticated;
grant insert (user_id,request_type,details) on public.privacy_requests to authenticated;
drop policy if exists sqf_privacy_read on public.privacy_requests;
create policy sqf_privacy_read on public.privacy_requests for select to authenticated
 using (user_id = (select auth.uid()));
drop policy if exists sqf_privacy_insert on public.privacy_requests;
create policy sqf_privacy_insert on public.privacy_requests for insert to authenticated
 with check (user_id = (select auth.uid()));

-- Não oferecer garantia falsa: imagens em sqf-avatars e sqf-portfolios continuam PÚBLICAS.
-- Exigir PNG/JPEG/WEBP + limite no storage; reencode local reduz metadados, mas não substitui antivírus.
-- Não incluir documentos, identidade, CPF, comprovantes de endereço ou certidões nessas mídias.
-- Deploy: conferir permissões de anon/auth, outras policies herdadas e funções EXECUTE.

-- Trilha de auditoria das decisões de moderação (somente leitura administrativa).
create table if not exists public.sqf_moderation_audit (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  previous_status text,
  new_status text,
  actor_id uuid,
  changed_at timestamptz not null default now()
);
alter table public.sqf_moderation_audit enable row level security;
revoke all on public.sqf_moderation_audit from anon, authenticated;
revoke all on sequence public.sqf_moderation_audit_id_seq from anon, authenticated;
create or replace function public.sqf_audit_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'provider_verifications' and new.status is distinct from old.status then
    insert into public.sqf_moderation_audit(entity_type,entity_id,previous_status,new_status,actor_id)
    values ('provider', new.provider_id,old.status,new.status,(select auth.uid()));
  elsif tg_table_name = 'reviews' and new.moderation_status is distinct from old.moderation_status then
    insert into public.sqf_moderation_audit(entity_type,entity_id,previous_status,new_status,actor_id)
    values ('review',new.id,old.moderation_status,new.moderation_status,(select auth.uid()));
  end if;
  return new;
end;
$$;
drop trigger if exists sqf_verification_audit on public.provider_verifications;
create trigger sqf_verification_audit after update on public.provider_verifications
for each row execute function public.sqf_audit_moderation();
drop trigger if exists sqf_reviews_audit on public.reviews;
create trigger sqf_reviews_audit after update on public.reviews
for each row execute function public.sqf_audit_moderation();


-- Reavaliar cadastro se houver alteração material após a aprovação. Evita
-- usar verificação antiga para anúncio novo, mudança de foto, cidade ou serviço.
create or replace function public.sqf_reset_provider_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_provider uuid;
begin
  if tg_table_name = 'profiles' then
    if tg_op <> 'UPDATE' then return null; end if;
    if old.full_name is not distinct from new.full_name
       and old.city is not distinct from new.city
       and old.city_ibge is not distinct from new.city_ibge
       and old.bio is not distinct from new.bio
       and old.avatar_path is not distinct from new.avatar_path then
      return null;
    end if;
    v_provider := new.id;
  elsif tg_table_name = 'provider_services' or tg_table_name = 'portfolio_photos' then
    if tg_op = 'DELETE' then v_provider := old.provider_id;
    else v_provider := new.provider_id; end if;
  else
    return null;
  end if;
  update public.provider_verifications
    set status='pending',reviewed_at=null,reviewed_by=null
    where provider_id=v_provider and status='approved';
  return null;
end;
$$;
drop trigger if exists sqf_profiles_recheck on public.profiles;
create trigger sqf_profiles_recheck after update of full_name,city,city_ibge,bio,avatar_path on public.profiles
for each row execute function public.sqf_reset_provider_approval();
drop trigger if exists sqf_services_recheck on public.provider_services;
create trigger sqf_services_recheck after insert or update or delete on public.provider_services
for each row execute function public.sqf_reset_provider_approval();
drop trigger if exists sqf_portfolio_recheck on public.portfolio_photos;
create trigger sqf_portfolio_recheck after insert or update or delete on public.portfolio_photos
for each row execute function public.sqf_reset_provider_approval();
