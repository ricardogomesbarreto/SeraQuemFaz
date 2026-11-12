import assert from 'node:assert/strict';
const base='http://127.0.0.1:8080/api/index.php?route=categories';
const durations=[];
for(let batch=0;batch<5;batch++){
 await Promise.all(Array.from({length:8},async()=>{const start=performance.now();const response=await fetch(base,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.length,51);durations.push(performance.now()-start);}));
}
durations.sort((a,b)=>a-b);
console.log('PASS: 40 public catalogue requests, 8 concurrent, p95 '+Math.round(durations[Math.ceil(durations.length*.95)-1])+'ms (local CI, not hosting benchmark)');
