#!/usr/bin/env python3
"""Verificação isolada de navegação autenticada e tratamento de schema ausente.
Não substitui integração real com Supabase.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
css=(root/'assets/site.css').read_text()
nav_js=(root/'assets/auth-navigation.js').read_text()
account_js=(root/'assets/account.js').read_text()
panel=(root/'painel.html').read_text()

stub='''
const uid='11111111-1111-4111-8111-111111111111';
const authUser={id:uid,email:'cliente@example.com',user_metadata:{full_name:'Ana Maria Pereira',account_type:'cliente'}};
window.SQFSupabase={url:'https://example.supabase.co'};
window.__state={signOut:0,authenticated:true,profileMissing:true,role:'cliente'};
window.__client={
 auth:{
  getSession:async()=>({data:{session:window.__state.authenticated?{user:authUser}:null},error:null}),
  getUser:async()=>({data:{user:window.__state.authenticated?authUser:null},error:null}),
  onAuthStateChange:(cb)=>({data:{subscription:{unsubscribe(){}}}}),
  signOut:async()=>{window.__state.signOut++;window.__state.authenticated=false;return {error:null}},
  updateUser:async({data})=>{authUser.user_metadata.full_name=data.full_name;return {data:{user:authUser},error:null}},
 },
 from:(table)=>({
  select(){return this},eq(){return this},
  maybeSingle:async()=>({data:null,error:{code:'PGRST205',message:"Could not find the table 'public.profiles' in the schema cache"}}),
 }),
 storage:{from:()=>({getPublicUrl(){return {data:{publicUrl:null}}},createSignedUrl:async()=>({data:null,error:{message:'missing bucket'}})})},
};
window.getSQFClient=()=>window.__client;
'''

def empty_page():
 return '''<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body>
 <header class="site-header"><div class="container header-inner"><a class="brand" href="index.html">SERÁ QUEM FAZ?</a><button class="menu-toggle" aria-expanded="false" aria-controls="site-menu" aria-label="Abrir menu"></button>
 <nav class="site-nav" id="site-menu"><a href="index.html">Início</a><div class="nav-actions" data-auth-loading="true"><a data-nav="login" href="entrar.html">Entrar</a><a data-nav="signup" href="cadastro.html">Criar conta</a></div></nav></div></header></body></html>'''

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in (1440,390):
  page=browser.new_page(viewport={'width':width,'height':850})
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(empty_page())
  page.add_style_tag(content=css)
  page.add_script_tag(content=stub)
  page.add_script_tag(content=nav_js)
  page.locator('.sqf-account-trigger').wait_for(state='attached')
  assert 'Ana Maria Pereira' in page.locator('.sqf-account-name').inner_text()
  assert page.locator('a[data-nav="login"]').count()==0
  assert page.locator('a[data-nav="signup"]').count()==0
  if width==390:
   page.add_script_tag(content=(root/'assets/site.js').read_text())
   page.locator('.menu-toggle').click()
  page.locator('.sqf-account-trigger').click()
  assert page.locator('.sqf-account-dropdown a[href="painel.html#profileSettings"]').is_visible()
  assert page.locator('.sqf-account-signout').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth')<=width+2
  assert not errors,errors
  print(f'{width}: menu da conta autenticada, nome e links — OK')
  page.close()

 # Simular perfil persistido com foto de um prestador e acesso à foto privada de cliente.
 for role in ('prestador','cliente'):
  page=browser.new_page(viewport={'width':1440,'height':900})
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(empty_page())
  page.add_style_tag(content=css)
  page.add_script_tag(content=stub)
  page.add_script_tag(content=f"""
   authUser.user_metadata.full_name = '{'Carlos Martins' if role == 'prestador' else 'Ana Maria Pereira'}';
   window.__client.from=()=>({{ select(){{return this}},eq(){{return this}},maybeSingle:async()=>({{data:{{full_name:authUser.user_metadata.full_name,account_type:'{role}',avatar_path:uid+'/22222222-2222-4222-8222-222222222222.webp'}},error:null}}) }});
   window.__client.storage.from=()=>({{
      getPublicUrl:()=>({{data:{{publicUrl:'https://example.supabase.co/storage/v1/object/public/sqf-avatars/'+uid+'/22222222-2222-4222-8222-222222222222.webp'}}}}),
      createSignedUrl:async()=>({{data:{{signedUrl:'https://example.supabase.co/storage/v1/object/sign/sqf-client-avatars/'+uid+'/22222222-2222-4222-8222-222222222222.webp?token=test'}},error:null}})
   }});
  """)
  page.route('https://example.supabase.co/**',lambda route:route.fulfill(status=200,content_type='image/png',body=bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')))
  page.add_script_tag(content=nav_js)
  page.locator('.sqf-account-trigger').wait_for(state='attached')
  page.locator('.sqf-nav-avatar img').wait_for(state='attached')
  assert page.locator('.sqf-account-name').inner_text() == ('Carlos Martins' if role=='prestador' else 'Ana Maria Pereira')
  assert not errors,errors
  print(f'{role}: menu com foto de conta validada — OK')
  page.close()

 # Simular o erro real PGRST205 no painel e verificar recuperação.
 import base64,re
 previews=root/'.artifacts'/'previews'/'previews-v3_9_2'
 previews.mkdir(parents=True,exist_ok=True)
 raw=re.sub(r'<script\b[^>]*>[\s\S]*?</script>','',panel,flags=re.I)
 raw=re.sub(r'<link\b[^>]*>','',raw,flags=re.I)
 for original in ('assets/brand/logo-horizontal.png','assets/brand/logo-horizontal-footer.png'):
  logo=root/original
  b64=base64.b64encode(logo.read_bytes()).decode('ascii')
  raw=raw.replace(f'src="{original}"',f'src="data:image/png;base64,{b64}"')
 for width in (1440,390):
  page=browser.new_page(viewport={'width':width,'height':844})
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(raw,wait_until="domcontentloaded",timeout=10000)
  page.add_style_tag(content=css)
  page.add_script_tag(content=stub)
  page.add_script_tag(content="window.SQFProfiles={message:()=> 'Falha de perfil'}")
  page.add_script_tag(content=nav_js)
  page.add_script_tag(content=account_js)
  page.locator('#accountFallback:visible').wait_for()
  assert 'Ana Maria Pereira' in page.locator('#accountFallbackName').inner_text()
  assert 'cliente@example.com' in page.locator('#accountFallbackEmail').inner_text()
  assert 'tabela de perfis' in page.locator('#accountStatus').inner_text()
  assert page.locator('#fallbackLogout').is_visible()
  assert page.locator('#fallbackNameForm').is_visible()
  if width==390:
   page.add_script_tag(content=(root/'assets/site.js').read_text())
   page.locator('.menu-toggle').click()
  page.locator('.sqf-account-trigger').click()
  screenshot=previews/f'conta-autenticada-perfil-pendente-{width}.png'
  if not screenshot.exists(): page.screenshot(path=str(screenshot),full_page=True,timeout=15000)
  page.locator('#fallbackName').fill('Ana Maria Silva')
  page.locator('#fallbackNameSave').click()
  page.wait_for_function("document.querySelector('#accountFallbackName').textContent==='Ana Maria Silva'")
  assert page.evaluate('document.documentElement.scrollWidth')<=width+2
  assert not errors,errors
  print(f'{width}: schema ausente, dados básicos, edição do nome e botão sair — OK')
  page.close()
 browser.close()
