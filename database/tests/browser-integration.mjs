import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin='http://127.0.0.1:8080';
const browser=await chromium.launch({headless:true});
const sizes=[360,390,768,1366];
const faults=[],legacyRequests=[];
async function makePage(){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(/supabase/i.test(url.hostname)||/supabase-(?:config|js)/i.test(url.pathname))legacyRequests.push(url.origin+url.pathname);
   return url.origin===origin?route.continue():route.abort();
 });
 const page=await context.newPage();
 page.on('pageerror',e=>{faults.push(e.message);console.error('Browser page error:',e.message);});
 page.on('response',r=>{if(r.url().includes('/api/index.php')&&r.status()>=400)console.error('API failure:',r.status(),new URL(r.url()).searchParams.get('route'));});
 return {context,page};
}
async function widthCheck(page,label){
 for(const width of sizes){
   await page.setViewportSize({width,height:844});
   const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
   assert.ok(metrics.scroll<=metrics.inner+2,label+' horizontal overflow at '+width+': '+metrics.scroll);
 }
 console.log('PASS: '+label+' at '+sizes.join(', ')+'px');
}
async function login(page,email,password){
 await page.goto(origin+'/entrar.html');
 await page.locator('html[data-sqf-auth="guest"]').waitFor();
 assert.equal(await page.evaluate(()=>window.SQFDataMode),'mysql');
 await page.locator('#email').fill(email);
 await page.locator('#password').fill(password);
 const responsePromise=page.waitForResponse(r=>new URL(r.url()).searchParams.get('route')==='login');
 await page.locator('#submitBtn').click();
 const response=await responsePromise;assert.equal(response.status(),200,'login HTTP status');
 await page.waitForURL('**/painel-mysql.html');
 await page.locator('#mysqlContent').waitFor({state:'visible'});
}
try{
 const provider=await makePage(), client=await makePage();
 await provider.page.goto(origin+'/entrar.html');await widthCheck(provider.page,'login');
 await provider.page.goto(origin+'/cadastro.html');await widthCheck(provider.page,'signup');
 await login(provider.page,'fixture1@example.invalid','browser-provider-12345');
 assert.match(await provider.page.locator('#mysqlTitle').textContent(),/prestador/);
 await provider.page.locator('#mysqlPortfolioSection').waitFor({state:'visible'});
 await widthCheck(provider.page,'provider dashboard');
 const service=provider.page.locator('#mysqlServiceForm');
 await service.locator('select[name=category_id]').selectOption({index:0});
 await service.locator('input[name=service_title]').fill('Serviço teste de navegador');
 await service.locator('textarea[name=description]').fill('Serviço para validar a integração ponta a ponta.');
 await service.locator('button[type=submit]').click();
 await provider.page.locator('#mysqlServices').getByText('Serviço teste de navegador',{exact:true}).waitFor();
 console.log('PASS: provider creates service via UI');
 const professional=provider.page.locator('#mysqlProfessionalForm');
 await professional.locator('[name=professional_title]').fill('Técnico em informática');
 await professional.locator('[name=specialties]').fill('Redes e manutenção');
 await professional.locator('[name=service_mode]').selectOption('hibrido');
 await professional.locator('[name=workdays][value=seg]').check();
 await professional.locator('button[type=submit]').click();
 await provider.page.getByText('Informações profissionais salvas.',{exact:true}).waitFor();
 const created=provider.page.locator('#mysqlServices article').filter({hasText:'Serviço teste de navegador'});
 await created.getByRole('button',{name:'Editar serviço'}).click();
 await service.locator('[name=service_title]').fill('Serviço teste de navegador editado');
 await service.locator('button[type=submit]').click();
 await provider.page.locator('#mysqlServices').getByText('Serviço teste de navegador editado',{exact:true}).waitFor();
 await widthCheck(provider.page,'professional details and service edit');
 console.log('PASS: provider saves professional details and edits service');
 await login(client.page,'auth-fixture@example.invalid','new-fixture-password-5678');
 assert.match(await client.page.locator('#mysqlTitle').textContent(),/cliente/);
 await widthCheck(client.page,'client dashboard');
 const discovery=client.page.locator('#mysqlDiscoveryForm');
 await discovery.locator('input[name=city]').fill('2111300');
 await discovery.locator('button[type=submit]').click();
 const result=client.page.locator('#mysqlDiscoveryResults');
 await result.getByRole('button',{name:'Ver serviços'}).first().click();
 await result.getByRole('button',{name:'Solicitar orçamento'}).waitFor();
 await result.locator('select').selectOption({label:'Serviço teste de navegador editado'});
 await result.locator('textarea').fill('Solicitação de navegador para validar o fluxo de contratação.');
 await result.getByRole('button',{name:'Solicitar orçamento'}).click();
 await client.page.locator('#mysqlRequests').getByText('Solicitação de navegador para validar o fluxo de contratação.',{exact:true}).waitFor();
 await provider.page.reload();await provider.page.locator('#mysqlContent').waitFor({state:'visible'});
 await provider.page.locator('#mysqlRequests').getByText('Solicitação de navegador para validar o fluxo de contratação.',{exact:true}).waitFor();
 console.log('PASS: client finds provider and creates request; provider sees it in independent session');
 await client.page.goto(origin+'/index.html');
 await client.page.locator('html[data-sqf-auth="user"]').waitFor();
 assert.equal(await client.page.locator('.sqf-account-link').first().getAttribute('href'),'painel-mysql.html');
 await client.page.goto(origin+'/categorias.html?cidade=2111300');
 await client.page.locator('html[data-sqf-auth="user"]').waitFor();
 assert.equal(await client.page.locator('.sqf-account-link').first().getAttribute('href'),'painel-mysql.html');
 await client.page.goto(origin+'/painel-mysql.html');await client.page.locator('#mysqlContent').waitFor({state:'visible'});
 console.log('PASS: public pages preserve authenticated MySQL navigation');
 const categoryId=await provider.page.locator('#mysqlServiceForm select[name=category_id]').inputValue();
 // Use category from the service created above (first active category).
 await client.page.goto(origin+'/categoria.html?id='+encodeURIComponent(categoryId)+'&cidade=2111300');
 await client.page.locator('#categoryContent').waitFor({state:'visible'});
 await client.page.locator('#sqfSaveCategory').waitFor({state:'visible'});
 await client.page.locator('#sqfSaveCategory').click();
 await client.page.locator('#sqfSaveCategory[aria-pressed="true"]').waitFor();
 await widthCheck(client.page,'category detail');
 await client.page.locator('#providersList a.provider-card-link').first().click();
 await client.page.waitForURL('**/prestador-mysql.html?*');
 await client.page.locator('#publicProviderContent').waitFor({state:'visible'});
 await client.page.getByRole('button',{name:'Salvar profissional'}).click();
 await client.page.getByRole('button',{name:'Remover dos favoritos'}).waitFor();
 await widthCheck(client.page,'public provider');
 await client.page.goto(origin+'/painel-mysql.html');await client.page.locator('#mysqlContent').waitFor({state:'visible'});
 await client.page.locator('#mysqlFavorites').getByRole('button',{name:'Remover favorito'}).click();
 await client.page.locator('#mysqlFavorites').getByText('Nenhuma categoria favorita.').waitFor();
 console.log('PASS: category detail, public provider and private favorites UI');
 await client.page.locator('#mysqlProviderFavorites').getByRole('button',{name:'Remover profissional'}).click();
 await client.page.locator('#mysqlProviderFavorites').getByText('Nenhum profissional favorito.').waitFor();
 await provider.page.locator('#mysqlMetricsSection').waitFor({state:'visible'});
 await client.page.locator('#mysqlQuoteCompareSection').waitFor({state:'visible'});
 await client.page.evaluate(()=>sessionStorage.setItem('sqf-search-history-session',JSON.stringify([{q:'Serviço de teste',city:'2111300'}])));
 await client.page.reload();await client.page.locator('#mysqlContent').waitFor({state:'visible'});
 await client.page.locator('#mysqlRecentSearches').getByRole('link',{name:'Serviço de teste'}).waitFor();
 await client.page.locator('#mysqlClearRecent').click();
 await client.page.locator('#mysqlRecentSearches').getByText('Nenhuma busca recente.').waitFor();
 console.log('PASS: recent searches retained and removable in client dashboard');
 const pref=client.page.locator('#mysqlNotificationPreference');
 await pref.locator('input[name=email_enabled]').check();
 await pref.getByRole('button',{name:'Salvar preferência'}).click();
 await client.page.getByText('Preferência salva.',{exact:true}).waitFor();
 await client.page.reload();await client.page.locator('#mysqlContent').waitFor({state:'visible'});
 assert.equal(await pref.locator('input[name=email_enabled]').isChecked(),true);
 await pref.locator('input[name=email_enabled]').uncheck();
 await pref.getByRole('button',{name:'Salvar preferência'}).click();
 await client.page.getByText('Preferência salva.',{exact:true}).waitFor();
 const unread=provider.page.locator('#mysqlNotifications article').filter({hasText:'Não lida'}).first();
 await unread.getByRole('button',{name:'Marcar como lida'}).click();
 await provider.page.locator('#mysqlNotifications').getByText('Lida',{exact:true}).first().waitFor();
 await widthCheck(client.page,'account security and notifications');
 console.log('PASS: notification preference persists and provider marks notification read');
 // Ordinary accounts must never see administrative queues or MFA controls.
 for(const [actor,label] of [[client,'client'],[provider,'provider']]){
   await actor.page.goto(origin+'/admin-mysql.html');
   await actor.page.locator('#staffStatus').getByText('Acesso administrativo negado',{exact:true}).waitFor();
   assert.equal(await actor.page.locator('#staffMfa').isVisible(),false);
   assert.equal(await actor.page.locator('#staffQueue').locator('article').count(),0);
   await widthCheck(actor.page,label+' denied admin page');
 }
 const guest=await makePage();
 await guest.page.goto(origin+'/admin-mysql.html');
 await guest.page.waitForURL('**/entrar.html');
 await guest.context.close();
 console.log('PASS: guest, client and provider cannot access administrative queues');
 await client.page.goto(origin+'/painel-mysql.html');
 await client.page.locator('#mysqlContent').waitFor({state:'visible'});
 await client.page.locator('#mysqlLogout').click();await client.page.waitForURL('**/entrar.html');
 await client.page.goto(origin+'/painel-mysql.html');await client.page.waitForURL('**/entrar.html');
 console.log('PASS: logout prevents dashboard access');
 assert.deepEqual(faults,[],'unexpected uncaught browser errors');
 assert.deepEqual(legacyRequests,[],'candidate must not attempt Supabase requests');
 console.log('PASS: isolated package browser makes no Supabase SDK or endpoint requests');
}finally{await browser.close();}
