-- Integration test for a database with client and provider profiles and no active subscription on the selected provider.
-- All fixtures and settings changes are rolled back.
begin;
do $test$
declare c uuid; p uuid; outsider uuid; svc uuid; accepted_id uuid; quoted_id uuid;
begin
 select id into strict c from public.profiles where account_type='cliente' limit 1;
 select id into strict p from public.profiles where account_type='prestador' order by id limit 1;
 select id into strict outsider from public.profiles where id not in (c,p) limit 1;
 update public.profiles set is_public=true where id=p;
 insert into public.provider_verifications(provider_id,status) values(p,'approved')
 on conflict(provider_id) do update set status='approved';
 update public.sqf_billing_settings set require_paid_subscription=true where singleton;
 if public.sqf_provider_public(p) then raise exception 'Expected unpaid provider'; end if;
 insert into public.provider_services(provider_id,category_id,service_title)
 select p,id::text,'Serviço de homologação' from public.categories limit 1 returning id into svc;
 insert into public.sqf_service_requests(client_id,provider_id,service_id,city_ibge,description,status)
 select c,p,svc,code,'Solicitação temporária para homologação','accepted'
 from public.sqf_ibge_municipalities limit 1 returning id into accepted_id;
 insert into public.sqf_service_requests(client_id,provider_id,service_id,city_ibge,description,status,quote_cents)
 select c,p,svc,code,'Solicitação temporária para homologação','quoted',15000
 from public.sqf_ibge_municipalities limit 1 returning id into quoted_id;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.sqf_request_action(accepted_id,'start');
  raise exception 'Unexpected outsider access';
 exception when raise_exception then
  if sqlerrm <> 'Acesso negado' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub',c::text,true);
 begin
  perform public.sqf_request_action(quoted_id,'accept');
  raise exception 'Unexpected unpaid acceptance';
 exception when raise_exception then
  if sqlerrm <> 'Prestador indisponível para aceitar novos orçamentos' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub',p::text,true);
 if public.sqf_request_action(accepted_id,'start') <> 'in_progress' then raise exception 'Start failed'; end if;
 if public.sqf_request_action(accepted_id,'finish') <> 'awaiting_confirmation' then raise exception 'Finish failed'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 if public.sqf_request_action(accepted_id,'confirm') <> 'completed' then raise exception 'Confirmation failed'; end if;
 reset role;
 update public.sqf_service_requests set status='in_progress' where id=accepted_id;
 update public.provider_verifications set status='suspended' where provider_id=p;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub',p::text,true);
 begin
  perform public.sqf_request_action(accepted_id,'finish');
  raise exception 'Unexpected suspended provider access';
 exception when raise_exception then
  if sqlerrm <> 'Prestador suspenso ou não aprovado' then raise; end if;
 end;

end
$test$;
select 'outsider denied, unpaid acceptance denied, accepted job completed, suspension respected' as verified;
rollback;
