'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const portrait=require('../assets/portrait.js');

test('retratos de 1 pixel a qualquer resolução positiva são aceitos, mantendo limite de 5 MB',()=>{
  for(const [w,h] of [[1,1],[80,120],[310,600],[9000,12000]]){
    const rect=portrait.crop(w,h);
    assert.ok(rect.width>0 && rect.height>0);
    assert.ok(Math.max(rect.width,rect.height)<=1600);
  }
  for(const [w,h] of [[0,100],[-1,20],[3.5,100]])assert.throws(()=>portrait.crop(w,h));
  assert.equal(portrait.MAX_FILE,5*1024*1024);
  assert.equal(portrait.MAX_OUTPUT,5*1024*1024);
  for(const type of ['image/jpeg','image/png','image/webp']){
    assert.doesNotThrow(()=>portrait.validateFile({type,size:5*1024*1024}));
    assert.throws(()=>portrait.validateFile({type,size:5*1024*1024+1}));
  }
  assert.doesNotMatch(read('assets/portrait.js'),/320 pixels|1,5 MB/);
});

test('fotos de solicitações e portfólio não bloqueiam por resolução',()=>{
  const requestMedia=read('assets/request-media.js');
  const account=read('assets/account.js');
  assert.match(requestMedia,/const MAX_INPUT=5\*1024\*1024/);
  assert.match(requestMedia,/const MAX_OUTPUT=5\*1024\*1024/);
  assert.doesNotMatch(requestMedia,/bitmap\.width<64|bitmap\.height<64|8192/);
  assert.doesNotMatch(account,/bitmap\.width<64|bitmap\.height<64|bitmap\.width>8192/);
  assert.match(account,/SQFPortrait\.process\(file,options\)/);
});

test('perfil cliente tem menu lateral e configurações separadas da edição',()=>{
  const html=read('painel.html'), account=read('assets/account.js'), css=read('assets/site.css');
  for(const id of ['clientSideAvatar','clientSideName','clientLogoutSlot','accountSummaryCard','profileSettings','accountSettings','privacyRequestCard','clientPrivacySection']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/<details[^>]+id="accountSettings"/);
  const settings=html.slice(html.indexOf('id="accountSettings"'),html.indexOf('</details>',html.indexOf('id="accountSettings"')));
  assert.match(settings,/id="privacyRequestForm"/);
  assert.match(account,/\$\('privacyRequestCard'\)\.before\(\$\('clientPrivacySection'\)\)/);
  assert.match(account,/mainColumn\.prepend\(\$\('clientDashboard'\)\)/);
  assert.match(account,/\$\('clientLogoutSlot'\)\.append\(\$\('logoutButton'\)\)/);
  assert.match(css,/sqf-client-sidebar/);
  assert.match(css,/@media\(max-width:600px\)/);
});

test('migração mantém os três buckets privados com máximo de 5 MB',()=>{
  const sql=read('supabase/migrations/20261109_13_fotos_privadas_5mb.sql');
  for(const bucket of ['sqf-account-photos','sqf-client-avatars','sqf-request-attachments'])
    assert.ok(sql.includes("'"+bucket+"'"));
  assert.match(sql,/file_size_limit = 5242880/);
  assert.match(sql,/public = false/);
  assert.doesNotMatch(sql,/DROP POLICY|CREATE POLICY|public\s*=\s*true/i);
});

test('tratamento de limite de e-mail não desativa verificação da conta',()=>{
  const feedback=read('assets/auth-feedback.js'),auth=read('assets/auth.js');
  assert.match(feedback,/over_email_send_rate_limit/);
  assert.match(feedback,/SMTP próprio/);
  assert.match(auth,/client\.auth\.signUp/);
  assert.doesNotMatch(auth,/email_confirm\s*:\s*false/);
});
