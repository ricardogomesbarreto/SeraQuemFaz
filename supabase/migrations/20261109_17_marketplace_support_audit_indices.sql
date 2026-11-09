-- SERÁ QUEM FAZ? v3.10.0 — auditoria de decisões de suporte e índices das novas FKs.
-- Requer migração 20261109_14 já aplicada. Adição transacional e reversível.
BEGIN;
CREATE INDEX IF NOT EXISTS sqf_portfolio_service_owner_fk_idx ON public.portfolio_photos(service_id,provider_id);
CREATE INDEX IF NOT EXISTS sqf_appointments_client_fk_idx ON public.sqf_appointments(client_id);
CREATE INDEX IF NOT EXISTS sqf_appointments_proposer_fk_idx ON public.sqf_appointments(proposed_by);
CREATE INDEX IF NOT EXISTS sqf_notification_outbox_recipient_fk_idx ON public.sqf_notification_outbox(recipient_id);
CREATE INDEX IF NOT EXISTS sqf_notifications_request_fk_idx ON public.sqf_notifications(request_id);
CREATE INDEX IF NOT EXISTS sqf_profile_views_viewer_fk_idx ON public.sqf_profile_views(viewer_id);

-- Ações humanas relevantes deixam trilha na tabela administrativa já existente.
-- Não registra texto sensível dos tickets no log.
CREATE OR REPLACE FUNCTION public.sqf_staff_support_action(p_ticket uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 actor uuid := (SELECT auth.uid());
 t public.sqf_support_tickets%ROWTYPE;
 next_status text;
BEGIN
 IF actor IS NULL
   OR COALESCE((SELECT auth.jwt()->>'aal'),'') <> 'aal2'
   OR NOT EXISTS (
     SELECT 1 FROM public.sqf_admin_members m
     WHERE m.user_id=actor AND m.active AND m.role IN ('admin','moderator')
   )
 THEN RAISE EXCEPTION 'Acesso de suporte negado'; END IF;

 IF p_action NOT IN ('review','resolve') THEN RAISE EXCEPTION 'Ação inválida'; END IF;

 SELECT * INTO t FROM public.sqf_support_tickets
 WHERE id=p_ticket FOR UPDATE;
 IF NOT FOUND OR t.status='resolved' THEN RAISE EXCEPTION 'Pedido indisponível'; END IF;

 next_status := CASE WHEN p_action='review' THEN 'reviewing' ELSE 'resolved' END;
 IF t.status=next_status THEN RAISE EXCEPTION 'O pedido já está nesta situação'; END IF;

 UPDATE public.sqf_support_tickets
 SET status=next_status,updated_at=now() WHERE id=p_ticket;

 INSERT INTO public.sqf_staff_decision_log
   (actor_id,entity_type,entity_id,previous_status,new_status,decision_note)
 VALUES(actor,'support',p_ticket,t.status,next_status,
        'Atualização de atendimento de suporte mediante autenticação MFA.');

 INSERT INTO public.sqf_notifications(recipient_id,kind,title,body)
 VALUES(t.user_id,'support','Suporte atualizado',
        'Consulte a situação da solicitação no painel da conta.');
END;
$fn$;
REVOKE ALL ON FUNCTION public.sqf_staff_support_action(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sqf_staff_support_action(uuid,text) TO authenticated;
COMMIT;
