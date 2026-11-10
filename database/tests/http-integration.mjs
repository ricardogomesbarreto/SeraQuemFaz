import assert from 'node:assert/strict';
const base='http://127.0.0.1:8080/index.php';
let cookie='',csrf='';
async function call(route,body,token=csrf){
 const url=new URL(base);url.searchParams.set('route',route);
 const headers={};if(cookie)headers.Cookie=cookie;
 if(body!==undefined){headers['Content-Type']='application/json';headers['X-CSRF-Token']=token;}
 const response=await fetch(url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
 const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
 const result=await response.json();if(result.csrf)csrf=result.csrf;
 return {status:response.status,result};
}
let x=await call('categories');assert.equal(x.status,200);assert.ok(Array.isArray(x.result.data));assert.equal(x.result.data.length,51);
x=await call('session');assert.equal(x.status,200);assert.equal(x.result.user_id,null);assert.ok(csrf);
assert.equal((await call('request/messages',{request_id:'test'})).status,401);
assert.equal((await call('login',{email:'auth-fixture@example.invalid',password:'new-fixture-password-5678'},'wrong')).status,403);
x=await call('login',{email:'auth-fixture@example.invalid',password:'new-fixture-password-5678'});assert.equal(x.status,200);assert.ok(x.result.user_id);
assert.equal((await call('session')).result.user_id,x.result.user_id);
const me=x.result.user_id;
assert.equal((await call('profile',{})).result.data.id,me);
assert.equal((await call('profile/update',{full_name:'Perfil de teste',bio:'Bio de teste',city_ibge:'2111300'})).status,200);
assert.equal((await call('profile',{})).result.data.full_name,'Perfil de teste');
assert.equal((await call('profile/update',{full_name:'Perfil de teste',bio:'',city_ibge:'0000000'})).status,400);
for(const route of ['requests','appointments','notifications'])assert.deepEqual((await call(route,{})).result.data,[]);
assert.equal((await call('request/messages',{request_id:'00000000-0000-4000-8000-000000000011'})).status,400);
assert.equal((await call('logout',{})).status,200);
assert.equal((await call('session')).result.user_id,null);
console.log('PASS: HTTP session, CSRF, login, third-party rejection, logout');
