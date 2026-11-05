#!/usr/bin/env python3
"""Smoke funcional isolado do Supabase real. Rodar com Chromium local, dados de teste."""
from pathlib import Path
(Path(__file__).resolve().parents[1]/'.artifacts'/'previews').mkdir(parents=True,exist_ok=True)
from playwright.sync_api import sync_playwright
from html import escape
import re
root=Path(__file__).resolve().parents[1]
css=(root/'assets/site.css').read_text()
html=(root/'painel.html').read_text()
profile=(root/'prestador.html').read_text()
fragment=re.search(r'<section class="dashboard-card sqf-requests-card"[\s\S]*?</section>',html)
quote=re.search(r'<section class="sticky-panel sqf-quote-panel"[\s\S]*?</section>',profile)
assert fragment and quote
portal=fragment.group(0).replace(' hidden aria-labelledby=',' aria-labelledby=')
quote_block=quote.group(0).replace(' hidden>','>')
assert 'sqfRequestPortal' in portal and 'sqfQuotePanel' in quote_block
mock="""
window.SQFSupabase={url:'https://test.supabase.co'};
const userId='11111111-1111-4111-8111-111111111111';
window.getSQFClient=()=>({
  auth:{getUser:async()=>({data:{user:{id:userId}}})},
  from:(table)=>({
    select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:table==='sqf_service_requests'? [{
      id:'22222222-2222-4222-8222-222222222222',client_id:userId,
      provider_id:'33333333-3333-4333-8333-333333333333',service_id:'44444444-4444-4444-8444-444444444444',
      city_ibge:'2109908',description:'Preciso de instalação elétrica residencial, na sala e na cozinha.',
      created_at:'2026-11-04T12:00:00Z',status:'quoted',quote_cents:14900,
      quote_terms:'Instalação com materiais providenciados pelo cliente.',
    }]:table==='sqf_request_messages'?[{id:'66666666-6666-4666-8666-666666666666',sender_id:userId,body:'Olá, gostaria de receber o orçamento.',created_at:'2026-11-04T12:10:00Z'}]:[] ,error:null})},
    maybeSingle:async()=>({data:{account_type:'cliente'},error:null}),
    insert:async()=>({error:null})
  }),
  rpc:async()=>({data:'accepted',error:null}),
  storage:{from:()=>({createSignedUrl:async()=>({data:null,error:{message:'n/a'}})})}
});
"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height,label in [(1440,970,'desktop'),(390,844,'mobile')]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(f'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="legal-page"><main class="container dashboard-main"><h1>Minha Conta</h1>{portal}</main></body></html>')
  page.add_style_tag(content=css)
  page.add_script_tag(content=mock)
  page.add_script_tag(content=(root/'assets/request-media.js').read_text())
  page.add_script_tag(content=(root/'assets/request-portal.js').read_text())
  page.wait_for_function("document.querySelectorAll('.sqf-request-list-item').length===1")
  assert page.locator('#sqfRequestPortal').is_visible()
  page.locator('.sqf-request-list-item').click()
  assert page.get_by_text('R$ 149,00').count() >= 1 or '149,00' in page.locator('.sqf-quote-summary').inner_text()
  page.wait_for_function("document.querySelector('.sqf-message')!==null")
  assert page.locator('.sqf-message').count() == 1
  assert not errors,errors
  w=page.evaluate('document.documentElement.scrollWidth')
  assert w<=width+1,(label,w,width)
  path=root/'.artifacts'/'previews'/f'PREVIA-v3.9.0-solicitacoes-{label}.png'
  page.screenshot(path=str(path),full_page=True)
  print(label,'solicitações',w,width,'OK')
  page.close()
  page=browser.new_page(viewport={'width':width,'height':height})
  page.set_content(f'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="legal-page"><main class="container" style="max-width:640px"><h1>Prestador de serviços</h1>{quote_block}</main></body></html>')
  page.add_style_tag(content=css)
  page.add_script_tag(content=mock)
  page.add_script_tag(content=(root/'assets/request-media.js').read_text())
  page.add_script_tag(content=(root/'assets/request-profile.js').read_text())
  page.evaluate("""async()=>await window.SQFRequestProfile.setup(window.getSQFClient(),{id:'11111111-1111-4111-8111-111111111111'},'33333333-3333-4333-8333-333333333333',[{id:'44444444-4444-4444-8444-444444444444',service_title:'Instalação elétrica'}])""")
  assert page.locator('#sqfQuotePanel').is_visible()
  assert page.locator('#sqfQuoteService option').count()==2
  w=page.evaluate('document.documentElement.scrollWidth')
  assert w<=width+1,(label,w,width)
  print(label,'formulário de orçamento',w,width,'OK')
  page.close()
 browser.close()
