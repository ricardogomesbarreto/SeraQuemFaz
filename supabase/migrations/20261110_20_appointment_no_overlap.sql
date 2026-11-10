-- v3.13.1: confirmação atômica sem sobreposições.
-- Propostas não reservam a agenda. Intervalos [início,fim) em UTC.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = pg_catalog, public, extensions;

-- A expressão usa timestamp UTC sem fuso para ser imutável e preservar
-- a duração em minutos mesmo em mudanças de horário de verão.
ALTER TABLE public.sqf_appointments
 ADD CONSTRAINT sqf_appointment_provider_no_overlap
 EXCLUDE USING gist (
   provider_id WITH =,
   tsrange(starts_at AT TIME ZONE 'UTC',
     (starts_at AT TIME ZONE 'UTC') + duration_minutes * interval '1 minute','[)') WITH &&
 ) WHERE (status='confirmed');
ALTER TABLE public.sqf_appointments
 ADD CONSTRAINT sqf_appointment_client_no_overlap
 EXCLUDE USING gist (
   client_id WITH =,
   tsrange(starts_at AT TIME ZONE 'UTC',
     (starts_at AT TIME ZONE 'UTC') + duration_minutes * interval '1 minute','[)') WITH &&
 ) WHERE (status='confirmed');

-- Preservar todos os checks de participante, estado e destinatário da RPC.
-- Não devolver detalhes privados das linhas conflitantes ao solicitante.
CREATE OR REPLACE FUNCTION public.sqf_manage_appointment(
 p_request uuid,p_action text,p_starts_at timestamptz DEFAULT NULL,p_duration_minutes integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.sqf_service_requests%ROWTYPE; a public.sqf_appointments%ROWTYPE;
 actor uuid := (SELECT auth.uid());
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 SELECT * INTO r FROM public.sqf_service_requests WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR actor NOT IN (r.client_id,r.provider_id) THEN RAISE EXCEPTION 'Solicitação indisponível'; END IF;
 IF r.status NOT IN ('accepted','in_progress','awaiting_confirmation') THEN
  RAISE EXCEPTION 'Agendamento permitido somente após aceite e antes da conclusão'; END IF;
 SELECT * INTO a FROM public.sqf_appointments WHERE request_id=p_request FOR UPDATE;
 IF p_action='propose' THEN
  IF p_starts_at IS NULL OR p_starts_at<=now()+interval '30 minutes'
     OR p_starts_at>now()+interval '180 days' OR
     p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 30 AND 480
   THEN RAISE EXCEPTION 'Informe uma data futura válida e duração de 30 a 480 minutos'; END IF;
  IF a.id IS NULL THEN
   INSERT INTO public.sqf_appointments(request_id,client_id,provider_id,starts_at,duration_minutes,proposed_by)
    VALUES (r.id,r.client_id,r.provider_id,p_starts_at,p_duration_minutes,actor);
  ELSE
   UPDATE public.sqf_appointments SET starts_at=p_starts_at,duration_minutes=p_duration_minutes,
    proposed_by=actor,status='proposed',updated_at=now() WHERE id=a.id;
  END IF;
  RETURN 'proposed';
 ELSIF p_action='confirm' THEN
  IF a.id IS NULL OR a.status<>'proposed' OR a.proposed_by=actor OR a.starts_at<=now()
   THEN RAISE EXCEPTION 'Proposta inválida ou deve ser confirmada pela outra parte'; END IF;
  UPDATE public.sqf_appointments SET status='confirmed',updated_at=now() WHERE id=a.id;
  RETURN 'confirmed';
 ELSIF p_action IN ('cancel','decline') THEN
  IF a.id IS NULL OR a.status NOT IN ('proposed','confirmed') THEN RAISE EXCEPTION 'Nenhuma agenda ativa'; END IF;
  IF p_action='decline' AND (a.proposed_by=actor OR a.status<>'proposed')
   THEN RAISE EXCEPTION 'Somente o destinatário pode recusar uma proposta'; END IF;
  UPDATE public.sqf_appointments SET status=CASE WHEN p_action='cancel' THEN 'canceled' ELSE 'declined' END,
    updated_at=now() WHERE id=a.id;
  RETURN CASE WHEN p_action='cancel' THEN 'canceled' ELSE 'declined' END;
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
EXCEPTION WHEN exclusion_violation THEN
 RAISE EXCEPTION 'Horário indisponível: existe outro atendimento confirmado neste intervalo. Escolha outro horário.'
  USING ERRCODE='23P01';
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_manage_appointment(uuid,text,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_manage_appointment(uuid,text,timestamptz,integer) TO authenticated;
COMMIT;
