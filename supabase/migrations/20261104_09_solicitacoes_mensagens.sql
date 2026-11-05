-- SERÁ QUEM FAZ? v3.9.0 — contatos privados, orçamentos e atendimentos.
-- Aplicar DEPOIS das migrações 01–08 em ambiente de homologação. Sem cobranças por serviço.
-- Tabelas expostas são protegidas por GRANT + RLS. Estado muda apenas por RPC.
create extension if not exists pgcrypto;

create table if not exists public.sqf_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.provider_services(id),
  city_ibge text not null check (city_ibge ~ '^[0-9]{7}$'),
  description text not null check (char_length(btrim(description)) between 25 and 2000),
  desired_date date,
  status text not null default 'requested' check (status in ('requested','quoted','accepted','in_progress','awaiting_confirmation','completed','declined','canceled')),
  quote_cents integer check (quote_cents between 100 and 100000000),
  quote_terms text check (char_length(quote_terms) <= 1500),
  quote_sent_at timestamptz,
  engagement_id uuid references public.service_engagements(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint sqf_request_not_self check(client_id <> provider_id),
  constraint sqf_request_deadline check(desired_date is null or desired_date >= created_at::date)
);
create index if not exists sqf_requests_client on public.sqf_service_requests(client_id,created_at desc);
create index if not exists sqf_requests_provider on public.sqf_service_requests(provider_id,status,created_at desc);

create table if not exists public.sqf_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sqf_service_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 2 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists sqf_messages_thread on public.sqf_request_messages(request_id,created_at);

create table if not exists public.sqf_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sqf_service_requests(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  caption text not null default '' check(char_length(caption) <= 160),
  created_at timestamptz not null default now(),
  constraint sqf_media_path check(storage_path = request_id::text || '/' || uploaded_by::text || '/' || id::text || '.webp')
);

-- Trilha append-only de mudanças de estado/orçamento, acessível apenas às duas partes.
create table if not exists public.sqf_request_events (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.sqf_service_requests(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),
 action text not null check(char_length(action) between 2 and 24),
 from_status text,
 to_status text not null,
 amount_cents integer,
 created_at timestamptz not null default now()
);
create index if not exists sqf_events_request on public.sqf_request_events(request_id,created_at desc);
alter table public.sqf_service_requests enable row level security;
alter table public.sqf_request_messages enable row level security;
alter table public.sqf_request_events enable row level security;
alter table public.sqf_request_attachments enable row level security;
revoke all on public.sqf_service_requests, public.sqf_request_messages, public.sqf_request_attachments, public.sqf_request_events from public,anon,authenticated;
revoke all on sequence public.sqf_request_events_id_seq from public,anon,authenticated;
grant select on public.sqf_service_requests, public.sqf_request_messages, public.sqf_request_attachments, public.sqf_request_events to authenticated;
grant insert(request_id,sender_id,body) on public.sqf_request_messages to authenticated;
grant insert(id,request_id,uploaded_by,storage_path,caption) on public.sqf_request_attachments to authenticated;

-- Não exponha RLS de outra pessoa por visualização ou edição indireta.
create or replace function public.sqf_is_request_participant(p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sqf_service_requests r
   where r.id=p_request and (r.client_id=(select auth.uid()) or r.provider_id=(select auth.uid())));
$$;
revoke all on function public.sqf_is_request_participant(uuid) from public,anon,authenticated;
grant execute on function public.sqf_is_request_participant(uuid) to authenticated;

create policy sqf_events_owner_read on public.sqf_request_events for select to authenticated
 using(public.sqf_is_request_participant(request_id));
create policy sqf_requests_owner_read on public.sqf_service_requests for select to authenticated
 using(client_id=(select auth.uid()) or provider_id=(select auth.uid()));
create policy sqf_messages_owner_read on public.sqf_request_messages for select to authenticated
 using(public.sqf_is_request_participant(request_id));
