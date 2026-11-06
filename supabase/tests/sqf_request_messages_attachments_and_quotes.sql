-- Integration test for a database with client and provider profiles and no active subscription on the selected provider.
-- All fixtures and settings changes are rolled back.
begin;
do $test$
declare c uuid; p uuid; outsider uuid; svc uuid; accepted_id uuid; quoted_id uuid; asset_path text;
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
 asset_path:=accepted_id::text||'/'||c::text||'/'||gen_random_uuid()::text||'.webp';
 update public.sqf_billing_settings set require_paid_subscription=false where singleton;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub',c::text,true);
 if public.sqf_request_asset_allowed(asset_path,true) is distinct from true then raise exception 'Client upload denied'; end if;
 if public.sqf_request_asset_allowed(null,false) is distinct from false or public.sqf_request_asset_allowed('../invalid.webp',false) is distinct from false then raise exception 'Invalid path allowed'; end if;
 if public.sqf_request_orphan_cleanup_allowed(asset_path) is distinct from true then raise exception 'Orphan cleanup denied'; end if;
 insert into public.sqf_request_messages(request_id,sender_id,body) values(accepted_id,c,'Mensagem temporária');
 if (select unread_count from public.sqf_request_unread_counts() where request_id=accepted_id) is distinct from 0 then raise exception 'Own message counted'; end if;
 perform set_config('request.jwt.claim.sub',p::text,true);
 if public.sqf_request_asset_allowed(asset_path,false) is distinct from true or public.sqf_request_asset_allowed(asset_path,true) is distinct from false then raise exception 'Provider attachment permissions'; end if;
 if (select unread_count from public.sqf_request_unread_counts() where request_id=accepted_id) is distinct from 1 then raise exception 'Unread count mismatch'; end if;
 perform public.sqf_mark_request_read(accepted_id);
 if (select unread_count from public.sqf_request_unread_counts() where request_id=accepted_id) is distinct from 0 then raise exception 'Read receipt failed'; end if;
 begin
  perform public.sqf_send_quote(quoted_id,null,'Condições temporárias');
  raise exception 'Null quote accepted';
 exception when raise_exception then
  if sqlerrm <> 'Valor/condições inválidos' then raise; end if;
 end;
 if public.sqf_send_quote(quoted_id,20000,'Condições temporárias') <> 'quoted' then raise exception 'Valid quote denied'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if public.sqf_request_asset_allowed(asset_path,false) is distinct from false or exists(select from public.sqf_request_messages where request_id=accepted_id) then raise exception 'Outsider data exposed'; end if;
 if public.sqf_staff_whoami() is not null then raise exception 'Unexpected staff fixture'; end if;
 reset role;
 update public.sqf_service_requests set status='canceled' where id=accepted_id;
 set local role authenticated;
 perform set_config('request.jwt.claim.sub',c::text,true);
 if public.sqf_request_asset_allowed(asset_path,false) is distinct from true or public.sqf_request_asset_allowed(asset_path,true) is distinct from false then raise exception 'Closed attachment permissions'; end if;

end
$test$;
select 'quote validation, message privacy, read receipt, attachment lifecycle, non-staff identity' as verified;
rollback;

