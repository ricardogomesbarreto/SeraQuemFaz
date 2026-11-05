const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx={window:{SQFSupabase:{url:'https://abc.supabase.co'}},location:{href:'https://example.org/painel.html'},URL};
vm.createContext(ctx);vm.runInContext(read('assets/account-compat.js'),ctx);
const compat=ctx.window.SQFAccountCompat;
const user={id:'00000000-0000-4000-8000-000000000001',email:'pessoa@exemplo.org',user_metadata:{full_name:'Nome Auth',account_type:'cliente'}};
const query=({data=null,error=null}={})=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data,error})});
test('perfil legado em user_profiles é reconhecido sem exigir public.profiles',async()=>{
 const db={from(name){return name==='user_profiles'?query({data:{name:'Profissional Legado',city:'Santa Inês',state:'MA',account_type:'prestador'}}):query({error:{code:'PGRST205',message:'not found'}})}};
 const record=await compat.read(db,user);
 assert.equal(record.source,'user_profiles');assert.equal(record.display_name,'Profissional Legado');
 assert.equal(record.account_type,'prestador');assert.equal(record.city,'Santa Inês');assert.equal(record.settingsReady,false);
});
test('tabela adicional isolada permite leitura segura do próprio perfil',async()=>{
 const db={from(name){return name==='user_profiles'?query():query({data:{display_name:'Nome Seguro',city:'Bacabal',state:'MA',avatar_path:`${user.id}/123e4567-e89b-42d3-a456-426614174000.webp`}})}};
 const record=await compat.read(db,user);
 assert.equal(record.display_name,'Nome Seguro');assert.equal(record.settingsReady,true);
 assert.ok(compat.validPath(user,record.avatar_path));
 assert.equal(compat.validPath(user,'00000000-0000-4000-8000-000000000002/123e4567-e89b-42d3-a456-426614174000.webp'),false);
});
test('salvamento usa upsert por user_id e sincroniza o nome de Auth somente após sucesso',async()=>{
 let payload,conflict,authCalled=false;
 const db={from(name){assert.equal(name,'sqf_account_settings');return {upsert:async(values,options)=>{payload=values;conflict=options.onConflict;return {error:null};}}},auth:{updateUser:async()=>{authCalled=true;return {error:null};}}};
 const result=await compat.save(db,user,{display_name:'Nome Atualizado',city:'Bacabal',state:'MA'});
 assert.equal(payload.user_id,user.id);assert.equal(payload.city,'Bacabal');assert.equal(conflict,'user_id');assert.equal(authCalled,true);assert.equal(result.metadataError,null);
});
test('falha de escrita não altera os metadados nem simula sucesso',async()=>{
 let called=false;
 const db={from(){return {upsert:async()=>({error:{message:'sem permissão'}})}},auth:{updateUser:async()=>{called=true;return {error:null};}}};
 await assert.rejects(()=>compat.save(db,user,{display_name:'Nome Novo'}));assert.equal(called,false);
});
test('foto privada exige caminho do próprio usuário e URL assinada do projeto',async()=>{
 const path=user.id+'/123e4567-e89b-42d3-a456-426614174000.webp';
 const db={storage:{from(bucket){assert.equal(bucket,'sqf-account-photos');return {createSignedUrl:async()=>({data:{signedUrl:'https://abc.supabase.co/storage/v1/object/sign/...'},error:null})};}}};
 assert.match(await compat.signedPhoto(db,user,path),/^https:\/\/abc\.supabase\.co/);
 assert.equal(await compat.signedPhoto(db,user,'javascript:alert(1)'),null);
});
test('páginas têm a dependência de compatibilidade antes da navegação autenticada',()=>{
 for(const file of ['index.html','categorias.html','categoria.html','prestador.html','painel.html','admin.html','entrar.html','cadastro.html','privacidade.html','termos.html']){
   const html=read(file);assert.ok(html.indexOf('assets/account-compat.js')>=0);
   assert.ok(html.indexOf('assets/account-compat.js')<html.indexOf('assets/auth-navigation.js'));
 }
 assert.match(read('painel.html'),/id="fallbackAvatarFile"/);
 assert.match(read('painel.html'),/id="accountProfile"/);
 assert.match(read('assets/auth-navigation.js'),/Minha conta e perfil/);
 assert.doesNotMatch(read('assets/auth-navigation.js'),/makeLink\('Editar meu perfil'/);
 assert.match(read('assets/request-portal.js'),/Não foi possível verificar o tipo da sua conta/);
});
test('migração complementar não mexe em tabelas legadas e protege dados e fotos por RLS',()=>{
 const sql=read('supabase/migrations/20261104_12_conta_compatibilidade_legada.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.sqf_account_settings/);
 assert.match(sql,/REFERENCES auth\.users\(id\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/FORCE ROW LEVEL SECURITY/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/sqf-account-photos/);
 assert.match(sql,/AS RESTRICTIVE/);
 assert.doesNotMatch(sql,/DROP TABLE/);
 assert.doesNotMatch(sql,/TRUNCATE/);
 assert.doesNotMatch(sql,/DELETE FROM public\.users/);
});
