-- SERÁ QUEM FAZ? v3.5.0 — controle administrativo e defesa em profundidade
-- PRÉ-REQUISITOS: executar 20261103_01, _02 e _03 em ordem, em HOMOLOGAÇÃO.
-- REQUER: Supabase Auth MFA habilitado (TOTP) e primeira conta administrativa
-- cadastrada por operador autorizado no SQL Editor, NUNCA pelo navegador.
-- Não conceder acesso a documentos por este painel. A revisão é procedimental,
-- não equivale a atestado de idoneidade, antecedente criminal ou identidade validada.

create table if not exists public.sqf_admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.sqf_admin_members enable row level security;
revoke all on public.sqf_admin_members from public, anon, authenticated;
-- Sem policies de leitura/escrita pela API. Adicionar membros SOMENTE no SQL Editor.

create table if not exists public.sqf_staff_decision_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  entity_type text not null check (entity_type in ('provider','review','report','privacy')),
  entity_id uuid not null,
  previous_status text not null,
  new_status text not null,
  decision_note text not null,
  created_at timestamptz not null default now()
);
create index if not exists sqf_staff_decision_recent_idx on public.sqf_staff_decision_log(created_at desc);
alter table public.sqf_staff_decision_log enable row level security;
revoke all on public.sqf_staff_decision_log from public, anon, authenticated;
revoke all on sequence public.sqf_staff_decision_log_id_seq from public, anon, authenticated;

-- Checagem feita no servidor para CADA chamada privilegiada.
create or replace function public.sqf_require_staff(p_admin_only boolean default false)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão autenticada obrigatória' using errcode='42501';
  end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then
    raise exception 'Autenticação de dois fatores necessária' using errcode='42501';
  end if;
  select m.role into v_role from public.sqf_admin_members m
    where m.user_id=(select auth.uid()) and m.active is true;
  if v_role is null or (p_admin_only and v_role <> 'admin') then
    raise exception 'Acesso administrativo não autorizado' using errcode='42501';
  end if;
  return v_role;
end;
$$;
revoke all on function public.sqf_require_staff(boolean) from public, anon, authenticated;
-- Apenas RPCs administrativas (SECURITY DEFINER) fazem essa chamada.

-- Exibe APENAS o próprio vínculo; não entrega lista de membros.
create or replace function public.sqf_staff_whoami()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  if (select auth.uid()) is null then return null; end if;
  select m.role into v_role from public.sqf_admin_members m
   where m.user_id=(select auth.uid()) and m.active is true;
  if v_role is null then return null; end if;
  return pg_catalog.jsonb_build_object('role',v_role,
    'mfa_ready',coalesce((select auth.jwt()->>'aal'),'aal1')='aal2');
end;
$$;
revoke all on function public.sqf_staff_whoami() from public, anon, authenticated;
grant execute on function public.sqf_staff_whoami() to authenticated;

-- Contagens sem IDs pessoais e sem disponibilizar linhas completas na API.
create or replace function public.sqf_staff_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  v_role:=public.sqf_require_staff(false);
  return pg_catalog.jsonb_build_object(
    'role',v_role,
    'providers',(select count(*) from public.provider_verifications where status='pending'),
    'reviews',(select count(*) from public.reviews where moderation_status='pending'),
    'reports',(select count(*) from public.safety_reports where status in ('pending','reviewing')),
    'privacy',case when v_role='admin' then
      (select count(*) from public.privacy_requests where status in ('pending','reviewing')) else null end
  );
end;
$$;
revoke all on function public.sqf_staff_overview() from public, anon, authenticated;
grant execute on function public.sqf_staff_overview() to authenticated;

