'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('assets/cities.js','utf8');
const bytes=fs.readFileSync('assets/municipios-br.json');
const cities=JSON.parse(bytes);
function api(fetch,cache){const ctx={fetch,sessionStorage:{getItem:()=>cache||null,setItem(){}}};vm.runInNewContext(source,ctx);return ctx.SQFCities;}
test('snapshot possui integridade, códigos únicos e todas as UFs',()=>{
 const a=api();assert.equal(a.validateList(cities),true);assert.equal(new Set(cities.map(c=>c.uf)).size,27);
 const meta=JSON.parse(fs.readFileSync('assets/municipios-br.meta.json'));assert.equal(meta.count,cities.length);assert.equal(meta.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
 for(const replacement of [{...cities[0],uf:'XX'},{...cities[0],id:'123'},{...cities[0],name:''},cities[1]]){const bad=[...cities];bad[0]=replacement;assert.equal(a.validateList(bad),false);}
});
test('lista local funciona sem IBGE e cache adulterado é descartado',async()=>{
 let calls=0;const a=api(async url=>{calls++;assert.match(url,/municipios-br.json/);return {ok:true,json:async()=>cities};},JSON.stringify(cities.map(c=>({...c,uf:'XX'}))));
 await Promise.all([a.load(),a.load()]);assert.equal(calls,1);assert.equal(a.byId('2109908').name,'Santa Inês');assert.equal(a.search('santa ines').some(c=>c.id==='2109908'),true);
});
test('falha completa permite nova tentativa e não aceita lista incompleta',async()=>{
 let healthy=false;const a=api(async()=>({ok:true,json:async()=>healthy?cities:[]}));
 await assert.rejects(a.load());healthy=true;assert.equal((await a.load()).length,5571);
});
