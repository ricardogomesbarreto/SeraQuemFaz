-- SERÁ QUEM FAZ? v3.10.0: recursos de atendimento, avisos, suporte e métricas.
-- APLICAR sobre o banco consolidado, após backup e validação em homologação.
-- Toda alteração aditiva; nenhuma política legada é removida e checkout permanece desabilitado.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Portfólio organizado por serviços do próprio prestador.
CREATE UNIQUE INDEX IF NOT EXISTS sqf_provider_services_owner_key ON public.provider_services(id,provider_id);
ALTER TABLE public.portfolio_photos ADD COLUMN IF NOT EXISTS service_id uuid;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='sqf_portfolio_service_owner_fk') THEN
  ALTER TABLE public.portfolio_photos ADD CONSTRAINT sqf_portfolio_service_owner_fk
   FOREIGN KEY (service_id,provider_id) REFERENCES public.provider_services(id,provider_id) ON DELETE SET NULL (service_id);
 END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS sqf_portfolio_service_idx ON public.portfolio_photos(service_id) WHERE service_id IS NOT NULL;

-- Agenda: proposta, confirmação ou cancelamento somente pelo par associado à solicitação.
CREATE TABLE IF NOT EXISTS public.sqf_appointments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.sqf_service_requests(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL,
 duration_minutes integer NOT NULL DEFAULT 60 CHECK(duration_minutes BETWEEN 30 AND 480),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','confirmed','declined','canceled')),
 proposed_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sqf_appointments_schedule_idx ON public.sqf_appointments(provider_id,starts_at);
ALTER TABLE public.sqf_appointments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_appointments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sqf_appointments TO authenticated;
DROP POLICY IF EXISTS sqf_appointments_participants_select ON public.sqf_appointments;
CREATE POLICY sqf_appointments_participants_select ON public.sqf_appointments
 FOR SELECT TO authenticated USING(client_id=(SELECT auth.uid()) OR provider_id=(SELECT auth.uid()));

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
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_manage_appointment(uuid,text,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_manage_appointment(uuid,text,timestamptz,integer) TO authenticated;

-- Central de notificações privadas: o cliente pode consultar e marcar como lida,
-- mas não inserir avisos para outros usuários.
CREATE TABLE IF NOT EXISTS public.sqf_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(length(kind) BETWEEN 2 AND 40),
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 120),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=300),
 request_id uuid REFERENCES public.sqf_service_requests(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS sqf_notifications_recipient_idx ON public.sqf_notifications(recipient_id,created_at DESC);
ALTER TABLE public.sqf_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON public.sqf_notifications TO authenticated;
DROP POLICY IF EXISTS sqf_notifications_owner_read ON public.sqf_notifications;
CREATE POLICY sqf_notifications_owner_read ON public.sqf_notifications
 FOR SELECT TO authenticated USING(recipient_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS sqf_notifications_owner_update ON public.sqf_notifications;
CREATE POLICY sqf_notifications_owner_update ON public.sqf_notifications
 FOR UPDATE TO authenticated USING(recipient_id=(SELECT auth.uid()))
 WITH CHECK(recipient_id=(SELECT auth.uid()) AND read_at IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.sqf_notification_preferences(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sqf_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE(email_enabled) ON public.sqf_notification_preferences TO authenticated;
DROP POLICY IF EXISTS sqf_notification_preferences_owner_select ON public.sqf_notification_preferences;
CREATE POLICY sqf_notification_preferences_owner_select ON public.sqf_notification_preferences
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS sqf_notification_preferences_owner_insert ON public.sqf_notification_preferences;
CREATE POLICY sqf_notification_preferences_owner_insert ON public.sqf_notification_preferences
 FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS sqf_notification_preferences_owner_update ON public.sqf_notification_preferences;
CREATE POLICY sqf_notification_preferences_owner_update ON public.sqf_notification_preferences
 FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));

-- Avisos gerados por eventos genuínos, usando texto genérico: não guardar conteúdo
-- privado de mensagens nem de orçamentos em notificações.
CREATE OR REPLACE FUNCTION public.sqf_notify_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE receiver uuid; heading text; category text;
BEGIN
 IF TG_OP='INSERT' THEN receiver:=NEW.provider_id; heading:='Nova solicitação de orçamento'; category:='request';
 ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at THEN
  receiver:=CASE WHEN NEW.status IN ('quoted','awaiting_confirmation') THEN NEW.client_id ELSE NEW.provider_id END;
  heading:='O atendimento teve uma atualização';category:='request_status';
 ELSE RETURN NEW; END IF;
 INSERT INTO public.sqf_notifications(recipient_id,kind,title,body,request_id)
 VALUES(receiver,category,heading,'Consulte os detalhes na central de solicitações.',NEW.id);
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS sqf_notify_request_tg ON public.sqf_service_requests;
CREATE TRIGGER sqf_notify_request_tg AFTER INSERT OR UPDATE OF status,quote_sent_at ON public.sqf_service_requests
 FOR EACH ROW EXECUTE FUNCTION public.sqf_notify_request();

CREATE OR REPLACE FUNCTION public.sqf_notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.sqf_service_requests%ROWTYPE; receiver uuid;
BEGIN
 SELECT * INTO r FROM public.sqf_service_requests WHERE id=NEW.request_id;
 IF NOT FOUND OR NEW.sender_id NOT IN (r.client_id,r.provider_id) THEN RETURN NEW; END IF;
 receiver:=CASE WHEN NEW.sender_id=r.client_id THEN r.provider_id ELSE r.client_id END;
 INSERT INTO public.sqf_notifications(recipient_id,kind,title,body,request_id)
 VALUES(receiver,'message','Nova mensagem privada','Abra a conversa para ler a mensagem.',NEW.request_id);
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS sqf_notify_message_tg ON public.sqf_request_messages;
CREATE TRIGGER sqf_notify_message_tg AFTER INSERT ON public.sqf_request_messages
 FOR EACH ROW EXECUTE FUNCTION public.sqf_notify_message();

CREATE OR REPLACE FUNCTION public.sqf_notify_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE receiver uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.updated_at=OLD.updated_at THEN RETURN NEW; END IF;
 receiver:=CASE WHEN NEW.status='proposed' THEN
  CASE WHEN NEW.proposed_by=NEW.client_id THEN NEW.provider_id ELSE NEW.client_id END
 ELSE CASE WHEN NEW.proposed_by=NEW.client_id THEN NEW.client_id ELSE NEW.provider_id END END;
 INSERT INTO public.sqf_notifications(recipient_id,kind,title,body,request_id)
 VALUES(receiver,'appointment','Agenda atualizada','Confira o horário e a situação do atendimento.',NEW.request_id);
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS sqf_notify_appointment_tg ON public.sqf_appointments;
CREATE TRIGGER sqf_notify_appointment_tg AFTER INSERT OR UPDATE ON public.sqf_appointments
 FOR EACH ROW EXECUTE FUNCTION public.sqf_notify_appointment();

-- Central de ajuda: tickets não expõem dados do cliente e não concedem
-- permissões administrativas. A triagem ocorre por processo administrativo autenticado.
CREATE TABLE IF NOT EXISTS public.sqf_support_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 topic text NOT NULL CHECK(topic IN ('account','budget','appointment','review','technical','other')),
 message text NOT NULL CHECK(length(btrim(message)) BETWEEN 15 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sqf_support_user_idx ON public.sqf_support_tickets(user_id,created_at DESC);
ALTER TABLE public.sqf_support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_support_tickets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT(user_id,topic,message) ON public.sqf_support_tickets TO authenticated;
DROP POLICY IF EXISTS sqf_support_owner_read ON public.sqf_support_tickets;
CREATE POLICY sqf_support_owner_read ON public.sqf_support_tickets
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS sqf_support_owner_insert ON public.sqf_support_tickets;
CREATE POLICY sqf_support_owner_insert ON public.sqf_support_tickets
 FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));

-- Contagem estritamente real: somente visualizações de pessoas autenticadas,
-- no máximo um evento por visitante, prestador e dia.
CREATE TABLE IF NOT EXISTS public.sqf_profile_views(
 provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 viewed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 PRIMARY KEY(provider_id,viewer_id,viewed_on)
);
ALTER TABLE public.sqf_profile_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_profile_views FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.sqf_register_profile_view(p_provider uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
 IF actor IS NULL OR actor=p_provider THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=p_provider AND p.account_type='prestador'
  AND p.is_public=true AND public.sqf_provider_public(p_provider)) THEN RETURN false; END IF;
 INSERT INTO public.sqf_profile_views(provider_id,viewer_id) VALUES(p_provider,actor)
 ON CONFLICT DO NOTHING;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_register_profile_view(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_register_profile_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sqf_my_performance()
RETURNS TABLE(views_authenticated bigint,requests_total bigint,quotes_sent bigint,requests_completed bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND account_type='prestador')
  THEN RAISE EXCEPTION 'Perfil profissional não autorizado'; END IF;
 RETURN QUERY SELECT
  (SELECT count(*) FROM public.sqf_profile_views v WHERE v.provider_id=actor),
  (SELECT count(*) FROM public.sqf_service_requests r WHERE r.provider_id=actor),
  (SELECT count(*) FROM public.sqf_service_requests r WHERE r.provider_id=actor AND r.quote_sent_at IS NOT NULL),
  (SELECT count(*) FROM public.sqf_service_requests r WHERE r.provider_id=actor AND r.status='completed');
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_my_performance() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_my_performance() TO authenticated;

-- Agregados administrativos. Sem identificadores pessoais, exige membro ativo
-- do corpo administrativo e MFA (aal2) verificados no Postgres.
CREATE OR REPLACE FUNCTION public.sqf_staff_dashboard_metrics()
RETURNS TABLE(providers_total bigint,providers_visible bigint,requests_total bigint,requests_completed bigint,reviews_pending bigint,tickets_open bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
 IF actor IS NULL OR COALESCE((SELECT auth.jwt()->>'aal'),'') <> 'aal2'
  OR NOT EXISTS(SELECT 1 FROM public.sqf_admin_members m
     WHERE m.user_id=actor AND m.active AND m.role IN ('admin','moderator'))
 THEN RAISE EXCEPTION 'Autorização administrativa com MFA necessária'; END IF;
 RETURN QUERY SELECT
 (SELECT count(*) FROM public.profiles WHERE account_type='prestador'),
 (SELECT count(*) FROM public.profiles WHERE account_type='prestador' AND is_public=true),
 (SELECT count(*) FROM public.sqf_service_requests),
 (SELECT count(*) FROM public.sqf_service_requests WHERE status='completed'),
 (SELECT count(*) FROM public.reviews WHERE moderation_status='pending'),
 (SELECT count(*) FROM public.sqf_support_tickets WHERE status<>'resolved');
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_staff_dashboard_metrics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_staff_dashboard_metrics() TO authenticated;


-- Opt-in explícito: fila privada para envio por provedor externo. Nenhum email
-- é disparado pelo banco; uma Edge Function com credenciais privadas é necessária.
CREATE TABLE IF NOT EXISTS public.sqf_notification_outbox(
 notification_id uuid PRIMARY KEY REFERENCES public.sqf_notifications(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','skipped','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sqf_notification_outbox_queue_idx
 ON public.sqf_notification_outbox(next_attempt_at) WHERE status='pending';
ALTER TABLE public.sqf_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sqf_notification_outbox FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sqf_queue_notification_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sqf_notification_preferences p
   WHERE p.user_id=NEW.recipient_id AND p.email_enabled) THEN
  INSERT INTO public.sqf_notification_outbox(notification_id,recipient_id)
   VALUES(NEW.id,NEW.recipient_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS sqf_queue_notification_email_tg ON public.sqf_notifications;
CREATE TRIGGER sqf_queue_notification_email_tg AFTER INSERT ON public.sqf_notifications
 FOR EACH ROW EXECUTE FUNCTION public.sqf_queue_notification_email();

-- Impedir abuso simples em suporte, sem revelar existência de tickets alheios.
CREATE OR REPLACE FUNCTION public.sqf_support_rate_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NEW.user_id<>(SELECT auth.uid()) THEN
  RAISE EXCEPTION 'Identidade incompatível';
 END IF;
 IF (SELECT count(*) FROM public.sqf_support_tickets s
     WHERE s.user_id=NEW.user_id AND s.created_at>now()-interval '1 hour')>=3 THEN
  RAISE EXCEPTION 'Limite de três pedidos por hora atingido';
 END IF;
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS sqf_support_rate_guard_tg ON public.sqf_support_tickets;
CREATE TRIGGER sqf_support_rate_guard_tg BEFORE INSERT ON public.sqf_support_tickets
 FOR EACH ROW EXECUTE FUNCTION public.sqf_support_rate_guard();

CREATE OR REPLACE FUNCTION public.sqf_staff_support_queue()
RETURNS TABLE(ticket_id uuid,topic text,message text,status text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL OR COALESCE((SELECT auth.jwt()->>'aal'),'')<>'aal2' OR
 NOT EXISTS(SELECT 1 FROM public.sqf_admin_members m WHERE m.user_id=actor
  AND m.active AND m.role IN ('admin','moderator')) THEN
   RAISE EXCEPTION 'Acesso de suporte negado'; END IF;
 RETURN QUERY SELECT t.id,t.topic,t.message,t.status,t.created_at
  FROM public.sqf_support_tickets t ORDER BY t.created_at DESC LIMIT 50;
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_staff_support_queue() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_staff_support_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.sqf_staff_support_action(p_ticket uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor uuid:=(SELECT auth.uid()); t public.sqf_support_tickets%ROWTYPE;
BEGIN
 IF actor IS NULL OR COALESCE((SELECT auth.jwt()->>'aal'),'')<>'aal2' OR
 NOT EXISTS(SELECT 1 FROM public.sqf_admin_members m WHERE m.user_id=actor
  AND m.active AND m.role IN ('admin','moderator')) THEN
  RAISE EXCEPTION 'Acesso de suporte negado'; END IF;
 IF p_action NOT IN ('review','resolve') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 SELECT * INTO t FROM public.sqf_support_tickets WHERE id=p_ticket FOR UPDATE;
 IF NOT FOUND OR t.status='resolved' THEN RAISE EXCEPTION 'Pedido indisponível'; END IF;
 UPDATE public.sqf_support_tickets
 SET status=CASE WHEN p_action='review' THEN 'reviewing' ELSE 'resolved' END,updated_at=now()
 WHERE id=p_ticket;
 INSERT INTO public.sqf_notifications(recipient_id,kind,title,body)
 VALUES(t.user_id,'support','Suporte atualizado','Consulte a situação da solicitação no painel da conta.');
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_staff_support_action(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_staff_support_action(uuid,text) TO authenticated;

COMMIT;
