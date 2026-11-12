const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const root=join(__dirname,'..');
const scope={};
runInNewContext(readFileSync(join(root,'assets/auth-feedback.js'),'utf8'),{window:scope});
test('cadastro exibe mensagem específica se SMTP não está disponível',()=>{
  const failure=Object.assign(new Error('Cadastro temporariamente indisponível: envio de e-mail não configurado.'),{status:503});
  assert.equal(scope.SQFAuthFeedback.classify(failure),'email-unavailable');
  assert.match(scope.SQFAuthFeedback.message(failure,'signup'),/SMTP/);
});
test('falha de confirmação mantém orientação de segurança',()=>{
  const failure=Object.assign(new Error('Não foi possível enviar o e-mail de confirmação.'),{status:503});
  assert.match(scope.SQFAuthFeedback.message(failure,'signup'),/confirmação de e-mail continua obrigatória/);
});
test('cadastro oferece caminho para reenvio sem remover verificação',()=>{
  const html=readFileSync(join(root,'entrar.html'),'utf8');
  const js=readFileSync(join(root,'assets/auth.js'),'utf8');
  assert.match(html,/id="resendEmailCode"/);
  assert.match(js,/SQFMySQL[.]resendVerification\(email\)/);
});
