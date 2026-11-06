-- Integration test for a database with client and provider profiles and no active subscription on the selected provider.
-- All fixtures and settings changes are rolled back.
begin;
do $test$
declare c uuid; p uuid; outsider uuid; svc uuid; request_id uuid; sid uuid; iid uuid; test_city_code text;
begin
 select id into strict c from public.profiles where account_type='cliente' limit 1;
 select id into strict p from public.profiles where account_type='prestador' order by id limit 1;
 select id into strict outsider from public.profiles where id not in (c,p) limit 1;
 select code into strict test_city_code from public.sqf_ibge_municipalities limit 1;
 update public.profiles set city_ibge=test_city_code where id=p;
 update public.profiles set is_public=true where id=p;
 insert into public.provider_verifications(provider_id,status) values(p,'approved')
 on conflict(provider_id) do update set status='approved';
 update public.sqf_billing_settings set require_paid_subscription=true where singleton;
 if public.sqf_provider_public(p) then raise exception 'Expected unpaid provider'; end if;
 insert into public.provider_services(provider_id,category_id,service_title)
 select p,id::text,'Serviço de homologação' from public.categories limit 1 returning id into svc;

 update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id=c;
 insert into public.sqf_billing_subscriptions(user_id,cycle,price_cents,state,paid_until)
 values(p,'monthly',1490,'canceled',now()+interval '1 day') returning id into sid;
 if public.sqf_billing_permits_publication(p) then raise exception 'Stale cache enabled publication'; end if;
 insert into public.sqf_billing_invoices(subscription_id,mp_invoice_id,status,amount_cents,paid_at,paid_period_end)
 values(sid,'sqf-test-'||sid,'approved',1490,now()-interval '1 day',now()+interval '1 day') returning id into iid;
 if not public.sqf_provider_public(p) then raise exception 'Paid provider hidden'; end if;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub',c::text,true);
 request_id:=public.sqf_create_request(p,svc,'Descrição temporária da solicitação',current_date);
 begin
  perform public.sqf_create_request(p,svc,'Descrição temporária duplicada',current_date);
  raise exception 'Duplicate allowed';
 exception when raise_exception then
  if sqlerrm <> 'Solicitação aberta existente' then raise; end if;
 end;
 begin
  perform public.sqf_create_request(p,svc,'Descrição temporária com data inválida',current_date+367);
  raise exception 'Invalid date allowed';
 exception when raise_exception then
  if sqlerrm <> 'Data desejada inválida' then raise; end if;
 end;
 if public.sqf_request_action(request_id,'cancel') <> 'canceled' then raise exception 'Cancellation failed'; end if;
 reset role;
 update public.sqf_billing_invoices set paid_period_end=now() where id=iid;
 if public.sqf_provider_public(p) then raise exception 'Expired provider visible'; end if;
 update public.sqf_billing_invoices set status='refunded',paid_period_end=now()+interval '1 day' where id=iid;
 if public.sqf_provider_public(p) then raise exception 'Refunded provider visible'; end if;

end
$test$;
select 'request creation, duplicate and date rejected, cancellation, billing expiry and refund' as verified;
rollback;

