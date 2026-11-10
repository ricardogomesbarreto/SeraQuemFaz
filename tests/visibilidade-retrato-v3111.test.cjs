'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('retrato na sidebar usa somente a imagem, sem segunda moldura .avatar',()=>{
 const js=read('assets/account.js');
 const begin=js.indexOf('  function paintSidebarPortrait(');
 const end=js.indexOf('  function syncProviderSidebar()',begin);
 assert.ok(begin>=0&&end>begin);
 const declarations=js.slice(begin,end);
 const document={createElement(tag){
   return {tagName:tag.toUpperCase(),className:'',textContent:'',replaceChildren(){},addEventListener(){}};
 }};
 const ctx=vm.createContext({document});
 vm.runInContext(declarations+';globalThis.__paint=paintSidebarPortrait;',ctx);
 const target={replaceChildren(...nodes){this.children=nodes;}};
 const picture={tagName:'IMG',classList:{add(name){this.added=name;}},addEventListener(){}};
 const source={querySelector(selector){
   assert.equal(selector,'img');
   return {cloneNode(deep){assert.equal(deep,true);return picture;}};
 }};
 ctx.__paint(target,source,'Ana');
 assert.equal(target.children.length,1);
 assert.equal(target.children[0].tagName,'IMG');
 assert.equal(target.children[0].classList.added,'sqf-sidebar-photo');
 ctx.__paint(target,{querySelector(){return null;}},'Ana');
 assert.equal(target.children.length,1);
 assert.equal(target.children[0].tagName,'SPAN');
 assert.equal(target.children[0].textContent,'A');
 const css=read('assets/site.css');
 assert.doesNotMatch(css,/\.sqf-sidebar-avatar,\.sqf-sidebar-avatar \.avatar\{/);
 assert.match(css,/\.sqf-sidebar-avatar>\.sqf-sidebar-photo/);
});

test('status distingue análise não solicitada de análise pendente',()=>{
 const js=read('assets/account.js'),html=read('painel.html');
 assert.match(js,/currentVerification==='pending'\s*\?\s*'Aguardando análise'/);
 assert.match(js,/: 'Análise não solicitada'/);
 assert.match(js,/Sua análise cadastral ainda não foi solicitada|Análise não solicitada\. O perfil ainda não aparece para clientes/);
 assert.match(html,/id="providerVerificationShortcut"/);
 assert.match(html,/id="providerPublicationNote"/);
 assert.match(html,/href="#providerVerificationCard"/);
 assert.match(js,/sqf_request_verification/);
});

test('o dono vê prévia privada sem enfraquecer a autorização pública por RLS',()=>{
 const js=read('assets/provider.js'),html=read('prestador.html');
 assert.match(js,/viewingOwnProfile=authUser\?\.id===providerId/);
 assert.match(js,/client\.rpc\('sqf_provider_public',\{p_provider:providerId\}\)/);
 assert.match(js,/publiclyVisible=!error&&data===true/);
 assert.match(js,/notice\.hidden=false/);
 assert.match(html,/id="sqfOwnerPreviewNotice"/);
 assert.match(html,/painel\.html\?pagina=prestador\/verificacao/);
 assert.doesNotMatch(js,/\.eq\('is_public',true\)\.maybeSingle\(\)/);
 assert.match(read('supabase/migrations/20261109_18_paineis_servicos_portfolio.sql'),/public\.sqf_provider_public\(provider_id\)/);
});

test('catálogo não revela cadastros sem verificação nem confunde ausência com falha',()=>{
 const category=read('assets/category-detail.js'),html=read('categoria.html');
 assert.match(category,/Nenhum profissional publicado nesta categoria/);
 assert.match(category,/após análise cadastral e autorização de publicação/);
 assert.match(category,/empty\.hidden=false/);
 assert.match(category,/!profiles\.length/);
 assert.match(category,/\?cidade=|categorias\.html\?cidade=/);
 assert.match(category,/\.eq\('city_ibge',city\.id\)/);
 assert.match(category,/\.eq\('is_active',true\)/);
 assert.match(html,/id="sqfCategoryNoResults"/);
});
