-- SERÁ QUEM FAZ? v3.6.0 — avaliação responsável e retrato de perfil.
-- Executar APÓS 01, 02, 03 e 04, exclusivamente em ambiente de HOMOLOGAÇÃO primeiro.
-- Esta migração NÃO faz reconhecimento facial nem atesta identidade; o operador deve verificar
-- pessoalmente se a imagem é frontal e retrata o titular. Não guardar documentos no Storage público.

-- Uma reclamação de avaliação possivelmente abusiva não remove críticas automaticamente.
-- Só a moderação humana com MFA pode ocultar uma avaliação após examinar evidências.
create table if not exists public.sqf_review_disputes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('false_service','inaccurate','harassment','personal_data','other')),
  details text not null check (char_length(btrim(details)) between 30 and 1200),
  status text not null default 'pending' check (status in ('pending','reviewing','upheld','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (review_id, provider_id)
);
create index if not exists sqf_disputes_pending_idx on public.sqf_review_disputes(status,created_at desc);
alter table public.sqf_review_disputes enable row level security;
revoke all on public.sqf_review_disputes from public,anon,authenticated;
grant select (id,review_id,reason,status,created_at,decided_at) on public.sqf_review_disputes to authenticated;
drop policy if exists sqf_disputes_owner on public.sqf_review_disputes;
create policy sqf_disputes_owner on public.sqf_review_disputes for select to authenticated
  using (provider_id=(select auth.uid()));

-- Direito de resposta: no máximo uma resposta por avaliação; publicada apenas após moderação.
create table if not exists public.sqf_review_responses (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 20 and 600),
  moderation_status text not null default 'pending'
     check (moderation_status in ('pending','published','rejected','hidden')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
create index if not exists sqf_responses_pending_idx on public.sqf_review_responses(moderation_status,created_at desc);
alter table public.sqf_review_responses enable row level security;
revoke all on public.sqf_review_responses from public,anon,authenticated;
grant select (review_id,message,moderation_status,created_at) on public.sqf_review_responses to authenticated;
drop policy if exists sqf_response_owner on public.sqf_review_responses;
create policy sqf_response_owner on public.sqf_review_responses for select to authenticated
  using (provider_id=(select auth.uid()));

-- A resposta não contém contato pessoal: retira URLs e e-mails visíveis da publicação.
create or replace function public.sqf_review_text_allowed(p_text text)
returns boolean language sql immutable set search_path='' as $$
  select p_text is not null
    and p_text !~* '(https?://|www[.])'
    and p_text !~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+[.][A-Z]{2,}'
$$;
revoke all on function public.sqf_review_text_allowed(text) from public,anon,authenticated;

-- Uma pessoa autenticada não pode fabricar uma contestação contra avaliações de terceiros.
create or replace function public.sqf_submit_review_dispute(p_review uuid,p_reason text,p_details text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_id uuid;
begin
  if v_actor is null or not public.sqf_email_confirmed(v_actor) then
    raise exception 'É necessário estar autenticado com e-mail confirmado';
  end if;
  if p_reason not in ('false_service','inaccurate','harassment','personal_data','other')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_details,''))) not between 30 and 1200 then
    raise exception 'Motivo ou descrição inválidos';
  end if;
  if not exists (select 1 from public.reviews r
       where r.id=p_review and r.provider_id=v_actor and r.moderation_status='published') then
    raise exception 'Somente o prestador pode contestar uma avaliação publicada sobre seu serviço';
  end if;
  if (select count(*) from public.sqf_review_disputes d where d.provider_id=v_actor
      and d.created_at > now()-interval '30 days') >= 15 then
    raise exception 'Limite de contestações atingido; procure o suporte';
  end if;
  insert into public.sqf_review_disputes(review_id,provider_id,reason,details)
    values(p_review,v_actor,p_reason,pg_catalog.btrim(p_details)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.sqf_submit_review_dispute(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sqf_submit_review_dispute(uuid,text,text) to authenticated;

create or replace function public.sqf_submit_review_response(p_review uuid,p_message text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not public.sqf_email_confirmed(v_actor) then
    raise exception 'É necessário estar autenticado com e-mail confirmado';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_message,''))) not between 20 and 600
     or not public.sqf_review_text_allowed(p_message) then
    raise exception 'Escreva 20–600 caracteres e não inclua links ou e-mails';
  end if;
  if not exists (select 1 from public.reviews r
       where r.id=p_review and r.provider_id=v_actor and r.moderation_status='published') then
    raise exception 'Resposta disponível somente ao prestador responsável por avaliação publicada';
  end if;
  insert into public.sqf_review_responses(review_id,provider_id,message)
    values(p_review,v_actor,pg_catalog.btrim(p_message));
  return p_review;
