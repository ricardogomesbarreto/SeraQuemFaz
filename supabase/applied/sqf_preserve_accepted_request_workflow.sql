-- Keep existing accepted jobs actionable after billing expiry, subject to moderation.
CREATE OR REPLACE FUNCTION public.sqf_request_action(p_request uuid, p_action text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=(select auth.uid());v_req public.sqf_service_requests%rowtype;v_next text;v_e uuid;
begin
 select * into v_req from public.sqf_service_requests where id=p_request for update;
 if not found or v_actor is null or v_actor not in (v_req.client_id,v_req.provider_id) then raise exception 'Acesso negado';end if;
 v_next:=case
  when p_action='decline' and v_actor=v_req.provider_id and v_req.status in('requested','quoted') then 'declined'
  when p_action='cancel' and v_actor=v_req.client_id and v_req.status in('requested','quoted','accepted') then 'canceled'
  when p_action='accept' and v_actor=v_req.client_id and v_req.status='quoted' then 'accepted'
  when p_action='start' and v_actor=v_req.provider_id and v_req.status='accepted' then 'in_progress'
  when p_action='finish' and v_actor=v_req.provider_id and v_req.status='in_progress' then 'awaiting_confirmation'
  when p_action='confirm' and v_actor=v_req.client_id and v_req.status='awaiting_confirmation' then 'completed'
  else null end;
 if v_next is null then raise exception 'Transição inválida';end if;
 if v_next='accepted' and not public.sqf_provider_public(v_req.provider_id) then
  raise exception 'Prestador indisponível para aceitar novos orçamentos';
 end if;
 if v_next in ('in_progress','awaiting_confirmation') and not exists (
  select 1
  from public.profiles p
  join public.provider_verifications v on v.provider_id=p.id
  where p.id=v_req.provider_id and p.account_type='prestador'
    and p.is_public and v.status='approved'
 ) then
  raise exception 'Prestador suspenso ou não aprovado';
 end if;
 if v_next='completed' then
  insert into public.service_engagements(client_id,provider_id,status,requested_at,confirmed_at)
  values(v_req.client_id,v_req.provider_id,'confirmed',now(),now())
  on conflict(client_id,provider_id) do update set status='confirmed',
  confirmed_at=coalesce(public.service_engagements.confirmed_at,now())
  where public.service_engagements.status='requested';
  select id into v_e from public.service_engagements where client_id=v_req.client_id
    and provider_id=v_req.provider_id and status='confirmed';
 end if;
 update public.sqf_service_requests set status=v_next,updated_at=now(),
  completed_at=case when v_next='completed' then now() else completed_at end,
  engagement_id=case when v_next='completed' then v_e else engagement_id end
  where id=p_request;
 insert into public.sqf_request_events(request_id,actor_id,action,from_status,to_status,amount_cents)
 values(p_request,v_actor,p_action,v_req.status,v_next,v_req.quote_cents);
 return v_next;
end $function$;
