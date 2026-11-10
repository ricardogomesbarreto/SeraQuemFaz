'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const scope={window:{},URL};vm.createContext(scope);
vm.runInContext(read('assets/professional-details.js'),scope);
const helper=scope.window.SQFProfessionalDetails;
const build=(overrides={})=>{
  const values={professional_title:'Eletricista residencial',specialties:'Instalações, manutenção',experience_years:'5',service_mode:'presencial',coverage_area:'Centro e bairros próximos',work_period:'manha',quote_policy:'sob_consulta',professional_website:'https://exemplo.com.br',...overrides};
  return {
    querySelector(sel){const name=sel.match(/\[name="([^"]+)"\]/)?.[1];return name?{value:values[name]??''}:null;},
    querySelectorAll(sel){return sel==='[name="workdays"]:checked'?[{value:'1'},{value:'5'}]:[];}
  };
};
test('cadastro profissional permite modo, especialidades e horários opcionais com limite seguro',()=>{
  const result=helper.readForm(build());
  assert.equal(result.professional_title,'Eletricista residencial');
  assert.equal(result.experience_years,5);
  assert.equal(result.workdays.join(','),'1,5');
  assert.equal(result.professional_website,'https://exemplo.com.br/');
  assert.equal(helper.MODES.presencial,'Presencial');
});
test('link externo só aceita HTTPS e rejeita credenciais/URLs perigosas',()=>{
  for(const bad of ['javascript:alert(1)','http://exemplo.com','https://usuario:senha@site.com','ftp://site.com','https://localhost/'])
    assert.equal(helper.allowedUrl(bad),null,bad);
  assert.throws(()=>helper.readForm(build({professional_website:'javascript:alert(1)'})),/HTTPS/);
});
test('experiência inválida é rejeitada e preenchimento complementar não bloqueia a conta',()=>{
  assert.throws(()=>helper.readForm(build({experience_years:'81'})),/0 e 60/);
  assert.throws(()=>helper.readForm(build({service_mode:'ficticio'})),/opções válidas/);
  const empty=helper.readForm(build({professional_title:'',specialties:'',experience_years:'',service_mode:'nao_informado',coverage_area:'',work_period:'nao_informado',professional_website:''}));
  assert.equal(empty.experience_years,null);
  assert.equal(helper.completion(empty).done,1); // Dias selecionados do formulário simulado
});
test('todos os dias são normalizados e rótulos exibidos corretamente',()=>{
  assert.equal(helper.normalizeDays([7,1,1,5,0,'2',11]).join(','),'1,2,5,7');
  assert.equal(helper.WORKDAY_LABELS[7],'Domingo');
});
test('HTML mantém painéis anteriores e inclui informações opcionais no mesmo design',()=>{
  const html=read('painel.html');
  for(const id of ['providerReadiness','providerVerificationCard','providerEngagementsCard','providerServicesCard','providerPortfolioCard','providerReviewsCard','professionalDetailsForm','providerDetailsCard'])
    assert.match(html,new RegExp(`id="${id}"`));
  for(const id of ['professionalTitle','professionalExperience','professionalSpecialties','professionalServiceMode','professionalCoverage','professionalWebsite'])
    assert.match(html,new RegExp(`id="${id}"`));
  assert.equal((html.match(/name="workdays"/g)||[]).length,7);
  assert.match(html,/estes campos são opcionais/i);
  assert.match(html,/assets\/professional-details\.js/);
  assert.match(read('prestador.html'),/id="providerProfessionalFacts"/);
  assert.match(read('assets/site.css'),/professional-details-card/);
});
test('SQL impõe RLS, privilégio mínimo, reanálise e consulta administrativa com MFA',()=>{
  const sql=read('supabase/migrations/20261104_07_perfil_profissional_detalhado.sql');
  for(const token of [
    'create table if not exists public.provider_professional_details',
    'enable row level security','for select to anon,authenticated',
    'for insert to authenticated','for update to authenticated',
    'provider_id = (select auth.uid())','public.sqf_provider_public(provider_id)',
    "status = 'pending'", 'sqf_details_require_reapproval',
    'public.sqf_require_staff(true)','sqf_staff_provider_professional_details'
  ])assert.ok(sql.includes(token),token);
  assert.doesNotMatch(sql,/grant\s+delete\s+on\s+public\.provider_professional_details/i);
  assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\b[^;]*\bto\s+anon/i);
});
test('página pública utiliza só dados permitidos e links externos seguros',()=>{
  const pub=read('assets/provider.js');
  const panel=read('assets/account.js');
  assert.match(pub,/client\.from\('provider_professional_details'\)/);
  assert.match(pub,/helpers\.allowedUrl/);
  assert.match(pub,/noopener noreferrer nofollow/);
  assert.match(panel,/client\.from\('provider_professional_details'\)/);
  assert.match(panel,/await loadVerification\(\)/);
  assert.match(read('assets/admin.js'),/sqf_staff_provider_professional_details/);
});

test('edição de serviço mantém categoria, título, descrição e escopo do proprietário',()=>{
  const account=read('assets/account.js');
  assert.match(account,/Editar serviço/);
  assert.match(account,/\.update\(\{category_id:categoryId,service_title:title,description,/);
  assert.match(account,/\.\.\.money,is_active:isActive\.checked/);
  assert.match(account,/\.eq\('id',service\.id\)\.eq\('provider_id',user\.id\)/);
  assert.match(account,/\.eq\('id',service\.id\)\.eq\('provider_id',user\.id\)/);
  assert.match(account,/await loadServices\(\);await loadVerification\(\)/);
  assert.match(read('assets/site.css'),/service-inline-editor\[hidden\]/);
});