create policy sqf_messages_participant_send on public.sqf_request_messages for insert to authenticated
 with check(sender_id=(select auth.uid()) and public.sqf_is_request_participant(request_id)
   and exists(select 1 from public.sqf_service_requests r where r.id=request_id and r.status not in ('canceled','declined','completed')));
create policy sqf_attachments_owner_read on public.sqf_request_attachments for select to authenticated
 using(public.sqf_is_request_participant(request_id));
create policy sqf_attachments_participant_upload on public.sqf_request_attachments for insert to authenticated
 with check(uploaded_by=(select auth.uid()) and public.sqf_is_request_participant(request_id)
   and exists(select 1 from public.sqf_service_requests r where r.id=request_id and r.status not in ('canceled','declined','completed')));

-- Limite por conta, inclusive com RLS via trigger e função definer.
create or replace function public.sqf_message_rate_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.sender_id is distinct from (select auth.uid()) then raise exception 'Remetente inválido'; end if;
 if (select count(*) from public.sqf_request_messages
     where sender_id=new.sender_id and created_at > now()-interval '1 hour') >= 40 then
   raise exception 'Limite horário de mensagens excedido';
 end if;
 return new;
end;$$;
revoke all on function public.sqf_message_rate_guard() from public,anon,authenticated;
drop trigger if exists sqf_limit_request_messages on public.sqf_request_messages;
create trigger sqf_limit_request_messages before insert on public.sqf_request_messages
for each row execute function public.sqf_message_rate_guard();

