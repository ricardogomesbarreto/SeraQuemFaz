'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function moduleExports(){
  const ctx={window:{SQFProfiles:{}}, console};vm.createContext(ctx);vm.runInContext(read('assets/client-dashboard.js'),ctx);
  return ctx.window.SQFClientDashboard;
}
test('v3.7.0 separa painéis por tipo de conta sem alterar autenticação',()=>{
  const html=read('painel.html'),js=read('assets/account.js');
  assert.match(html,/id="clientDashboard"[^>]*hidden/);
  assert.match(html,/id="providerEditor" hidden/);
  assert.match(html,/id="providerOverview" hidden/);
  assert.match(js,/profile\.account_type==='prestador'/);
  assert.match(js,/window\.SQFClientDashboard\.init\(client,user\)/);
  assert.match(js,/\$\('providerAsideBrand'\)\.hidden=true/);
  assert.match(read('assets/auth.js'),/location\.assign\('painel\.html'\)/);
  assert.match(html,/assets\/brand\/logo-horizontal-footer\.png/);
});
test('cliente visualiza atendimentos, avaliações, favoritos, atualizações e pedidos LGPD',()=>{
  const html=read('painel.html');
  for(const id of ['clientEngagements','clientReviews','clientReviewTodo','clientFavorites','clientUpdates','clientPrivacyRequests','clientStatRequested','clientStatConfirmed','clientStatToReview','clientStatFavorites','clientRefresh']){
    assert.ok(html.includes(`id="${id}"`),id);
  }
});
test('resumo conta somente atendimentos confirmados ainda sem avaliação por atendimento',()=>{
  const app=moduleExports();
  const engagements=[{id:'e1',status:'requested'},{id:'e2',status:'confirmed'},{id:'e3',status:'confirmed'}];
  const reviews=[{engagement_id:'e2',rating:5,moderation_status:'pending'}];
  assert.deepEqual(JSON.parse(JSON.stringify(app.summary(engagements,reviews,[{provider_id:'p1'}]))),{requested:1,confirmed:2,toReview:1,favorites:1});
  assert.equal(app.isUnreviewed(engagements[1],new Set(['e2'])),false);
  assert.equal(app.isUnreviewed(engagements[2],new Set(['e2'])),true);
});
test('cliente lê apenas campos mínimos e evita filtros por colunas privadas de outros usuários',()=>{
  const js=read('assets/client-dashboard.js');
  assert.match(js,/select\('id,provider_id,status,requested_at,confirmed_at'\)/);
  assert.match(js,/select\('id,provider_id,engagement_id,rating,comment,created_at,moderation_status'\)/);
  const fetchSection=js.slice(js.indexOf('async function fetchSafe'),js.indexOf('function display'));
  assert.doesNotMatch(fetchSection,/\.eq\('client_id'/);
  assert.doesNotMatch(fetchSection,/\.eq\('reviewer_id'/);
  assert.doesNotMatch(js,/\.innerHTML\s*=/);
  assert.match(js,/unavailable\?\.favorites/);
});
test('favoritos privados só permitem cliente salvar prestador público aprovado',()=>{
  const sql=read('supabase/migrations/20261104_06_painel_cliente_favoritos.sql');
  assert.match(sql,/create table if not exists public\.sqf_client_favorites/);
  assert.match(sql,/primary key \(client_id, provider_id\)/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/client_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/p\.account_type='cliente'/);
  assert.match(sql,/public\.sqf_provider_public\(provider_id\)/);
  assert.doesNotMatch(sql,/create policy[^;]+for update/is);
  assert.match(read('assets/provider.js'),/providerFavoriteButton/);
  assert.match(read('prestador.html'),/id="providerFavoriteBox"/);
});
test('painel profissional mantém serviços, portfólio, verificação, respostas e atendimentos',()=>{
  const html=read('painel.html'),js=read('assets/account.js');
  for(const id of ['providerStatServices','providerStatPhotos','providerStatPending','providerStatReviews','providerVerificationCard','providerEngagementsCard','providerServicesCard','providerPortfolioCard','providerReviewsCard'])assert.match(html,new RegExp(`id="${id}"`));
  for(const code of ['loadServices','loadPhotos','loadOwnReviews','loadVerification','loadPendingEngagements'])assert.match(js,new RegExp(code));
});
test('cliente mantém dados pessoais, privacidade e avatar privado, sem publicação profissional',()=>{
  const html=read('painel.html'),js=read('assets/account.js');
  assert.match(html,/id="privacyRequestForm"/);
  assert.match(html,/id="profileForm"/);
  assert.match(js,/\$\('profileBioGroup'\)\.hidden=true/);
  assert.match(js,/\$\('profilePublicGroup'\)\.hidden=true/);
  assert.match(js,/sqf-client-avatars/);
  assert.doesNotMatch(js,/\$\('accountAvatarSection'\)\.hidden=true/);
});
