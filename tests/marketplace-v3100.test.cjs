'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('perfil profissional usa menu lateral responsivo e não remove perfil do cliente',()=>{
 const html=read('painel.html'),css=read('assets/site.css'),js=read('assets/account.js');
 for(const id of ['providerAsideBrand','providerSideAvatar','providerSideName','providerLogoutSlot',
  'providerOverview','providerEditor','profileSettings','clientInfo','clientLogoutSlot',
  'accountSummaryCard','sqfNotificationHub','sqfAppointmentHub','sqfQuoteCompare','sqfSupportHub','sqfPerformanceHub']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(js,/sqf-provider-layout/);
 assert.match(js,/syncProviderSidebar/);
 assert.match(js,/mainColumn\.prepend\(\$\('providerOverview'\)\)/);
 assert.match(js,/\$\('clientLogoutSlot'\)\.append\(\$\('logoutButton'\)\)/);
 assert.match(css,/\.sqf-provider-layout #accountSharedGrid/);
 assert.match(css,/@media\(max-width:820px\)/);
});

test('portfólio classifica trabalhos por serviço do próprio prestador',()=>{
 const html=read('painel.html'),publicPage=read('prestador.html');
 const account=read('assets/account.js'),profile=read('assets/provider.js');
 const sql=read('supabase/migrations/20261109_14_marketplace_experience.sql');
 for(const id of ['portfolioService','portfolioServiceFilter','sqfPublicPortfolioService'])
  assert.ok((html+publicPage).includes('id="'+id+'"'));
 assert.match(account,/portfolio_photos'\)\.insert\(\{/);
 assert.match(account,/service_id:\$\('portfolioService'\)/);
 assert.match(profile,/photo\.service_id/);
 assert.match(sql,/FOREIGN KEY \(service_id,provider_id\) REFERENCES public\.provider_services\(id,provider_id\)/);
});

test('agendamento valida participante e exige concordância da outra parte',()=>{
 const sql=read('supabase/migrations/20261109_14_marketplace_experience.sql');
 const js=read('assets/appointment-ui.js'),portal=read('assets/request-portal.js');
 assert.match(sql,/actor NOT IN \(r\.client_id,r\.provider_id\)/);
 assert.match(sql,/a\.proposed_by=actor/);
 assert.match(sql,/p_action='confirm'/);
 assert.match(sql,/p_action='propose'/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/GRANT SELECT ON public\.sqf_appointments TO authenticated/);
 assert.doesNotMatch(js,/from\('sqf_appointments'\)\.update/);
 assert.match(js,/sqf_manage_appointment/);
 assert.match(portal,/SQFAgenda\?\.render/);
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(js,ctx);
 assert.ok(ctx.window.SQFAgenda);
 assert.equal(ctx.window.SQFAgenda.inputTime(new Date(NaN)),'');
});

test('notificações e métricas não criam dados sintéticos e respeitam controle de acesso',()=>{
 const sql=read('supabase/migrations/20261109_14_marketplace_experience.sql');
 const frontend=read('assets/marketplace-hub.js');
 for(const token of ['sqf_notifications_owner_read','sqf_notifications_owner_update',
   'sqf_support_owner_read','sqf_profile_views','sqf_my_performance','sqf_staff_dashboard_metrics',
   'sqf_staff_support_queue','sqf_staff_support_action','sqf_notification_outbox'])
  assert.ok(sql.includes(token),token);
 assert.match(sql,/auth\.jwt\(\)->>'aal'/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.sqf_notification_preferences/);
 assert.match(sql,/GRANT SELECT,UPDATE\(read_at\) ON public\.sqf_notifications/);
 assert.doesNotMatch(sql,/GRANT INSERT ON public\.sqf_notifications TO authenticated/);
 assert.match(frontend,/sqf_my_performance/);
 assert.match(frontend,/sqf_service_requests/);
 assert.doesNotMatch(frontend,/innerHTML/);
 assert.doesNotMatch(frontend,/service_role/);
});

test('catálogo ordena por avaliação publicada e quantidade real de trabalhos',()=>{
 const html=read('categoria.html'),js=read('assets/category-detail.js');
 for(const id of ['sqfProviderSort','sqfOnlyPortfolio'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/sqf_public_reviews/);
 assert.match(js,/photoOwners/);
 assert.match(js,/b\.rating-a\.rating/);
 assert.match(js,/b\.serviceCount-a\.serviceCount/);
 assert.match(js,/results\.append\(entry\.card\)/);
});

test('PWA nunca guarda conta, sessões ou API privada em cache',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest')),sw=read('service-worker.js'),site=read('assets/site.js');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.lang,'pt-BR');
 assert.match(site,/location\.protocol==='https:'/);
 assert.match(sw,/request\.method!=='GET'/);
 assert.match(sw,/request\.headers\.has\('authorization'\)/);
 assert.match(sw,/url\.origin!==scopeUrl\.origin/);
 assert.match(sw,/publicPages=new Set/);
 assert.doesNotMatch(sw,/['"]\.?\/painel\.html['"]/);
 assert.doesNotMatch(sw,/['"]\.?\/admin\.html['"]/);
 assert.match(read('scripts/build-distribution.sh'),/manifest\.webmanifest service-worker\.js/);
 for(const page of ['index.html','painel.html','prestador.html','categoria.html','categorias.html'])
  assert.match(read(page),/rel="manifest"/);
});

test('central de ajuda e relatórios administrativos com MFA',()=>{
 const help=read('ajuda.html'),admin=read('admin.html'),reports=read('assets/admin-reports.js');
 assert.match(help,/Como podemos ajudar\?/);
 assert.match(help,/painel\.html#sqfSupportHub/);
 assert.match(admin,/id="sqfAdminReportsStats"/);
 assert.match(admin,/id="sqfAdminSupportList"/);
 assert.match(reports,/sqf_staff_dashboard_metrics/);
 assert.match(reports,/sqf_staff_support_queue/);
 assert.match(reports,/sqf_staff_support_action/);
 assert.doesNotMatch(reports,/innerHTML/);
});

test('e-mail opt-in exige segredos privados, desativado sem homologação',()=>{
 const sql=read('supabase/migrations/20261109_14_marketplace_experience.sql');
 const fn=read('supabase/functions/sqf-notifications/index.ts'),workflow=read('.github/workflows/notifications.yml');
 assert.match(sql,/email_enabled boolean NOT NULL DEFAULT false/);
 assert.match(fn,/SQF_NOTIFICATIONS_ENABLED/);
 assert.match(fn,/SQF_NOTIFY_SECRET/);
 assert.match(fn,/Resend/);
 assert.match(workflow,/SQF_NOTIFICATIONS_ENABLED == 'true'/);
 assert.match(workflow,/secrets\.SQF_NOTIFY_SECRET/);
 assert.doesNotMatch(read('assets/marketplace-hub.js'),/RESEND_API_KEY|SQF_NOTIFY_SECRET/);
});
