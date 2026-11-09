'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const portrait=require('../assets/portrait.js');
const migration=read('supabase/migrations/20261103_05_antiabuso_retratos.sql');

test('retrato preserva proporção e aceita imagens de diferentes orientações',()=>{
  for(const [w,h] of [[600,800],[900,1200],[1080,1440],[720,1280],[480,640],[1280,720],[900,900]]){
    const rect=portrait.crop(w,h);
    assert.ok(rect.width>0&&rect.height>0 && Math.max(rect.width,rect.height)<=1600);
    assert.ok(rect.sx>=0&&rect.sy>=0);
    assert.ok(rect.sx+rect.sw<=w && rect.sy+rect.sh<=h);
    assert.ok(Math.abs(rect.sw/rect.sh-rect.width/rect.height)<.004);
  }
});
test('retrato admite qualquer dimensão positiva e enquadramento controlado',()=>{
  const rect=portrait.crop(1280,720,{zoom:1.8,panX:80,panY:30});
  assert.ok(rect.sx>0 && rect.sw<1280);
  for(const [w,h] of [[100,100],[310,600],[9000,12000],[1,1]]) assert.doesNotThrow(()=>portrait.crop(w,h));
  for(const [w,h] of [[0,640],[-1,600],[1.2,300]]) assert.throws(()=>portrait.crop(w,h));
  assert.throws(()=>portrait.crop(1024,1024,{zoom:10}));
  assert.throws(()=>portrait.crop(1024,1024,{panY:-1}));
});
test('retrato restringe arquivo e não confunde portfólio com perfil',()=>{
  assert.doesNotThrow(()=>portrait.validateFile({type:'image/jpeg',size:1024}));
  assert.throws(()=>portrait.validateFile({type:'image/svg+xml',size:1024}));
  assert.throws(()=>portrait.validateFile({type:'image/jpeg',size:6*1024*1024}));
  assert.equal(portrait.MAX_OUTPUT,5*1024*1024);
  const panel=read('painel.html');const acc=read('assets/account.js');
  assert.match(panel,/Fotografia do rosto para o perfil/);
  assert.match(panel,/id="portraitZoom"/);
  assert.match(panel,/id="portraitPanX"/);
  assert.match(panel,/id="portraitPanY"/);
  assert.match(panel,/assets\/portrait\.js/);
  assert.match(panel,/portraitDeclaration/);
  assert.match(acc,/SQFPortrait\.process\(file,options\)/);
  assert.match(acc,/preparedPortrait\.blob/);
  assert.match(acc,/imageUpload\(file,'sqf-portfolios'\)/);
});
test('pessoas públicas mostram retrato 3x4 de prestadores na categoria e no perfil',()=>{
  const css=read('assets/site.css');
  assert.match(css,/\.avatar\{width:78px;height:104px/);
  assert.match(css,/\.avatar-large\{width:147px;height:196px/);
  const cat=read('assets/category-detail.js');const provider=read('assets/provider.js');
  assert.match(cat,/\.eq\('city_ibge',city\.id\)/);
  assert.match(cat,/\.eq\('account_type','prestador'\)/);
  assert.match(cat,/\.eq\('is_public',true\)/);
  assert.match(cat,/\.eq\('category_id', String\(category\.id\)\)/);
  assert.match(provider,/\.eq\('account_type','prestador'\)/);
});
test('contestações não escondem automaticamente avaliações e exigem titular do perfil',()=>{
  assert.match(migration,/review_id uuid not null references public\.reviews/);
  assert.match(migration,/unique \(review_id, provider_id\)/);
  assert.match(migration,/r\.provider_id=v_actor and r\.moderation_status='published'/);
  assert.match(migration,/if v_after='upheld' then[\s\S]*?update public\.reviews set moderation_status='hidden'/);
  assert.match(migration,/perform public\.sqf_require_staff\(false\)/);
  assert.doesNotMatch(migration,/trigger\s+[^;]*?automatic_hide/i);
});
test('resposta do prestador é moderada e não identifica cliente em RPC pública',()=>{
  assert.match(migration,/create table if not exists public\.sqf_review_responses/);
  assert.match(migration,/moderation_status text not null default 'pending'/);
  assert.match(migration,/p_review_ids uuid\[\]/);
  assert.match(migration,/r\.moderation_status='published'/);
  const provider=read('assets/provider.js');
  assert.match(provider,/sqf_public_review_responses/);
  assert.match(provider,/Resposta pública do prestador/);
  assert.doesNotMatch(provider,/\.innerHTML\s*=/);
});
test('admin mantém MFA e oferece moderação de contestação e resposta',()=>{
  const html=read('admin.html');const js=read('assets/admin.js');
  assert.match(html,/option value="disputes"/);
  assert.match(html,/option value="responses"/);
  assert.match(js,/sqf_staff_review_cases/);
  assert.match(js,/sqf_staff_review_case_decide/);
  assert.match(migration,/sqf_review_case_audit/);
  assert.match(migration,/grant execute on function public\.sqf_staff_review_case_decide/);
});
test('proteção antifraude mantém avaliação negativa legítima e limita rajadas de spam',()=>{
  assert.match(migration,/r\.created_at >= now\(\)-interval '24 hours'/);
  assert.match(migration,/>= 3/);
  assert.match(migration,/não remove críticas automaticamente/i);
  assert.match(read('painel.html'),/Notas baixas, quando fundamentadas/);
});

test('aprovação exige fotografia atual revisada manualmente por administrador com MFA',()=>{
  assert.match(migration,/create table if not exists public\.sqf_portrait_checks/);
  assert.match(migration,/create trigger sqf_verify_portrait_before_approval/);
  assert.match(migration,/c\.avatar_path=v_path and c\.accepted is true/);
  assert.match(migration,/sqf_staff_check_portrait\(uuid,boolean,text\)/);
  assert.match(read('assets/admin.js'),/sqf_staff_check_portrait/);
  assert.match(read('assets/admin.js'),/Conferir fotografia frontal/);
});

test('storage de avatar impede substituição do retrato atualmente aprovado',()=>{
  assert.match(migration,/sqf_avatar_locked\(p_path text\)/);
  assert.match(migration,/c\.avatar_path=p_path and c\.accepted/);
  assert.match(migration,/create policy sqf_avatar_immutable_guard on storage\.objects as restrictive for delete/);
  assert.match(migration,/create policy sqf_avatar_webp_guard on storage\.objects as restrictive for insert/);
  assert.match(migration,/revoke all on public\.service_engagements/);
  assert.match(migration,/sqf_my_engagement\(p_provider uuid\)/);
});