create or replace function public.sqf_create_request(p_provider uuid,p_service uuid,p_description text,p_desired_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_client uuid := (select auth.uid());v_id uuid;v_city text;v_text text := btrim(coalesce(p_description,''));
begin
 if v_client is null or not public.sqf_email_confirmed(v_client) then raise exception 'Confirme o e-mail antes de solicitar'; end if;
 if char_length(v_text) not between 25 and 2000 then raise exception 'Descreva o serviço em 25 a 2000 caracteres'; end if;
 if p_desired_date is not null and (p_desired_date < current_date or p_desired_date > current_date + 365)
   then raise exception 'Data desejada inválida'; end if;
 if v_client=p_provider or not exists(select 1 from public.profiles where id=v_client and account_type='cliente')
    then raise exception 'Apenas clientes podem solicitar'; end if;
 if not public.sqf_provider_public(p_provider) then raise exception 'Prestador indisponível'; end if;
 if not exists(select 1 from public.provider_services s where s.id=p_service and s.provider_id=p_provider)
    then raise exception 'Serviço não pertence ao prestador'; end if;
 select p.city_ibge into v_city from public.profiles p where p.id=p_provider;
 if v_city !~ '^[0-9]{7}$' then raise exception 'Cidade do prestador inválida'; end if;
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

create or replace function public.sqf_send_quote(p_request uuid,p_amount_cents integer,p_terms text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_provider uuid := (select auth.uid());v_request public.sqf_service_requests%rowtype;v_terms text:=btrim(coalesce(p_terms,''));
begin
 select * into v_request from public.sqf_service_requests where id=p_request for update;
 if not found or v_request.provider_id is distinct from v_provider then raise exception 'Solicitação não autorizada'; end if;
 if v_request.status not in ('requested','quoted') or not public.sqf_provider_public(v_provider) then raise exception 'Não é possível orçar nesta etapa'; end if;
 if p_amount_cents not between 100 and 100000000 or char_length(v_terms) not between 10 and 1500
   then raise exception 'Valor ou condições inválidos'; end if;
 update public.sqf_service_requests set status='quoted',quote_cents=p_amount_cents,quote_terms=v_terms,
 quote_sent_at=now(),updated_at=now() where id=p_request;
 insert into public.sqf_request_events(request_id,actor_id,action,from_status,to_status,amount_cents)
 values(p_request,v_provider,'quote',v_request.status,'quoted',p_amount_cents);
 return 'quoted';
end;$$;
revoke all on function public.sqf_send_quote(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.sqf_send_quote(uuid,integer,text) to authenticated;

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

-- Anexos: storage PRIVADO; caminho REQUEST_ID/USER_ID/OBJECT_ID.webp.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('sqf-request-attachments','sqf-request-attachments',false,2097152,array['image/webp'])
 on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/webp'];

create or replace function public.sqf_request_asset_allowed(p_path text,p_upload boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select case
  when p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$' then false
  else exists(select 1 from public.sqf_service_requests r where r.id=split_part(p_path,'/',1)::uuid
    and (r.client_id=(select auth.uid()) or r.provider_id=(select auth.uid()))
    and (not p_upload or (split_part(p_path,'/',2)=(select auth.uid())::text
      and r.status not in ('completed','declined','canceled')))) end;
$$;
revoke all on function public.sqf_request_asset_allowed(text,boolean) from public,anon,authenticated;
grant execute on function public.sqf_request_asset_allowed(text,boolean) to authenticated;

create policy sqf_request_assets_private_select on storage.objects for select to authenticated
 using(bucket_id='sqf-request-attachments' and public.sqf_request_asset_allowed(name,false));
create policy sqf_request_assets_private_insert on storage.objects for insert to authenticated
 with check(bucket_id='sqf-request-attachments' and public.sqf_request_asset_allowed(name,true));

-- Somente administradores com MFA enxergam indicadores financeiros agregados.
create or replace function public.sqf_staff_billing_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 perform public.sqf_require_staff(true);
 return pg_catalog.jsonb_build_object(
  'subscription_pending',(select count(*) from public.sqf_billing_subscriptions where state in ('pending','creating')),
  'subscription_canceled',(select count(*) from public.sqf_billing_subscriptions where state='canceled'),
  'paid_active',(select count(*) from public.sqf_billing_subscriptions where paid_until>now()),
  'payment_failed',(select count(*) from public.sqf_billing_invoices where status in ('rejected','charged_back')),
  'refunds',(select count(*) from public.sqf_billing_invoices where status='refunded'),
  'stale_reconciliation',(select count(*) from public.sqf_billing_subscriptions
    where mp_preapproval_id is not null and (last_verified_at is null or last_verified_at<now()-interval '2 days'))
 );
end;$$;
revoke all on function public.sqf_staff_billing_overview() from public,anon,authenticated;
grant execute on function public.sqf_staff_billing_overview() to authenticated;

-- Métrica pública apenas quando cadastro aprovado; total confirmado por duas contas.
create or replace function public.sqf_provider_completed_count(p_provider uuid)
returns integer language sql stable security definer set search_path = '' as $$
 select case when public.sqf_provider_public(p_provider) then
  (select count(*)::integer from public.sqf_service_requests
   where provider_id=p_provider and status='completed') else 0 end;
$$;
revoke all on function public.sqf_provider_completed_count(uuid) from public,anon,authenticated;
grant execute on function public.sqf_provider_completed_count(uuid) to anon,authenticated;

-- Sinais operacionais de volume, não prova de fraude. Não retornar identidades pela API.
create or replace function public.sqf_staff_request_risk_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 perform public.sqf_require_staff(true);
 return pg_catalog.jsonb_build_object(
  'clients_high_volume',(select count(*) from (select client_id from public.sqf_service_requests
    where created_at>now()-interval '24 hours' group by client_id having count(*)>=5) t),
  'messages_high_volume',(select count(*) from (select sender_id from public.sqf_request_messages
    where created_at>now()-interval '1 hour' group by sender_id having count(*)>=25) t),
  'requests_pending',(select count(*) from public.sqf_service_requests where status='requested'),
  'waiting_confirmation',(select count(*) from public.sqf_service_requests where status='awaiting_confirmation')
 );
end;$$;
revoke all on function public.sqf_staff_request_risk_overview() from public,anon,authenticated;
grant execute on function public.sqf_staff_request_risk_overview() to authenticated;
