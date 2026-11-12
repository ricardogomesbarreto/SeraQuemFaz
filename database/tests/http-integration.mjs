import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
const missing=await fetch(base+'?route=provider&id=not-a-uuid');assert.equal(missing.status,400);
const publicProvider=await fetch(base+'?route=provider&id=00000000-0000-4000-8000-000000000002');assert.equal(publicProvider.status,200);assert.ok((await publicProvider.json()).data);
x=await call('session');assert.equal(x.status,200);assert.equal(x.result.user_id,null);assert.ok(csrf);
if(process.env.SQF_SMTP_ENABLED!=='1'){
 const disabled=await call('register',{email:'blocked-no-smtp@example.invalid',password:'fixture-password-12345',name:'Cadastro de teste',account_type:'cliente',city_ibge:'2111300'});
 assert.equal(disabled.status,503,'signup without email transport must be rejected');
 assert.match(disabled.result.error,/e-mail/i);
}

assert.equal((await fetch(base+'?route=unsupported-method',{method:'GET'})).status,404,'unknown read route rejected');
const unsupportedFormat=await fetch(base+'?route=profile',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'text/plain'},body:'{}'});
assert.equal(unsupportedFormat.status,415,'non-JSON mutation rejected');
const invalidJson=await fetch(base+'?route=profile',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:'{'});
assert.equal(invalidJson.status,400,'malformed JSON rejected');
assert.equal((await call('request/messages',{request_id:'test'})).status,401);
assert.equal((await call('login',{email:'auth-fixture@example.invalid',password:'new-fixture-password-5678'},'wrong')).status,403);
x=await call('login',{email:'auth-fixture@example.invalid',password:'new-fixture-password-5678'});assert.equal(x.status,200);assert.ok(x.result.user_id);
assert.equal((await call('session')).result.user_id,x.result.user_id);
const me=x.result.user_id;
assert.equal((await call('profile',{})).result.data.id,me);
assert.equal((await call('staff/reviews',{})).status,400);
assert.equal((await call('staff/mfa',{code:'123456'})).status,400);
assert.equal((await call('review/create',{request_id:'00000000-0000-4000-8000-000000000011',rating:5,comment:'Tentativa de avaliação indevida'})).status,400);
assert.deepEqual((await call('reviews',{})).result.data,[]);
assert.equal((await call('media/list',{kind:'verification'})).status,400);
assert.equal((await call('media/list',{kind:'attachment',request_id:'00000000-0000-4000-8000-000000000011'})).status,400);
const denied=await fetch(base+'?route=media/read&kind=verification&id=00000000-0000-4000-8000-000000000099',{headers:{Cookie:cookie}});
assert.equal(denied.status,400);
const form=new FormData();form.append('kind','verification');form.append('context','identity_evidence');
form.append('file',new Blob(['fake-image'],{type:'image/webp'}),'invalid.webp');
const mediaUpload=await fetch(base+'?route=media/upload',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf},body:form});
assert.equal(mediaUpload.status,400);
assert.equal((await call('profile/update',{full_name:'Perfil de teste',bio:'Bio de teste',city_ibge:'2111300'})).status,200);
assert.equal((await call('profile',{})).result.data.full_name,'Perfil de teste');
assert.equal((await call('profile/update',{full_name:'Perfil de teste',bio:'',city_ibge:'0000000'})).status,400);
for(const route of ['requests','appointments','notifications'])assert.deepEqual((await call(route,{})).result.data,[]);
assert.equal((await call('request/messages',{request_id:'00000000-0000-4000-8000-000000000011'})).status,400);
const png=await readFile(process.env.SQF_PRIVATE_MEDIA_ROOT+'/test-upload.png');
const avatarForm=new FormData();avatarForm.append('kind','avatar');avatarForm.append('context','self');avatarForm.append('file',new Blob([png],{type:'image/png'}),'avatar.png');
const uploaded=await fetch(base+'?route=media/upload',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':csrf},body:avatarForm});
assert.equal(uploaded.status,201);
const myAvatar=await fetch(base+'?route=media/read&kind=avatar&id='+me,{headers:{Cookie:cookie}});
assert.equal(myAvatar.status,200);assert.equal(myAvatar.headers.get('content-type'),'image/webp');
assert.equal((await fetch(base+'?route=media/read&kind=avatar&id='+me)).status,400);
assert.equal((await call('logout',{})).status,200);
assert.equal((await call('session')).result.user_id,null);
console.log('PASS: HTTP session, CSRF, login, third-party rejection, logout');
