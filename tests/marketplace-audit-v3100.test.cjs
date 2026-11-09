'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('gatilhos são executáveis pelo banco, não diretamente por anon ou authenticated',()=>{
 const sql=read('supabase/migrations/20261109_16_marketplace_trigger_hardening.sql');
 for(const name of ['sqf_notify_request','sqf_notify_message','sqf_notify_appointment',
  'sqf_queue_notification_email','sqf_support_rate_guard']){
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.'+name+'() FROM PUBLIC, anon, authenticated;'),name);
 }
 assert.doesNotMatch(sql,/GRANT EXECUTE .* TO (?:anon|authenticated)/);
});

test('suporte administrativo exige MFA e registra decisão sem conteúdo privado',()=>{
 const sql=read('supabase/migrations/20261109_17_marketplace_support_audit_indices.sql');
 assert.match(sql,/auth\.jwt\(\)->>'aal'/);
 assert.match(sql,/sqf_staff_decision_log/);
 assert.match(sql,/actor,'support',p_ticket,t\.status,next_status/);
 assert.match(sql,/t\.status=next_status/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.sqf_staff_support_action\(uuid,text\) FROM PUBLIC,anon/);
 assert.doesNotMatch(sql,/INSERT INTO public\.sqf_staff_decision_log[\s\S]*?t\.message/);
});

test('índices cobrem chaves externas de portfólio e novos módulos',()=>{
 const sql=read('supabase/migrations/20261109_17_marketplace_support_audit_indices.sql');
 for(const name of ['sqf_portfolio_service_owner_fk_idx','sqf_appointments_client_fk_idx',
  'sqf_appointments_proposer_fk_idx','sqf_notification_outbox_recipient_fk_idx',
  'sqf_notifications_request_fk_idx','sqf_profile_views_viewer_fk_idx'])
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS '+name),name);
});

test('relatórios exportam somente indicadores agregados após consulta autorizada',()=>{
 const html=read('admin.html'),js=read('assets/admin-reports.js');
 assert.match(html,/id="sqfAdminReportsExport"[^>]+disabled/);
 assert.match(js,/sqf_staff_dashboard_metrics/);
 assert.match(js,/metricsSnapshot=counters/);
 assert.match(js,/metricsSnapshot=null/);
 assert.match(js,/exportButton\?\.addEventListener\('click',exportMetrics\)/);
 assert.match(js,/text\/csv;charset=utf-8/);
 assert.doesNotMatch(js,/auth\.admin|service_role|\.innerHTML\s*=/);
});