end;
$$;
revoke all on function public.sqf_submit_review_response(uuid,text) from public,anon,authenticated;
grant execute on function public.sqf_submit_review_response(uuid,text) to authenticated;

-- É impossível ao visitante consultar autores, denúncias ou respostas rejeitadas.
create or replace function public.sqf_public_review_responses(p_review_ids uuid[])
returns table(review_id uuid,message text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select r.review_id,r.message,r.created_at
    from public.sqf_review_responses r
    join public.reviews v on v.id=r.review_id
   where r.review_id=any(p_review_ids)
     and pg_catalog.cardinality(p_review_ids) between 1 and 100
     and r.moderation_status='published'
     and v.moderation_status='published'
     and public.sqf_provider_public(r.provider_id)
   order by r.created_at desc limit 100;
$$;
revoke all on function public.sqf_public_review_responses(uuid[]) from public,anon,authenticated;
grant execute on function public.sqf_public_review_responses(uuid[]) to anon,authenticated;

-- Defesa limitada contra rajadas de avaliações entre várias contas de prestadores.
-- Não pretende detectar contas falsas e não transforma avaliação negativa em fraude.
create or replace function public.sqf_review_rate_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not public.sqf_review_text_allowed(new.comment) then
    raise exception 'Retire links e e-mails do comentário';
  end if;
  if (select count(*) from public.reviews r where r.reviewer_id=new.reviewer_id
     and r.created_at >= now()-interval '24 hours') >= 3 then
    raise exception 'Limite de três avaliações em 24 horas. Entre em contato com o suporte';
  end if;
  return new;
end;
$$;
revoke all on function public.sqf_review_rate_guard() from public,anon,authenticated;
drop trigger if exists sqf_review_rate_guard on public.reviews;
create trigger sqf_review_rate_guard before insert on public.reviews
 for each row execute function public.sqf_review_rate_guard();

-- Histórico da decisão, acessível somente pelo operador do banco em homologação/produção.
create table if not exists public.sqf_review_case_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  case_type text not null check (case_type in ('disputes','responses')),
  case_id uuid not null,
  old_status text not null,
  new_status text not null,
  justification text not null,
  created_at timestamptz not null default now()
);
alter table public.sqf_review_case_audit enable row level security;
revoke all on public.sqf_review_case_audit from public,anon,authenticated;
revoke all on sequence public.sqf_review_case_audit_id_seq from public,anon,authenticated;

-- O moderador nunca recebe o UUID do cliente avaliador nesta fila.
create or replace function public.sqf_staff_review_cases(p_queue text,p_limit integer default 40)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;
begin
  perform public.sqf_require_staff(false); -- MFA + papel administrativo, sempre no servidor.
  if p_queue not in ('disputes','responses') or p_queue is null then
    raise exception 'Fila inválida';
  end if;
  if p_queue='disputes' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)),'[]'::jsonb) into v_items
    from (select d.id,p.full_name as title, d.reason as subtitle,
       pg_catalog.left(d.details,1200) as summary, d.status,d.created_at,
       r.comment as original_comment,r.rating as original_rating
       from public.sqf_review_disputes d
       join public.reviews r on r.id=d.review_id
       join public.profiles p on p.id=d.provider_id
       order by case when d.status='pending' then 0 when d.status='reviewing' then 1 else 2 end,
        d.created_at desc limit least(greatest(coalesce(p_limit,40),1),60)) t;
  else
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)),'[]'::jsonb) into v_items
    from (select x.review_id as id,p.full_name as title,
       'Resposta do prestador'::text as subtitle, x.message as summary,
       x.moderation_status as status,x.created_at, r.comment as original_comment,
       r.rating as original_rating
       from public.sqf_review_responses x
       join public.reviews r on r.id=x.review_id
       join public.profiles p on p.id=x.provider_id
       order by case when x.moderation_status='pending' then 0 else 1 end,
        x.created_at desc limit least(greatest(coalesce(p_limit,40),1),60)) t;
  end if;
  return coalesce(v_items,'[]'::jsonb);
end;
$$;
revoke all on function public.sqf_staff_review_cases(text,integer) from public,anon,authenticated;
grant execute on function public.sqf_staff_review_cases(text,integer) to authenticated;

