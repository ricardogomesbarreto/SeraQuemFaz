-- SERÁ QUEM FAZ? v3.9.1 — leitura de mensagens e contenção de concorrência.
-- Ordem: executar depois de 20261104_09_solicitacoes_mensagens.sql EM HOMOLOGAÇÃO.
-- Não habilita pagamentos; não publica perfis; não altera preços ou histórico financeiro.
-- Tabelas próprias com RLS: nenhum cliente tem autorização de gravar leitura de outra conta.

create table if not exists public.sqf_request_read_receipts (
 request_id uuid not null references public.sqf_service_requests(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key(request_id,user_id)
);
create index if not exists sqf_read_receipts_user on public.sqf_request_read_receipts(user_id);
alter table public.sqf_request_read_receipts enable row level security;
revoke all on public.sqf_request_read_receipts from public,anon,authenticated;
grant select on public.sqf_request_read_receipts to authenticated;
create policy sqf_request_read_receipts_own on public.sqf_request_read_receipts
 for select to authenticated using(user_id=(select auth.uid()) and public.sqf_is_request_participant(request_id));

-- A leitura é escrita exclusivamente por RPC, após verificar a participação real.
create or replace function public.sqf_mark_request_read(p_request uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
 if v_uid is null or not public.sqf_is_request_participant(p_request) then
   raise exception 'Solicitação não autorizada';
 end if;
 insert into public.sqf_request_read_receipts(request_id,user_id,last_read_at)
 values(p_request,v_uid,now())
 on conflict(request_id,user_id) do update
 set last_read_at=greatest(public.sqf_request_read_receipts.last_read_at,excluded.last_read_at);
end;$$;
revoke all on function public.sqf_mark_request_read(uuid) from public,anon,authenticated;
grant execute on function public.sqf_mark_request_read(uuid) to authenticated;

-- Contagens somadas somente para solicitações pertencentes ao usuário autenticado.
-- Não revela conteúdo, nomes nem identificadores de terceiros fora das solicitações dele.
create or replace function public.sqf_request_unread_counts()
returns table(request_id uuid,unread_count bigint)
language sql stable security definer set search_path = '' as $$
 select r.id as request_id, pg_catalog.count(m.id)::bigint as unread_count
 from public.sqf_service_requests r
 left join public.sqf_request_read_receipts rr
   on rr.request_id=r.id and rr.user_id=(select auth.uid())
 left join public.sqf_request_messages m
   on m.request_id=r.id and m.sender_id<>(select auth.uid())
   and m.created_at>coalesce(rr.last_read_at,'epoch'::timestamptz)
 where r.client_id=(select auth.uid()) or r.provider_id=(select auth.uid())
 group by r.id;
$$;
revoke all on function public.sqf_request_unread_counts() from public,anon,authenticated;
grant execute on function public.sqf_request_unread_counts() to authenticated;

-- Brasília, Acre e outras zonas podem estar em dias diferentes do UTC na virada da noite.
-- O formulário exige a data LOCAL de hoje ou futura; o banco tolera margem de um dia
-- apenas no limite temporal para não rejeitar a data local válida. Não é prazo de pagamento.
alter table public.sqf_service_requests drop constraint if exists sqf_request_deadline;
alter table public.sqf_service_requests add constraint sqf_request_deadline
 check(desired_date is null or desired_date >= (created_at::date - 1));

-- Mantém o mecanismo original de estados e mensagens, com correções de concorrência.
create or replace function public.sqf_message_rate_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.sender_id is distinct from (select auth.uid()) then raise exception 'Remetente inválido'; end if;
 -- Serializa inserções simultâneas da mesma conta antes de calcular a cota horária.
 perform pg_catalog.pg_advisory_xact_lock(39102,pg_catalog.hashtext(new.sender_id::text));
 if (select count(*) from public.sqf_request_messages
     where sender_id=new.sender_id and created_at > now()-interval '1 hour') >= 40 then
   raise exception 'Limite horário de mensagens excedido';
 end if;
 return new;
end;$$;
revoke all on function public.sqf_message_rate_guard() from public,anon,authenticated;

create or replace function public.sqf_create_request(p_provider uuid,p_service uuid,p_description text,p_desired_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_client uuid := (select auth.uid());v_id uuid;v_city text;v_text text := btrim(coalesce(p_description,''));
begin
 if v_client is null or not public.sqf_email_confirmed(v_client) then raise exception 'Confirme o e-mail antes de solicitar'; end if;
 if char_length(v_text) not between 25 and 2000 then raise exception 'Descreva o serviço em 25 a 2000 caracteres'; end if;
 if p_desired_date is not null and (p_desired_date < current_date - 1 or p_desired_date > current_date + 366)
   then raise exception 'Data desejada inválida'; end if;
 if v_client=p_provider or not exists(select 1 from public.profiles where id=v_client and account_type='cliente')
    then raise exception 'Apenas clientes podem solicitar'; end if;
 if not public.sqf_provider_public(p_provider) then raise exception 'Prestador indisponível'; end if;
 if not exists(select 1 from public.provider_services s where s.id=p_service and s.provider_id=p_provider)
    then raise exception 'Serviço não pertence ao prestador'; end if;
 select p.city_ibge into v_city from public.profiles p where p.id=p_provider;
 if v_city !~ '^[0-9]{7}$' then raise exception 'Cidade do prestador inválida'; end if;
 -- Impede que várias solicitações simultâneas ultrapassem a cota ou burlem duplicatas.
 perform pg_catalog.pg_advisory_xact_lock(39101,pg_catalog.hashtext(v_client::text));
 if (select count(*) from public.sqf_service_requests where client_id=v_client and created_at > now()-interval '24 hours')>=8
   then raise exception 'Limite diário de solicitações excedido'; end if;
 if exists(select 1 from public.sqf_service_requests r where r.client_id=v_client and r.provider_id=p_provider
     and r.service_id=p_service and r.status not in('completed','declined','canceled') and r.created_at>now()-interval '48 hours')
     then raise exception 'Já existe solicitação em aberto para este serviço'; end if;
 insert into public.sqf_service_requests(client_id,provider_id,service_id,city_ibge,description,desired_date)
 values(v_client,p_provider,p_service,v_city,v_text,p_desired_date) returning id into v_id;
 insert into public.sqf_request_events(request_id,actor_id,action,to_status)
 values(v_id,v_client,'create','requested');
 return v_id;
end;$$;
revoke all on function public.sqf_create_request(uuid,uuid,text,date) from public,anon,authenticated;
grant execute on function public.sqf_create_request(uuid,uuid,text,date) to authenticated;

create or replace function public.sqf_request_action(p_request uuid,p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=(select auth.uid());v_req public.sqf_service_requests%rowtype;v_next text;v_e uuid;
begin
 select * into v_req from public.sqf_service_requests where id=p_request for update;
 if not found or v_actor not in (v_req.client_id,v_req.provider_id) then raise exception 'Solicitação não autorizada'; end if;
 v_next:=case
  when p_action='decline' and v_actor=v_req.provider_id and v_req.status in('requested','quoted') then 'declined'
  when p_action='cancel' and v_actor=v_req.client_id and v_req.status in('requested','quoted','accepted') then 'canceled'
  when p_action='accept' and v_actor=v_req.client_id and v_req.status='quoted' then 'accepted'
  when p_action='start' and v_actor=v_req.provider_id and v_req.status='accepted' then 'in_progress'
  when p_action='finish' and v_actor=v_req.provider_id and v_req.status='in_progress' then 'awaiting_confirmation'
  when p_action='confirm' and v_actor=v_req.client_id and v_req.status='awaiting_confirmation' then 'completed'
  else null end;
 if v_next is null then raise exception 'Operação incompatível com o estado ou sua função'; end if;
 -- Não permitir aceite de orçamento se o profissional foi suspenso após enviar a proposta.
 if v_next='accepted' and not public.sqf_provider_public(v_req.provider_id) then
   raise exception 'Prestador não está habilitado para novos serviços';
 end if;
 if v_actor=v_req.provider_id and v_next in ('in_progress','awaiting_confirmation')
    and not public.sqf_provider_public(v_req.provider_id) then raise exception 'Prestador não está habilitado'; end if;
 if v_next='completed' then
  insert into public.service_engagements(client_id,provider_id,status,requested_at,confirmed_at)
  values(v_req.client_id,v_req.provider_id,'confirmed',now(),now())
  on conflict(client_id,provider_id) do update
   set status='confirmed',confirmed_at=coalesce(public.service_engagements.confirmed_at,now())
   where public.service_engagements.status='requested';
  select id into v_e from public.service_engagements
     where client_id=v_req.client_id and provider_id=v_req.provider_id and status='confirmed';
 end if;
 update public.sqf_service_requests set status=v_next,updated_at=now(),
   completed_at=case when v_next='completed' then now() else completed_at end,
   engagement_id=case when v_next='completed' then v_e else engagement_id end
 where id=p_request;
 insert into public.sqf_request_events(request_id,actor_id,action,from_status,to_status,amount_cents)
 values(p_request,v_actor,p_action,v_req.status,v_next,v_req.quote_cents);
 return v_next;
end;$$;
revoke all on function public.sqf_request_action(uuid,text) from public,anon,authenticated;
grant execute on function public.sqf_request_action(uuid,text) to authenticated;


-- Limpeza segura de órfãos: somente o remetente e somente um objeto que não esteja associado a registro.
-- Não há permissão de excluir fotografias registradas nem mídia de outros participantes.
create or replace function public.sqf_request_orphan_cleanup_allowed(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
 select public.sqf_request_asset_allowed(p_path,true)
 and split_part(p_path,'/',2)=(select auth.uid())::text
 and not exists(select 1 from public.sqf_request_attachments a where a.storage_path=p_path);
$$;
revoke all on function public.sqf_request_orphan_cleanup_allowed(text) from public,anon,authenticated;
grant execute on function public.sqf_request_orphan_cleanup_allowed(text) to authenticated;
create policy sqf_request_assets_orphan_cleanup on storage.objects for delete to authenticated
 using(bucket_id='sqf-request-attachments' and public.sqf_request_orphan_cleanup_allowed(name));
