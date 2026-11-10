import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin='http://127.0.0.1:8080';
const browser=await chromium.launch({headless:true});
const sizes=[360,390,768,1366];
const faults=[];
async function makePage(){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>{
   const url=new URL(route.request().url());
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
 await login(client.page,'auth-fixture@example.invalid','new-fixture-password-5678');
 assert.match(await client.page.locator('#mysqlTitle').textContent(),/cliente/);
 await widthCheck(client.page,'client dashboard');
 const discovery=client.page.locator('#mysqlDiscoveryForm');
 await discovery.locator('input[name=city]').fill('2111300');
 await discovery.locator('button[type=submit]').click();
 const result=client.page.locator('#mysqlDiscoveryResults');
 await result.getByRole('button',{name:'Ver serviços'}).first().click();
 await result.getByRole('button',{name:'Solicitar orçamento'}).waitFor();
 await result.locator('select').selectOption({label:'Serviço teste de navegador'});
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
 await client.page.locator('#mysqlLogout').click();await client.page.waitForURL('**/entrar.html');
 await client.page.goto(origin+'/painel-mysql.html');await client.page.waitForURL('**/entrar.html');
 console.log('PASS: logout prevents dashboard access');
 assert.deepEqual(faults,[],'unexpected uncaught browser errors');
}finally{await browser.close();}
