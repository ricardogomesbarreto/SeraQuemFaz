'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=fn=>fs.readFileSync(path.join(root,fn),'utf8');
function citiesApi(){const ctx={};vm.runInNewContext(read('assets/cities.js'),ctx);return ctx.SQFCities;}
test('municípios usam código IBGE, nome e UF de fonte oficial',()=>{
 const a=citiesApi();
 assert.match(a.ENDPOINT,/servicodados\.ibge\.gov\.br\/api\/v1\/localidades\/municipios/);
 const c=a.toCity({id:2109908,nome:'Santa Inês',microrregiao:{mesorregiao:{UF:{sigla:'MA'}}}});
 assert.equal(c.id,'2109908');assert.equal(a.format(c),'Santa Inês — MA');
 assert.equal(a.toCity({id:'999',nome:'Incompleta',microrregiao:{mesorregiao:{UF:{sigla:'MA'}}}}),null);
});
test('pesquisa exige cidade antes de buscar serviços e preserva a cidade na URL',()=>{
 const index=read('index.html'),cat=read('assets/categories.js');
 assert.match(index,/id="homeCityId"/);assert.match(index,/name="cidade"/);
 assert.match(cat,/if \(!selectedCity\)/);
 assert.match(cat,/url\.searchParams\.set\('cidade', selectedCity\.id\)/);
 assert.match(cat,/categoria\.html\?id=.*cidade=/);
});
test('a consulta de prestadores filtra por city_ibge no banco (não só pela tela)',()=>{
 const js=read('assets/category-detail.js');
 assert.match(js,/\.eq\('city_ibge',city\.id\)/);
 assert.match(js,/Selecione uma cidade no catálogo/);
 assert.match(read('supabase/migrations/20261103_02_cidades_ibge.sql'),/idx_sqf_profiles_public_city/);
});
test('cadastro e painel exigem seleção válida e persistem município IBGE',()=>{
 const auth=read('assets/auth.js'),account=read('assets/account.js');
 assert.match(read('cadastro.html'),/id="signupCityId"/);
 assert.match(read('painel.html'),/id="profileCityId"/);
 assert.match(auth,/city_ibge: selectedCity\.id/);
 assert.match(account,/city_ibge:selectedCity\.id/);
 assert.match(read('supabase/migrations/20261103_02_cidades_ibge.sql'),/grant update \(city_ibge\)/);
});
test('telas de autenticação usam foto local e não incluem cartões decorativos antigos',()=>{
 const login=read('entrar.html'),signup=read('cadastro.html'),css=read('assets/site.css');
 assert.doesNotMatch(login,/auth-graphic|Conexões que facilitam seu dia/);
 assert.doesNotMatch(signup,/auth-graphic|Conectando pessoas e oportunidades/);
 assert.match(css,/profissional-oficina\.webp/);
 assert.ok(fs.statSync(path.join(root,'assets/images/profissional-oficina.webp')).size>40000);
 assert.doesNotMatch(read('index.html'),/art-tag/);
});
test('logo ampliada e campo de localização disponíveis em todas as etapas',()=>{
 const css=read('assets/site.css');
 assert.match(css,/\.professional-logo\{width:min\(355px/);
 assert.match(css,/\.city-picker-control/);
 assert.match(read('categorias.html'),/id="catalogCity"/);
 assert.match(read('categoria.html'),/id="categoryCityContext"/);
});
test('carrega a lista completa, pesquisa nomes acentuados e reutiliza cache sem repetir download',async()=>{
 let calls=0;
 const cities=[{id:2109908,nome:'Santa Inês',microrregiao:{mesorregiao:{UF:{sigla:'MA'}}}}];
 for(let i=0;i<5501;i++)cities.push({id:5000000+i,nome:'Município de teste '+i,microrregiao:{mesorregiao:{UF:{sigla:'SP'}}}});
 const session=new Map();
 const ctx={
  sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},
  fetch:async(url)=>{calls++; return String(url).includes('municipios-br.json') ? {ok:false,status:404} : {ok:true,json:async()=>cities}; }
 };
 vm.runInNewContext(read('assets/cities.js'),ctx);
 const api=ctx.SQFCities;
 const first=await api.load();
 assert.equal(first.length,5502);
 assert.equal(api.byId('2109908').name,'Santa Inês');
 assert.equal(api.search('santa ines')[0].uf,'MA');
 assert.equal(api.search('município de teste',9).length,9);
 await api.load();
 assert.equal(calls,2,'lista já carregada não deve ser obtida novamente');
});
