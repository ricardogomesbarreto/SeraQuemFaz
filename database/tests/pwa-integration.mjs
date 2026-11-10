import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:8080';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 // Intercept only external requests; local navigation must use the real network/offline stack.
 await context.route(url=>url.origin!==origin,r=>r.abort());
 const page=await context.newPage();
 await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('PWA registration timeout')),15000))]));
 const paths=await page.evaluate(async()=>{const c=await caches.open('sqf-public-v3.14.0-rc.11');return (await c.keys()).map(r=>new URL(r.url).pathname).sort();});
 assert.deepEqual(paths,['/assets/brand/icone-192.png','/assets/brand/icone-512.png','/assets/brand/logo-horizontal.png','/offline.html']);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await context.setOffline(true);
 await page.goto(origin+'/painel.html');await page.getByRole('heading',{name:'Você está sem conexão'}).waitFor();
 console.log('PASS: installed PWA caches only static brand and generic offline page; private panel not cached');
}finally{await browser.close();}