-- Filas paginadas somente por limite (sem campos de identidade de clientes).
create or replace function public.sqf_staff_queue(p_queue text, p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text; v_limit int; v_items jsonb;
begin
  v_role:=public.sqf_require_staff(p_queue in ('providers','privacy','audit'));
  if p_queue not in ('providers','reviews','reports','privacy','audit') or p_queue is null then
    raise exception 'Fila inválida';
  end if;
  v_limit:=least(greatest(coalesce(p_limit,30),1),50);
  if p_queue='providers' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) into v_items
    from (
      select v.provider_id as id, p.full_name as title, p.city as subtitle,
        left(p.bio,500) as summary, v.status, v.requested_at as created_at,
        (select count(*) from public.provider_services s where s.provider_id=v.provider_id) as service_count,
        v.internal_note as note
      from public.provider_verifications v join public.profiles p on p.id=v.provider_id
      order by case when v.status='pending' then 0 else 1 end, v.requested_at desc
      limit v_limit
    ) t;
  elsif p_queue='reviews' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) into v_items
    from (
      select r.id, p.full_name as title, (r.rating::text || ' de 5 estrelas') as subtitle,
        r.comment as summary, r.moderation_status as status, r.created_at
      from public.reviews r join public.profiles p on p.id=r.provider_id
      order by case when r.moderation_status='pending' then 0 else 1 end, r.created_at desc
      limit v_limit
    ) t;
  elsif p_queue='reports' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) into v_items
    from (
      select r.id, p.full_name as title, r.reason as subtitle, r.details as summary,
        r.status, r.created_at
      from public.safety_reports r join public.profiles p on p.id=r.provider_id
      order by case when r.status='pending' then 0 when r.status='reviewing' then 1 else 2 end,
        r.created_at desc limit v_limit
    ) t;
  elsif p_queue='privacy' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) into v_items
    from (
      select r.id, r.request_type as title, r.user_id::text as subtitle, r.details as summary,
        r.status, r.created_at
      from public.privacy_requests r
      order by case when r.status='pending' then 0 else 1 end, r.created_at desc limit v_limit
    ) t;
  else
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) into v_items
    from (
      select l.id::text as id, l.entity_type as title,
        l.previous_status || ' → ' || l.new_status as subtitle,
        left(l.decision_note,600) as summary, l.new_status as status, l.created_at
      from public.sqf_staff_decision_log l order by l.created_at desc limit v_limit
    ) t;
  end if;
  return coalesce(v_items,'[]'::jsonb);
end;
$$;
revoke all on function public.sqf_staff_queue(text,integer) from public, anon, authenticated;
grant execute on function public.sqf_staff_queue(text,integer) to authenticated;

