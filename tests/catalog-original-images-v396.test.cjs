'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function init(){
 const ctx={window:{},URL,Map};vm.createContext(ctx);
 vm.runInContext(read('assets/category-original-images.js'),ctx);
 vm.runInContext(read('assets/catalog-preview.js'),ctx);
 return ctx.window;
}
test('instantâneo preserva os 51 endereços públicos originais, sem URLs javascript/data',()=>{
 const u=init();
 assert.equal(u.SQFOriginalCategoryImages.count,51);
 assert.equal(u.SQFCatalogPreview.categories.length,51);
 const links=u.SQFCatalogPreview.categories.map(x=>x.image_url);
 assert.equal(new Set(links).size,51);
 links.forEach(uri=>assert.equal(new URL(uri).protocol,'https:'));
});
test('categorias solicitadas têm URLs originais distintas, inclusive áreas de serviço do print',()=>{
 const s=init();
 for(const n of ['Advogado','Ar-Condicionado','Arquitetura','Automação Residencial','Barbeiro','Cabeleireiro','Contador','Costureiro']){
  const url=s.SQFOriginalCategoryImages.get(n);
  assert.ok(url,`URL ausente para ${n}`);
  const record=s.SQFCatalogPreview.categories.find(c=>c.name===n);
  assert.equal(record.image_url,url);
 }
 assert.equal(s.SQFCatalogPreview.get('ref-advogado').name,'Advogado');
});
test('script de recuperação é carregado antes do modo de referência',()=>{
 for(const page of ['categorias.html','categoria.html']){
  const body=read(page);
  assert.ok(body.indexOf('assets/category-original-images.js') < body.indexOf('assets/catalog-preview.js'));
  assert.ok(body.indexOf('assets/category-original-images.js') > 0);
 }
});
test('o catálogo conserva prioridade ao Supabase e tem uma segunda tentativa pública REST',()=>{
 const src=read('assets/categories.js');
 assert.match(src,/const remote=await queryLiveCategories\(\)/);
 assert.match(src,/const client=window.getSQFClient\(\)/);
 assert.match(src,/\/rest\/v1\/categories/);
 assert.match(src,/method:'GET'/);
 assert.match(src,/referenceMode = remote\.length \? null : 'empty'/);
 assert.doesNotMatch(src,/service_role|secret_key|sb_secret_/);
});
test('página de detalhe usa imagem original mesmo em referência editorial sem expor prestadores',()=>{
 const src=read('assets/category-detail.js');
 assert.match(src,/const recovered=window\.SQFUtils\.categoryImage\(referenceCategory\)/);
 assert.match(src,/Não há profissionais cadastrados ou avaliações/);
 assert.match(src,/window\.SQFUtils\.categoryImage\(category\)/);
});
