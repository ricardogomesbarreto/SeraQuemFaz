import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const id='fixture-http-invoice',request='fixture-http-request',ts=Math.floor(Date.now()/1000);
const signature='ts='+ts+',v1='+createHmac('sha256','fixture-webhook-secret').update('id:'+id+';request-id:'+request+';ts:'+ts+';').digest('hex');
const body={type:'subscription_authorized_payment',data:{id},live_mode:false};
const path='/index.php?route=billing%2Fwebhook&data.id='+id+'&type=subscription_authorized_payment';
const send=(port,event,header=signature,url=path)=>fetch('http://127.0.0.1:'+port+url,{method:'POST',headers:{'Content-Type':'application/json','X-Signature':header,'X-Request-Id':request},body:JSON.stringify(event)});
assert.equal((await send(8080,body)).status,503);
assert.equal((await send(8081,body,'invalid')).status,401);
assert.equal((await send(8081,{...body,data:{id:'different'}})).status,400);
assert.equal((await send(8081,{...body,live_mode:true})).status,403);
assert.equal((await send(8081,body,signature,path+'&data.id=duplicate')).status,400);
// Test credential intentionally absent; no network requests can occur.
assert.equal((await send(8081,body)).status,503);
console.log('PASS: HTTP webhook disabled, invalid HMAC, mismatched ID, live traffic, duplicate query, unavailable credentials');