-- Moderação transacional com estado anterior fixado e justificativa auditada.
-- Nomes das entidades são mapeados explicitamente, nunca derivados do nome da fila.
create or replace function public.sqf_staff_decide(
 p_queue text, p_target uuid, p_action text, p_note text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
 v_role text; v_note text := pg_catalog.btrim(coalesce(p_note,''));
 v_before text; v_after text; v_profile public.profiles%rowtype; v_type text;
begin
  v_role := public.sqf_require_staff(p_queue in ('providers','privacy'));
  if p_queue not in ('providers','reviews','reports','privacy') or p_queue is null then
    raise exception 'Fila inválida';
  end if;
  if p_target is null then raise exception 'Identificador inválido'; end if;
  if pg_catalog.char_length(v_note) < 20 or pg_catalog.char_length(v_note) > 1000 then
    raise exception 'Justificativa de 20 a 1000 caracteres obrigatória';
  end if;
  v_type := case p_queue when 'providers' then 'provider' when 'reviews' then 'review'
    when 'reports' then 'report' else 'privacy' end;

  if p_queue='providers' then
    select status into v_before from public.provider_verifications
      where provider_id=p_target for update;
    if not found then raise exception 'Solicitação não encontrada'; end if;
    if p_action='approve' and v_before='pending' then
      select * into v_profile from public.profiles where id=p_target;
      if not found or v_profile.account_type <> 'prestador'
        or v_profile.city_ibge is null or v_profile.avatar_path is null
        or pg_catalog.char_length(pg_catalog.btrim(v_profile.full_name)) < 4
        or pg_catalog.char_length(pg_catalog.btrim(v_profile.bio)) < 40
        or not exists(select 1 from public.provider_services s where s.provider_id=p_target)
        or not exists(select 1 from auth.users u where u.id=p_target and u.email_confirmed_at is not null)
      then
        raise exception 'O prestador ainda não atende aos pré-requisitos de publicação';
      end if;
      v_after:='approved';
    elsif p_action='reject' and v_before='pending' then v_after:='rejected';
    elsif p_action='suspend' and v_before in ('approved','pending') then v_after:='suspended';
    elsif p_action='reopen' and v_before in ('suspended','rejected') then v_after:='pending';
    else raise exception 'Transição de verificação não permitida'; end if;
    update public.provider_verifications set status=v_after,
      reviewed_at=now(), reviewed_by=(select auth.uid()), internal_note=v_note
      where provider_id=p_target;

  elsif p_queue='reviews' then
    select moderation_status into v_before from public.reviews where id=p_target for update;
    if not found then raise exception 'Avaliação não encontrada'; end if;
    if p_action='publish' and v_before='pending' then v_after:='published';
    elsif p_action='reject' and v_before='pending' then v_after:='rejected';
    elsif p_action='hide' and v_before='published' then v_after:='hidden';
    elsif p_action='restore' and v_before='hidden' then v_after:='published';
    else raise exception 'Transição de avaliação não permitida'; end if;
    update public.reviews set moderation_status=v_after, moderated_at=now()
      where id=p_target;

  elsif p_queue='reports' then
    select status into v_before from public.safety_reports where id=p_target for update;
    if not found then raise exception 'Denúncia não encontrada'; end if;
    if p_action='review' and v_before='pending' then v_after:='reviewing';
    elsif p_action='resolve' and v_before in ('pending','reviewing') then v_after:='resolved';
    elsif p_action='dismiss' and v_before in ('pending','reviewing') then v_after:='dismissed';
    else raise exception 'Transição de denúncia não permitida'; end if;
    update public.safety_reports set status=v_after where id=p_target;

  else
    select status into v_before from public.privacy_requests where id=p_target for update;
    if not found then raise exception 'Solicitação LGPD não encontrada'; end if;
    if p_action='review' and v_before='pending' then v_after:='reviewing';
    elsif p_action='resolve' and v_before='reviewing' then v_after:='resolved';
    else raise exception 'Transição de solicitação LGPD não permitida'; end if;
    update public.privacy_requests set status=v_after where id=p_target;
  end if;

  insert into public.sqf_staff_decision_log(
    actor_id,entity_type,entity_id,previous_status,new_status,decision_note)
  values ((select auth.uid()),v_type,p_target,v_before,v_after,v_note);
  return pg_catalog.jsonb_build_object('id',p_target,'status',v_after);
end;
$$;
revoke all on function public.sqf_staff_decide(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.sqf_staff_decide(text,uuid,text,text) to authenticated;

-- Em Postgres, policies permissivas são combinadas por OR.
-- As policies restritivas abaixo impõem o teto de acesso ainda que outra policy permissiva exista.
drop policy if exists sqf_profiles_select_limit on public.profiles;
create policy sqf_profiles_select_limit on public.profiles as restrictive for select to anon, authenticated
 using (id = (select auth.uid()) or public.sqf_provider_public(id));
drop policy if exists sqf_profiles_update_limit on public.profiles;
create policy sqf_profiles_update_limit on public.profiles as restrictive for update to authenticated
 using (id=(select auth.uid())) with check (id=(select auth.uid()));
drop policy if exists sqf_services_select_limit on public.provider_services;
create policy sqf_services_select_limit on public.provider_services as restrictive for select to anon,authenticated
 using (provider_id=(select auth.uid()) or public.sqf_provider_public(provider_id));
drop policy if exists sqf_photos_select_limit on public.portfolio_photos;
create policy sqf_photos_select_limit on public.portfolio_photos as restrictive for select to anon,authenticated
 using (provider_id=(select auth.uid()) or public.sqf_provider_public(provider_id));
drop policy if exists sqf_reviews_select_limit on public.reviews;
create policy sqf_reviews_select_limit on public.reviews as restrictive for select to authenticated
 using (reviewer_id=(select auth.uid()));
drop policy if exists sqf_verification_select_limit on public.provider_verifications;
create policy sqf_verification_select_limit on public.provider_verifications as restrictive for select to authenticated
 using (provider_id=(select auth.uid()));
drop policy if exists sqf_reports_select_limit on public.safety_reports;
create policy sqf_reports_select_limit on public.safety_reports as restrictive for select to authenticated
 using (reporter_id=(select auth.uid()));
drop policy if exists sqf_privacy_select_limit on public.privacy_requests;
create policy sqf_privacy_select_limit on public.privacy_requests as restrictive for select to authenticated
 using (user_id=(select auth.uid()));

-- Restringir a execução de funções auxiliares SECURITY DEFINER que não são APIs públicas.
revoke all on function public.sqf_review_integrity() from public,anon,authenticated;
revoke all on function public.sqf_audit_moderation() from public,anon,authenticated;
revoke all on function public.sqf_reset_provider_approval() from public,anon,authenticated;

-- Bootstrap manual seguro (EXEMPLO NÃO EXECUTADO):
-- insert into public.sqf_admin_members(user_id,role)
-- select id,'admin' from auth.users where email = 'SEU_EMAIL_ADMINISTRATIVO';
-- NÃO permitir criar/alterar administradores pela API pública.