create or replace function public.sqf_staff_review_case_decide(
 p_queue text,p_target uuid,p_action text,p_note text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_before text; v_after text; v_review uuid; v_note text:=pg_catalog.btrim(coalesce(p_note,''));
begin
  perform public.sqf_require_staff(false);
  if p_queue not in ('disputes','responses') or p_queue is null or p_target is null then
    raise exception 'Decisão inválida';
  end if;
  if pg_catalog.char_length(v_note) not between 20 and 1000 then
    raise exception 'Justificativa de 20 a 1000 caracteres obrigatória';
  end if;
  if p_queue='disputes' then
    select status,review_id into v_before,v_review from public.sqf_review_disputes
      where id=p_target for update;
    if not found then raise exception 'Contestação inexistente'; end if;
    if p_action='review' and v_before='pending' then v_after:='reviewing';
    elsif p_action='uphold' and v_before in ('pending','reviewing') then v_after:='upheld';
    elsif p_action='dismiss' and v_before in ('pending','reviewing') then v_after:='dismissed';
    else raise exception 'Transição inválida'; end if;
    update public.sqf_review_disputes set status=v_after,
      decided_at=case when v_after in ('upheld','dismissed') then now() else null end
      where id=p_target;
    if v_after='upheld' then
      update public.reviews set moderation_status='hidden',moderated_at=now()
        where id=v_review and moderation_status='published';
    end if;
  else
    select moderation_status into v_before from public.sqf_review_responses
      where review_id=p_target for update;
    if not found then raise exception 'Resposta inexistente'; end if;
    if p_action='publish' and v_before='pending' then v_after:='published';
    elsif p_action='reject' and v_before='pending' then v_after:='rejected';
    elsif p_action='hide' and v_before='published' then v_after:='hidden';
    elsif p_action='restore' and v_before='hidden' then v_after:='published';
    else raise exception 'Transição inválida'; end if;
    update public.sqf_review_responses set moderation_status=v_after,moderated_at=now()
      where review_id=p_target;
  end if;
  insert into public.sqf_review_case_audit(actor_id,case_type,case_id,old_status,new_status,justification)
    values((select auth.uid()),p_queue,p_target,v_before,v_after,v_note);
  return pg_catalog.jsonb_build_object('id',p_target,'status',v_after);
end;
$$;
revoke all on function public.sqf_staff_review_case_decide(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.sqf_staff_review_case_decide(text,uuid,text,text) to authenticated;

-- A foto pública de perfil é uma única imagem WebP. A proporção e a frontalidade
-- dependem, respectivamente, da recodificação no frontend e da revisão humana.
-- PNG/JPEG antigos permanecem no Storage para migração manual; novas cargas só WebP.
update storage.buckets set allowed_mime_types=array['image/webp'],
 file_size_limit=1572864 where id='sqf-avatars';

-- Se o site já possui prestadores aprovados, fotos antigas deverão ser inspecionadas.
-- Não revoga automaticamente a aprovação sem autorização da operação; realizar revisão
-- cadastral antes do lançamento público e registrar evidências administrativas.

-- A inspeção visual é um gate real de aprovação, não apenas um checkbox no frontend.
-- A conferência não equivale a reconhecimento facial nem validação documental.
create table if not exists public.sqf_portrait_checks (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  avatar_path text not null,
  accepted boolean not null,
  note text not null check (char_length(btrim(note)) between 20 and 1000),
  checked_by uuid not null references auth.users(id),
  checked_at timestamptz not null default now()
);
alter table public.sqf_portrait_checks enable row level security;
revoke all on public.sqf_portrait_checks from public,anon,authenticated;

create or replace function public.sqf_staff_provider_portrait(p_provider uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_path text; v_accepted boolean;
begin
  perform public.sqf_require_staff(true);
  select p.avatar_path into v_path from public.profiles p
    where p.id=p_provider and p.account_type='prestador';
  if not found then raise exception 'Prestador inexistente'; end if;
  select c.accepted into v_accepted from public.sqf_portrait_checks c
    where c.provider_id=p_provider and c.avatar_path=v_path;
  return pg_catalog.jsonb_build_object('path',v_path,'accepted',coalesce(v_accepted,false));
end;
$$;
revoke all on function public.sqf_staff_provider_portrait(uuid) from public,anon,authenticated;
grant execute on function public.sqf_staff_provider_portrait(uuid) to authenticated;

create or replace function public.sqf_staff_check_portrait(p_provider uuid,p_accepted boolean,p_note text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_path text; v_note text:=pg_catalog.btrim(coalesce(p_note,''));
begin
  perform public.sqf_require_staff(true);
  if p_accepted is null or pg_catalog.char_length(v_note) not between 20 and 1000 then
    raise exception 'Informe decisão e justificativa de 20 a 1000 caracteres';
  end if;
  select p.avatar_path into v_path from public.profiles p
    where p.id=p_provider and p.account_type='prestador' for update;
  if not found or v_path is null then raise exception 'Prestador sem retrato'; end if;
  if p_accepted and v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$' then
    raise exception 'É necessário reenviar a foto no padrão WebP 3×4';
  end if;
  insert into public.sqf_portrait_checks(provider_id,avatar_path,accepted,note,checked_by,checked_at)
    values(p_provider,v_path,p_accepted,v_note,(select auth.uid()),now())
    on conflict(provider_id) do update
      set avatar_path=excluded.avatar_path,accepted=excluded.accepted,note=excluded.note,
          checked_by=excluded.checked_by,checked_at=excluded.checked_at;
  return pg_catalog.jsonb_build_object('provider_id',p_provider,'accepted',p_accepted);
end;
$$;
revoke all on function public.sqf_staff_check_portrait(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.sqf_staff_check_portrait(uuid,boolean,text) to authenticated;

create or replace function public.sqf_verify_portrait_before_approval()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_path text;
begin
  if new.status='approved' and old.status is distinct from new.status then
    select p.avatar_path into v_path from public.profiles p where p.id=new.provider_id;
    if not exists (select 1 from public.sqf_portrait_checks c
      where c.provider_id=new.provider_id and c.avatar_path=v_path and c.accepted is true) then
      raise exception 'Retrato 3×4 não aprovado pela equipe para a fotografia atual';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sqf_verify_portrait_before_approval() from public,anon,authenticated;
drop trigger if exists sqf_verify_portrait_before_approval on public.provider_verifications;
create trigger sqf_verify_portrait_before_approval before update of status on public.provider_verifications
  for each row execute function public.sqf_verify_portrait_before_approval();

-- Exige que cadastros previamente aprovados reenviem/verifiquem a foto antes de nova aprovação.
-- Efeito intencional: os perfis sairão da busca enquanto a equipe os reanalisar.
-- Em produção, planejar janela de implantação e notificar os prestadores antes de executar.
update public.provider_verifications set status='pending',reviewed_at=null,reviewed_by=null
 where status='approved';

-- Reduz exposição do identificador do cliente ao prestador via API direta.
-- O prestador consulta id/data/status do atendimento; a relação com o cliente
-- permanece acessível somente em consultas de servidor com autorização específica.
revoke all on public.service_engagements from anon,authenticated;
grant select (id,provider_id,status,requested_at,confirmed_at) on public.service_engagements to authenticated;
grant insert (client_id,provider_id) on public.service_engagements to authenticated;
grant update (status) on public.service_engagements to authenticated;

create or replace function public.sqf_my_engagement(p_provider uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null then return null; end if;
  select pg_catalog.jsonb_build_object('id',e.id,'status',e.status) into v_result
    from public.service_engagements e
    where e.client_id=(select auth.uid()) and e.provider_id=p_provider;
  return v_result;
end;
$$;
revoke all on function public.sqf_my_engagement(uuid) from public,anon,authenticated;
grant execute on function public.sqf_my_engagement(uuid) to authenticated;

-- Impede troca silenciosa do arquivo já conferido enquanto o mesmo retrato
-- estiver referenciado pelo perfil. Ao trocar avatar_path, o antigo deixa de
-- estar em uso e pode ser excluído pelo titular (limpeza do Storage).
create or replace function public.sqf_avatar_locked(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sqf_portrait_checks c
    join public.profiles p on p.id=c.provider_id
    where p.avatar_path=p_path and c.avatar_path=p_path and c.accepted);
$$;
revoke all on function public.sqf_avatar_locked(text) from public,anon,authenticated;
grant execute on function public.sqf_avatar_locked(text) to authenticated;

drop policy if exists sqf_avatar_webp_guard on storage.objects;
create policy sqf_avatar_webp_guard on storage.objects as restrictive for insert to authenticated
 with check (bucket_id <> 'sqf-avatars' or
   (storage.extension(name) = 'webp'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
    and (storage.foldername(name))[1] = (select auth.uid())::text));

drop policy if exists sqf_avatar_immutable_guard on storage.objects;
create policy sqf_avatar_immutable_guard on storage.objects as restrictive for delete to authenticated
 using (bucket_id <> 'sqf-avatars' or not public.sqf_avatar_locked(name));

drop policy if exists sqf_avatar_immutable_update_guard on storage.objects;
create policy sqf_avatar_immutable_update_guard on storage.objects as restrictive for update to authenticated
 using (bucket_id <> 'sqf-avatars' or not public.sqf_avatar_locked(name))
 with check (bucket_id <> 'sqf-avatars' or
   (storage.extension(name)='webp'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$'
    and (storage.foldername(name))[1]=(select auth.uid())::text));
