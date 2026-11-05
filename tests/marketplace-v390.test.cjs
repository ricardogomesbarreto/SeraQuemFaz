const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=read('supabase/migrations/20261104_09_solicitacoes_mensagens.sql');
const portal=read('assets/request-portal.js');
const media=read('assets/request-media.js');

test('registros privados de solicitações, mensagens, anexos e eventos exigem RLS',()=>{
 for(const name of ['sqf_service_requests','sqf_request_messages','sqf_request_attachments','sqf_request_events']){
  assert.match(migration,new RegExp(`create table if not exists public\\.${name}`));
  assert.match(migration,new RegExp(`alter table public\\.${name} enable row level security`));
 }
 assert.match(migration,/revoke all on public\.sqf_service_requests.*from public,anon,authenticated/);
 assert.doesNotMatch(migration,/grant (insert|update|delete) on public\.sqf_service_requests to authenticated/i);
});
test('solicitação é criada via RPC com usuário logado e e-mail confirmado',()=>{
 assert.match(migration,/create or replace function public\.sqf_create_request/);
 assert.match(migration,/sqf_email_confirmed\(v_client\)/);
 assert.match(migration,/sqf_provider_public\(p_provider\)/);
 assert.match(migration,/s\.id=p_service and s\.provider_id=p_provider/);
 assert.match(migration,/account_type='cliente'/);
});
test('existe rate limit de solicitações, mensagens e rejeição de duplicatas recentes',()=>{
 assert.match(migration,/count\(\*\).*public\.sqf_service_requests where client_id=v_client/s);
 assert.match(migration,/count\(\*\).*public\.sqf_request_messages/s);
 assert.match(migration,/Já existe solicitação em aberto para este serviço/);
});
test('transições de atendimento são explícitas, participantes apenas, e rastreadas',()=>{
 for(const action of ['decline','cancel','accept','start','finish','confirm'])assert.ok(migration.includes(`p_action='${action}'`));
 assert.match(migration,/v_actor not in \(v_req\.client_id,v_req\.provider_id\)/);
 assert.match(migration,/insert into public\.sqf_request_events\(request_id,actor_id,action,from_status,to_status/);
 assert.match(migration,/service_engagements\(client_id,provider_id,status/);
});
test('orçamento é transacional, com valor limitado e sem cobrança de serviço',()=>{
 assert.match(migration,/create or replace function public\.sqf_send_quote/);
 assert.match(migration,/p_amount_cents not between 100 and 100000000/);
 assert.match(migration,/not public\.sqf_provider_public\(v_provider\)/);
 assert.match(portal,/Orçamento informativo\. Não há pagamento/);
});
test('fotos privadas com bucket não público, RLS e acesso por URL assinada',()=>{
 assert.match(migration,/sqf-request-attachments','sqf-request-attachments',false,2097152/);
 assert.match(migration,/sqf_request_asset_allowed\(name,true\)/);
 assert.match(migration,/sqf_request_asset_allowed\(name,false\)/);
 assert.match(media,/createSignedUrl\(path,120\)/);
 assert.match(media,/contentType:'image\/webp'/);
 assert.doesNotMatch(media,/getPublicUrl|innerHTML/);
});
test('mensagens não são públicas e o usuário não pode fingir ser outro remetente',()=>{
 assert.match(migration,/sender_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/sqf_is_request_participant\(request_id\)/);
 assert.match(migration,/status not in \('canceled','declined','completed'\)/);
 assert.doesNotMatch(migration,/grant update on public\.sqf_request_messages to authenticated/);
});
test('o cliente usa cadastro existente e fluxo de solicitação no perfil',()=>{
 assert.match(read('prestador.html'),/id="sqfQuotePanel"/);
 assert.match(read('assets/provider.js'),/SQFRequestProfile\?\.setup/);
 assert.match(read('assets/request-profile.js'),/sqf_create_request/);
 assert.match(read('assets/request-profile.js'),/SQFRequestMedia\.upload/);
});
test('painel exibe filas, mensagens privadas e propostas com atualização',()=>{
 for(const id of ['sqfRequestPortal','sqfRequestFilter','sqfRequestList','sqfRequestDetail','sqfRequestStatus'])
  assert.ok(read('painel.html').includes(`id="${id}"`));
 assert.match(portal,/sqf_send_quote/);
 assert.match(portal,/sqf_request_action/);
 assert.match(portal,/sqf_request_messages/);
 assert.match(portal,/\.textContent=/);
 assert.doesNotMatch(portal,/innerHTML/);
});
test('histórico financeiro é acessível ao dono, sem revelar identificadores do gateway',()=>{
 const backend=read('supabase/functions/sqf-billing/index.ts');
 assert.match(backend,/async function history\(user:any\)/);
 assert.match(backend,/\.eq\('subscription_id',sub\.id\)/);
 assert.match(backend,/action==='history' && req\.method==='GET'/);
 assert.match(read('assets/billing.js'),/showHistory\(await request\(client,'history'\)\)/);
 assert.doesNotMatch(backend.slice(backend.indexOf('async function history'),backend.indexOf('async function handleWebhook')),/mp_payment_id/);
});
test('reconciliação agendada continua desativada sem flag e credenciais privadas',()=>{
 const workflow=read('.github/workflows/billing-reconciliation.yml');
 assert.match(workflow,/vars\.SQF_FINANCIAL_RECONCILIATION_ENABLED == 'true'/);
 assert.match(workflow,/secrets\.SQF_RECONCILE_SECRET/);
 assert.match(read('assets/billing-config.js'),/enabled: false/);
});
test('indicadores de pagamentos e padrões suspeitos exigem admin com MFA',()=>{
 assert.match(migration,/sqf_staff_billing_overview/);
 assert.match(migration,/sqf_staff_request_risk_overview/);
 const count=(migration.match(/perform public\.sqf_require_staff\(true\);/g)||[]).length;
 assert.ok(count>=2);
 assert.match(read('admin.html'),/id="sqfAdminBilling"/);
});
test('catálogo tem filtros por modalidade e especialidade sem liberar prestadores não aprovados',()=>{
 const catalog=read('assets/category-detail.js');
 assert.match(catalog,/provider_professional_details/);
 assert.match(catalog,/sqfSpecialtyFilter/);
 assert.match(catalog,/sqfModeFilter/);
 assert.match(catalog,/sqf_public_reviews/);
 assert.match(catalog,/\.eq\('is_public',true\)/);
});
