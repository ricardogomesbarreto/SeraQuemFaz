import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
// A dedicated loopback proxy simulates actual network loss for the worker,
// not just page-level Chromium offline emulation.
let offline=false;
const proxy=createServer(async(req,res)=>{
 if(offline){req.socket.destroy();return;}
 try{
  const upstream=await fetch('http://127.0.0.1:8080'+req.url,{redirect:'manual'});
  res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/octet-stream','cache-control':'no-store'});
  res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch{res.destroy();}
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+proxy.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 await context.route(url=>url.origin!==origin,r=>r.abort());
 const page=await context.newPage();
 await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('PWA registration timeout')),15000))]));
 const paths=await page.evaluate(async()=>{const c=await caches.open('sqf-public-v3.14.0-rc.15');return (await c.keys()).map(r=>new URL(r.url).pathname).sort();});
 assert.deepEqual(paths,['/assets/brand/icone-192.png','/assets/brand/icone-512.png','/assets/brand/logo-horizontal.png','/offline.html']);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 offline=true;
 await page.goto(origin+'/painel.html',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Você está sem conexão'}).waitFor();
 const cached=await page.evaluate(async()=>{const c=await caches.open('sqf-public-v3.14.0-rc.15');return (await c.keys()).map(r=>new URL(r.url).pathname).sort();});
 assert.deepEqual(cached,paths);
 console.log('PASS: installed PWA caches only static brand and generic offline page; private panel not cached');
}finally{if(browser)await browser.close();proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
