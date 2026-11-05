'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const portrait=require('../assets/portrait.js');

test('a versão v3.6.1 mantém a identidade e os dados existentes',()=>{
  assert.match(read('index.html'),/SERÁ QUEM FAZ\?/);
  assert.match(read('index.html'),/profissionais-landing\.webp/);
  assert.match(read('assets/provider.js'),/sqf_public_reviews/);
  assert.match(read('assets/admin.js'),/sqf_staff_decide/);
});
test('cidade selecionada e quantidade real de categorias aparecem no catálogo',()=>{
  assert.match(read('categorias.html'),/id="catalogCityHighlight"/);
  assert.match(read('categorias.html'),/id="catalogVisibleCount"/);
  assert.match(read('assets/categories.js'),/filtered\.length/);
  assert.match(read('assets/categories.js'),/SQFCities\.format\(selectedCity\)/);
});
test('filtros ativos podem ser retirados individualmente sem apagar a cidade',()=>{
  const js=read('assets/categories.js');
  assert.match(js,/filter-tag-removable/);
  assert.match(js,/Remover filtro/);
  assert.match(js,/id\)/); // preserva lógica existente de URL por cidade
  assert.match(read('categorias.html'),/id="applyFilters"/);
});
test('cartões mostram retrato, localidade, serviços, avaliação real e nota de confiança sem selo indevido',()=>{
  const js=read('assets/category-detail.js');
  for(const token of ['ui.avatar(', 'provider-card-local', 'provider-card-speciality', 'provider-verification-note', 'ui.ratingLine('])assert.ok(js.includes(token),token);
  assert.doesNotMatch(js,/Garantia de idoneidade/);
});
test('perfil profissional tem quatro abas acessíveis e navegação por teclado',()=>{
  const html=read('prestador.html'),js=read('assets/provider.js');
  for(const key of ['about','services','portfolio','reviews']){
    assert.match(html,new RegExp(`data-profile-tab="${key}"`));
  }
  assert.match(html,/role="tablist"/);
  assert.match(html,/role="tabpanel"/);
  assert.match(js,/aria-selected/);
  assert.match(js,/ArrowRight/);
  assert.match(js,/ArrowLeft/);
});
test('avaliações oferecem resumo, distribuição, filtros e respostas moderadas',()=>{
  const html=read('prestador.html'),js=read('assets/provider.js');
  for(const id of ['ratingSummary','ratingBreakdown','reviewFilters','reviewSort','reviewStarFilter'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/sqf_public_review_responses/);
  assert.match(js,/publishedReviews\.filter/);
  assert.match(js,/Atendimento declarado por ambas as contas/);
});
test('foto do perfil aceita orientações variadas e não exige resolução fixa',()=>{
  for(const pair of [[1280,720],[720,1280],[960,960]]){
    const result=portrait.crop(...pair,{zoom:1.3,panX:40,panY:70});
    assert.ok(result.sw>0 && result.sh>0 && result.width>0 && result.height>0);
    assert.ok(Math.max(result.width,result.height)<=portrait.MAX_SIDE);
  }
  assert.throws(()=>portrait.crop(100,100));
  const html=read('painel.html');
  assert.match(html,/id="portraitZoom"/);
  assert.match(html,/id="portraitPanX"/);
  assert.match(html,/id="portraitPanY"/);
  assert.match(html,/a imagem enviada não precisa ser 3×4/);
});
test('retrato processado permanece separado da galeria de portfólio',()=>{
  const js=read('assets/account.js');
  assert.match(js,/preparedPortrait\.blob/);
  assert.match(js,/SQFPortrait\.process\(file,options\)/);
  assert.match(js,/sqf-portfolios/);
  assert.match(js,/portraitDeclaration/);
});
test('cadastro indica progresso sem considerar conta ou identidade confirmada',()=>{
  assert.match(read('cadastro.html'),/id="signupProgress"/);
  assert.match(read('assets/auth.js'),/updateSignupProgress/);
  assert.match(read('assets/auth.js'),/A confirmação de e-mail vem depois do envio/);
});
test('painel do prestador exibe o que falta e mantém análise humana',()=>{
  assert.match(read('painel.html'),/id="providerReadiness"/);
  assert.match(read('assets/account.js'),/updateReadiness/);
  assert.match(read('assets/account.js'),/currentVerification/);
  assert.match(read('assets/account.js'),/Aguardando análise da equipe/);
});
test('painel administrativo mantém MFA, filas e filtros locais',()=>{
  const js=read('assets/admin.js'),html=read('admin.html');
  assert.match(js,/sqf_staff_whoami/);
  assert.match(js,/own\.mfa_ready/);
  assert.match(js,/renderQueue/);
  assert.match(js,/lastQueueItems\.filter/);
  assert.match(html,/id="adminSearch"/);
  assert.match(html,/id="adminStateFilter"/);
});
test('denúncias abertas recebem indicação de triagem sem alegar gravidade verificada',()=>{
  assert.match(read('assets/admin.js'),/Denúncia aberta · requer triagem/);
  assert.match(read('assets/admin.js'),/\['pending','reviewing'\]/);
});
test('estilos preservam layout responsivo, foco e redução de movimento',()=>{
  const css=read('assets/site.css');
  assert.match(css,/:focus-visible/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.profile-tabs/);
  assert.match(css,/\.review-filters/);
});
test('v3.6.1 não modifica migrações existentes nem simula produção',()=>{
  const docs=read('README.md');
  assert.match(docs,/Supabase/);
  assert.match(docs,/NÃO/);
  for(const file of ['20261103_03_confianca_seguranca.sql','20261103_04_painel_admin_mfa.sql','20261103_05_antiabuso_retratos.sql']){
    assert.ok(fs.existsSync(path.join(base,'supabase/migrations',file)));
  }
});
