'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/auth-redirect.js'),'utf8');
const auth=fs.readFileSync(path.join(root,'assets/auth.js'),'utf8');
function withLocation(url,publicSiteUrl=''){
  const context={window:{location:new URL(url),SQFSupabase:{publicSiteUrl}},URL};
  vm.createContext(context);vm.runInContext(js,context);
  return context.window.SQFAuthRedirect;
}
test('não constrói redirecionamentos enviados a celulares para localhost nem file://',()=>{
  for(const url of ['http://localhost:8080/entrar.html','http://127.0.0.1:3000/entrar.html','file:///home/app/entrar.html']){
    const fn=withLocation(url);
    assert.equal(fn.publicRedirect('entrar.html'),null);
    assert.equal(fn.publicRedirect('entrar.html?recuperar=1'),null);
  }
});
test('aceita somente origem HTTPS pública e caminho autorizado',()=>{
  const fn=withLocation('http://localhost:8080/cadastro.html','https://seraque mfaz.example'.replace(' ',''));
  assert.equal(fn.publicRedirect('entrar.html'),'https://seraquemfaz.example/entrar.html');
  assert.equal(fn.publicRedirect('entrar.html?recuperar=1'),'https://seraquemfaz.example/entrar.html?recuperar=1');
  assert.equal(fn.publicRedirect('https://evil.test'),null);
  assert.equal(fn.safeOrigin('http://example.org'),null);
  assert.equal(fn.safeOrigin('https://localhost:3000'),null);
  assert.equal(fn.safeOrigin('https://x.test/?token=abc'),null);
});
test('em domínio HTTPS hospedado, usa a própria origem quando não há URL configurada',()=>{
  const fn=withLocation('https://app.seraque mfaz.test/cadastro.html'.replace(' ',''));
  assert.equal(fn.publicRedirect('entrar.html'),'https://app.seraquemfaz.test/entrar.html');
});
test('cadastro e recuperação nunca injetam uma URL local em emailRedirectTo/redirectTo',()=>{
  assert.match(auth,/verificationRedirect\('entrar\.html'\)/);
  assert.match(auth,/\.\.\.\(redirect \? \{emailRedirectTo:redirect\} : \{\}\)/);
  assert.match(auth,/verificationRedirect\('entrar\.html\?recuperar=1'\)/);
  assert.match(auth,/auth\.verifyOtp\(\{email,token,type:'email'\}\)/);
});
test('telas incluem confirmação por código e orientação de localhost',()=>{
  const entrar=fs.readFileSync(path.join(root,'entrar.html'),'utf8');
  const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
  assert.match(entrar,/id="emailCodeForm"/);
  assert.match(entrar,/id="emailCode"/);
  assert.match(entrar,/localhost/);
  assert.match(cadastro,/entrar\.html#confirmar-email/);
});

test('preserva apenas UUIDs de solicitações no retorno ao painel', () => {
  const context = { URLSearchParams };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/utils.js'), 'utf8'), context);
  const parse = context.SQFUtils.requestIdFromSearch;
  assert.equal(parse('?solicitacao=ABCD1234-1234-1234-1234-ABCDEF123456&next=https://example.com'), 'abcd1234-1234-1234-1234-abcdef123456');
  assert.equal(parse('?solicitacao=https%3A%2F%2Fexample.com'), null);
  assert.equal(parse('?next=//example.com'), null);
});
