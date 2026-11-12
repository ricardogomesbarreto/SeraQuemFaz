'use strict';
// Only a generic offline page and immutable public brand images; never API or user data.
const CACHE='sqf-public-v3.14.0-rc.15';
const ASSETS=['./offline.html','./assets/brand/icone-192.png','./assets/brand/icone-512.png','./assets/brand/logo-horizontal.png'];
const scope=new URL(self.registration.scope);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sqf-public-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname)||u.pathname.includes('/api/')||u.search||r.headers.has('authorization'))return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.open(CACHE).then(c=>c.match(new URL('offline.html',scope).href))));return;}
 if(ASSETS.slice(1).some(p=>new URL(p,scope).href===u.href))e.respondWith(caches.open(CACHE).then(c=>c.match(r)).then(hit=>hit||fetch(r)));
});
