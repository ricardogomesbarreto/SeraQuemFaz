'use strict';
/* Cache só de arquivos públicos; NÃO armazenar sessão, perfis, conversas,
   mensagens, solicitações ou respostas do Supabase no Service Worker. */
const CACHE='sqf-public-v3.13.1';
const STATIC=['./index.html','./categorias.html','./ajuda.html',
 './assets/site.css','./assets/brand/logo-horizontal.png',
 './assets/brand/icone-192.png','./assets/brand/icone-512.png'];
const scopeUrl=new URL(self.registration.scope);
const publicPages=new Set(['index.html','categorias.html','ajuda.html']);
const allowedAsset=/^assets\/(?:site\.css|brand\/(?:logo-horizontal\.png|icone-(?:192|512)\.png))$/;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sqf-public-')&&key!==CACHE)
  .map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||request.headers.has('authorization'))return;
 const url=new URL(request.url);
 if(url.origin!==scopeUrl.origin||!url.pathname.startsWith(scopeUrl.pathname)||url.search)return;
 const relative=url.pathname.slice(scopeUrl.pathname.length);
 if(!publicPages.has(relative)&&!allowedAsset.test(relative))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==='basic'){
   const clone=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,clone));
  }
  return response;
 }).catch(async()=>{
  const hit=await caches.match(request);return hit||Response.error();
 }));
});
