'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function load(file,name){
 const context=vm.createContext({});
 vm.runInContext(read(file),context);
 assert.ok(context[name]);
 return context[name];
}
const categories=[
 {name:'Eletricista',description:'Instalação e reparo de energia'},
 {name:'Técnico de Informática',description:'Instalação e manutenção de computadores'},
 {name:'Limpeza',description:'Limpeza de imóveis'},
 {name:'Advogado',description:'Consultoria jurídica'},
 {name:'Técnico em Refrigeração',description:'Reparos em refrigeração'}
];

test('busca livre identifica profissão real por termo do cotidiano',()=>{
 const finder=load('assets/category-search.js','SQFCategorySearch');
 assert.deepEqual(Array.from(finder.find(categories,'notebook'),x=>x.name),['Técnico de Informática']);
 assert.deepEqual(Array.from(finder.find(categories,'faxina'),x=>x.name),['Limpeza']);
 assert.deepEqual(Array.from(finder.find(categories,'geladeira'),x=>x.name),['Técnico em Refrigeração']);
 assert.deepEqual(Array.from(finder.find(categories,'advocacia'),x=>x.name),['Advogado']);
 assert.deepEqual(Array.from(finder.find(categories,'eletricista'),x=>x.name),['Eletricista']);
 assert.ok(finder.rank(categories[0],'Eletricista')>finder.rank(categories[0],'instalação'));
});

test('busca nunca acrescenta categorias que não existem no catálogo',()=>{
 const finder=load('assets/category-search.js','SQFCategorySearch');
 assert.equal(finder.find(categories,'motorista').length,0);
 assert.equal(finder.find(categories,'').length,categories.length);
 assert.deepEqual(Array.from(finder.suggest(categories,'eletrissista'),x=>x.name),['Eletricista']);
 assert.deepEqual(Array.from(finder.suggest(categories,'notebook'),x=>x.name),[]);
 assert.deepEqual(Array.from(finder.suggest(categories,'z'),x=>x.name),[]);
});

test('ordenação de propostas respeita valores em centavos e filtros',()=>{
 const helper=load('assets/quote-comparison.js','SQFQuoteComparison');
 const quotes=[
  {id:'a',provider_id:'p1',description:'Reforma da parede',quote_terms:'Tinta inclusa',status:'quoted',quote_cents:12000,created_at:'2026-11-02T10:00:00Z'},
  {id:'b',provider_id:'p2',description:'Reparo de tomada',quote_terms:'Material separado',status:'accepted',quote_cents:6500,created_at:'2026-11-03T10:00:00Z'},
  {id:'c',provider_id:'p1',description:'Pintura de portão',quote_terms:'Sem material',status:'completed',quote_cents:9000,created_at:'2026-11-04T10:00:00Z'},
  {id:'d',provider_id:'p1',description:'Sem orçamento válido',status:'quoted',quote_cents:-10},
  {id:'e',provider_id:'p1',description:'Sem orçamento válido',status:'quoted',quote_cents:null}
 ];
 const names=new Map([['p1','João Barros'],['p2','Ana Lima']]);
 assert.deepEqual(Array.from(helper.filter(quotes,{order:'lowest'},names),x=>x.id),['b','c','a']);
 assert.deepEqual(Array.from(helper.filter(quotes,{order:'highest'},names),x=>x.id),['a','c','b']);
 assert.deepEqual(Array.from(helper.filter(quotes,{order:'recent'},names),x=>x.id),['c','b','a']);
 assert.deepEqual(Array.from(helper.filter(quotes,{status:'quoted'},names),x=>x.id),['a']);
 assert.deepEqual(Array.from(helper.filter(quotes,{status:'active'},names),x=>x.id),['b']);
 assert.deepEqual(Array.from(helper.filter(quotes,{query:'joao'},names),x=>x.id),['c','a']);
 assert.deepEqual(Array.from(helper.filter(quotes,{query:'tinta'},names),x=>x.id),['a']);
});

test('busca e orçamentos operam somente com dados filtrados pelo banco',()=>{
 const cat=read('assets/categories.js'),catHtml=read('categorias.html');
 const hub=read('assets/marketplace-hub.js'),html=read('painel.html');
 assert.match(cat,/assistedSearch\.find\(allCategories,query\)/);
 assert.match(cat,/assistedSearch\.suggest\(allCategories,query,3\)/);
 assert.match(catHtml,/assets\/category-search\.js/);
 assert.match(catHtml,/id="searchAssistance"/);
 assert.match(hub,/\.eq\('client_id',user\.id\)\.not\('quote_cents','is',null\)/);
 assert.match(hub,/SQFQuoteComparison\.filter\(compareCache/);
 assert.match(hub,/Valor é declarado pelo prestador|valor é declarado pelo prestador/i);
 for(const id of ['sqfCompareSearch','sqfCompareStatus','sqfCompareOrder','sqfCompareRefresh','sqfCompareCount']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/assets\/quote-comparison\.js/);
 assert.doesNotMatch(hub,/Math\.random\(/);
});
