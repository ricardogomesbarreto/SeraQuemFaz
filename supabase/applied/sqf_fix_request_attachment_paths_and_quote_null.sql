CREATE OR REPLACE FUNCTION public.sqf_request_asset_allowed(p_path text, p_upload boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when p_path is null or p_upload is null or p_path !~ '^([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/){2}[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]webp$'
 then false
 else exists(select 1 from public.sqf_service_requests r where r.id=split_part(p_path,'/',1)::uuid
 and (r.client_id=(select auth.uid()) or r.provider_id=(select auth.uid()))
 and (not p_upload or
   (split_part(p_path,'/',2)=(select auth.uid())::text and
    r.status not in('completed','declined','canceled')))) end;
$function$;

CREATE OR REPLACE FUNCTION public.sqf_send_quote(p_request uuid, p_amount_cents integer, p_terms text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=(select auth.uid());v_req public.sqf_service_requests%rowtype;
 v_terms text:=btrim(coalesce(p_terms,''));
begin
 select * into v_req from public.sqf_service_requests where id=p_request for update;
 if not found or v_req.provider_id is distinct from v_actor then raise exception 'Acesso negado';end if;
 if v_req.status not in('requested','quoted') or not public.sqf_provider_public(v_actor)
 then raise exception 'Prestador indisponível';end if;
 if p_amount_cents is null or p_amount_cents not between 100 and 100000000 or char_length(v_terms) not between 10 and 1500
 then raise exception 'Valor/condições inválidos';end if;
 update public.sqf_service_requests set status='quoted',quote_cents=p_amount_cents,quote_terms=v_terms,
 quote_sent_at=now(),updated_at=now() where id=p_request;
 insert into public.sqf_request_events(request_id,actor_id,action,from_status,to_status,amount_cents)
 values(p_request,v_actor,'quote',v_req.status,'quoted',p_amount_cents);
 return 'quoted';
end $function$;

