'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('painel possui IDs únicos e formulários e details equilibrados',()=>{
 const html=read('painel.html');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,'IDs duplicados quebram seleção de controles');
 for(const [open,close] of [['<form','</form>'],['<details','</details>']])
  assert.equal(html.split(open).length-1,html.split(close).length-1);
 for(const id of ['providerServicesSection','providerPortfolioSection','providerReviewsSection',
   'clientInfo','providerAsideBrand','accountTypeSubtitle','accountCity','sqfCategoryFavorites',
   'sqfSecuritySection','sqfRequestPortal','sqfRequestFilter'])
  assert.match(html,new RegExp('id="'+id+'"'),id);
 assert.match(html,/Perfil de prestador de serviço/);
 assert.match(html,/Perfil de cliente/);
 assert.match(html,/assets\/dashboard-router\.js/);
});

test('navegação usa URLs por perfil e apenas a tela ativa aparece',()=>{
 const code=read('assets/dashboard-router.js');
 const window={addEventListener(){},location:{},};
 const doc={getElementById(){return null;}};
 const context=vm.createContext({window,document:doc});
 vm.runInContext(code,context);
 const client=Array.from(window.SQFDashboardRoutes.cliente);
 const provider=Array.from(window.SQFDashboardRoutes.prestador);
 assert.deepEqual(client,['visao-geral','editar-perfil','atividades','favoritos','agenda','configuracoes']);
 assert.deepEqual(provider,['visao-geral','editar-perfil','solicitacoes','servicos','portfolio',
   'agenda','desempenho','verificacao','assinatura','configuracoes']);
 assert.match(code,/node\.hidden=node\.dataset\.sqfRoute!==next/);
 assert.match(code,/window\.addEventListener\('popstate'/);
 assert.match(code,/history\[method\]/);
 assert.match(code,/set\('pagina',currentKey\(\)\+'\/'\+slug\)/);
 assert.match(code,/if\(!pages\[role\]\)return/);
 assert.doesNotMatch(code,/innerHTML\s*=/);
});

test('perfil carregado sinaliza prontidão somente após registrar eventos',()=>{
 const js=read('assets/account.js');
 assert.match(js,/sqf:account-ready/);
 assert.match(js,/syncProviderSidebar\(\)/);
 assert.match(js,/syncClientSidebar\(\)/);
 assert.match(js,/accountTypeSubtitle/);
 assert.match(js,/accountCity/);
 assert.match(js,/await reloadActiveCategories\(\)/);
 assert.match(js,/\$\('clientLogoutSlot'\)\.append\(\$\('logoutButton'\)\)/);
 assert.match(js,/\$\('providerLogoutSlot'\)\.append\(\$\('logoutButton'\)\)/);
});

test('preços opcionais e pausas de serviço são validados no cliente e banco',()=>{
 const html=read('painel.html'),account=read('assets/account.js');
 const sql=read('supabase/migrations/20261109_18_paineis_servicos_portfolio.sql');
 for(const id of ['newServicePriceMin','newServicePriceMax','newServiceActive'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(account,/centsFor\(/);
 assert.match(account,/\.eq\('is_active',true\)/);
 assert.match(account,/price_min_cents/);
 assert.match(account,/price_max_cents/);
 assert.match(account,/is_active:isActive\.checked/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true/);
 assert.match(sql,/sqf_provider_services_price_bounds/);
 assert.match(sql,/is_active=true AND public\.sqf_provider_public/);
 assert.match(read('assets/provider.js'),/\.eq\('is_active',true\)/);
});

test('capa privada só é alterada por função autenticada do proprietário',()=>{
 const sql=read('supabase/migrations/20261109_18_paineis_servicos_portfolio.sql');
 const account=read('assets/account.js');
 assert.match(sql,/sqf_set_portfolio_cover\(p_photo uuid\)/);
 assert.match(sql,/provider_id=actor FOR UPDATE/);
 assert.match(sql,/service_id IS NOT DISTINCT FROM target\.service_id/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.sqf_set_portfolio_cover\(uuid\) FROM PUBLIC,anon/);
 assert.match(account,/sqf_set_portfolio_cover/);
 assert.match(read('assets/provider.js'),/sqf-portfolio-cover-badge/);
});

test('categorias favoritas usam RLS; histórico é temporário por sessão',()=>{
 const html=read('categoria.html'),fav=read('assets/client-category-favorites.js');
 const sql=read('supabase/migrations/20261109_18_paineis_servicos_portfolio.sql');
 assert.match(html,/id="sqfSaveCategory"/);
 assert.match(sql,/sqf_client_category_favorites/);
 assert.match(sql,/client_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/p\.account_type='cliente'/);
 assert.match(fav,/sessionStorage/);
 assert.match(fav,/sqf_client_category_favorites/);
 assert.doesNotMatch(fav,/localStorage|service_role/);
});

test('filtros de catálogo não simulam avaliações ou fotografias inexistentes',()=>{
 const detail=read('assets/category-detail.js'),cat=read('categoria.html');
 for(const id of ['sqfOnlyPortfolio','sqfOnlyReviews','sqfProviderSort','sqfCategoryNoResults'])
  assert.match(cat,new RegExp('id="'+id+'"'));
 assert.match(detail,/sqf_public_reviews/);
 assert.match(detail,/photoCounts/);
 assert.match(detail,/reviewCount>0/);
 assert.match(detail,/completeness/);
 assert.match(detail,/sqfCategoryNoResults/);
 assert.doesNotMatch(detail,/Math\.random\(/);
 const home=read('index.html');
 assert.match(home,/id="sqfClientJourney"/);
 assert.match(home,/id="sqfProviderJourney"/);
 assert.match(home,/id="confianca"/);
 assert.match(home,/homeCitySearch/);
});

test('configurações atualizam senha sem armazenamento e sem registrar credenciais',()=>{
 const code=read('assets/account-security.js'),html=read('painel.html');
 assert.match(html,/id="sqfNewPassword"[^>]*type="password"|type="password" id="sqfNewPassword"/);
 assert.match(code,/auth\.updateUser\(\{password:newPassword\}\)/);
 assert.match(code,/newPassword\.length<12/);
 assert.match(code,/form\.reset\(\)/);
 assert.doesNotMatch(code,/localStorage|sessionStorage|console\.log\(/);
});
