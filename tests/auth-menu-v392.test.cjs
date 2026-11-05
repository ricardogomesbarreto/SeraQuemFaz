const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pages=['index.html','categorias.html','categoria.html','prestador.html','painel.html','admin.html','entrar.html','cadastro.html','privacidade.html','termos.html'];

test('cabeçalhos compartilham status de autenticação; não dependem do account.js',()=>{
  for (const name of pages){
    const html=read(name);
    assert.match(html,/assets\/supabase-config\.js/);
    assert.match(html,/assets\/auth-navigation\.js/);
    assert.match(html, /class="nav-actions" data-auth-loading="true"/);
    assert.ok(html.indexOf('assets/auth-navigation.js')>html.indexOf('assets/supabase-config.js'));
  }
});

test('menu autenticado inclui avatar, nome, atalhos e encerramento de sessão',()=>{
  const script=read('assets/auth-navigation.js');
  for (const value of ['Minha conta e perfil','Solicitações e mensagens','Sair da conta'])assert.ok(script.includes(value));
  assert.match(script, /client\.auth\.getSession/);
  assert.match(script, /client\.auth\.getUser/);
  assert.match(script, /\.auth\.signOut\(/);
  assert.match(script, /client\.auth\.onAuthStateChange/);
  assert.match(script, /user\.user_metadata\?\.full_name/);
});

test('perfil canônico ausente permite editor seguro de compatibilidade e logout',()=>{
  const script=read('assets/account.js'),html=read('painel.html');
  for(const id of ['accountFallback','fallbackNameForm','fallbackLogout','fallbackRetry','accountFallbackName','accountFallbackEmail']) assert.ok(html.includes(`id="${id}"`));
  assert.match(script, /if\(pe\|\|!myProfile\)\{/);
  assert.match(script, /await showMissingProfile/);
  assert.match(script, /SQFAccountFallback\?\.init/);
  assert.match(read('assets/account-compat.js'), /auth\.updateUser/);
  assert.match(html, /id="fallbackAvatarFile"/);
  assert.match(script, /auth\.signOut\(\)/);
});

test('foto do cliente usa bucket privado com URL assinada, prestadores continuam em bucket próprio',()=>{
  const script=read('assets/account.js'),menu=read('assets/auth-navigation.js');
  const migration=read('supabase/migrations/20261104_11_foto_privada_cliente.sql');
  assert.match(script,/sqf-client-avatars/); assert.match(script,/createSignedUrl/);
  assert.match(menu,/createSignedUrl/); assert.match(menu,/sqf-avatars/);
  assert.match(migration,/sqf-client-avatars/); assert.match(migration,/sqf-client-avatars',false/);
  assert.match(migration,/as restrictive for select/);
  assert.match(migration,/as restrictive for insert/);
  assert.match(migration,/as restrictive for delete/);
  assert.match(migration,/as restrictive for update/);
});

test('navegação oculta botões de login/cadastro enquanto consulta a sessão',()=>{
  const css=read('assets/site.css');
  assert.match(css,/\.nav-actions\[data-auth-loading="true"\]\{visibility:hidden\}/);
  assert.match(css,/\.sqf-account-menu/);
  assert.match(css,/\.sqf-account-recovery\[hidden\]/);
});
