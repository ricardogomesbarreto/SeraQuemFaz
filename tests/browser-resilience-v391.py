#!/usr/bin/env python3
"""Teste funcional isolado: leitura, troca rápida de conversa e formulário de orçamento.
Não substitui testes com políticas RLS reais no Supabase.
"""
from pathlib import Path
(Path(__file__).resolve().parents[1]/'.artifacts'/'previews').mkdir(parents=True,exist_ok=True)
from playwright.sync_api import sync_playwright
import re

root=Path(__file__).resolve().parents[1]
css=(root/'assets/site.css').read_text()
html=(root/'painel.html').read_text()
profile=(root/'prestador.html').read_text()
portal=re.search(r'<section class="dashboard-card sqf-requests-card"[\s\S]*?</section>',html).group(0).replace(' hidden aria-labelledby=', ' aria-labelledby=')
quote=re.search(r'<section class="sticky-panel sqf-quote-panel"[\s\S]*?</section>',profile).group(0).replace(' hidden>','>')
mock=r"""
window.SQFSupabase={url:'https://test.supabase.co'};
const uid='11111111-1111-4111-8111-111111111111';
const r1='22222222-2222-4222-8222-222222222222', r2='44444444-4444-4444-8444-444444444444';
const provider='33333333-3333-4333-8333-333333333333';
const requests=[
 {id:r1,client_id:uid,provider_id:provider,status:'quoted',description:'Preciso de instalação elétrica na cozinha e na sala.',quote_cents:15000,quote_terms:'Serviço com material fornecido pelo cliente.',created_at:'2026-11-04T11:00:00Z'},
 {id:r2,client_id:uid,provider_id:provider,status:'requested',description:'Solicito instalação de iluminação no meu apartamento.',created_at:'2026-11-04T12:00:00Z'}
];
window.__sqfMock={unread:{[r1]:2,[r2]:0},calls:[],delay:false};
const state=window.__sqfMock;
function response(table){
 const query={_id:null,select(){return this},eq(key,val){if(key==='request_id')this._id=val;return this},order(){return this},
   limit(){
     if(table==='sqf_service_requests')return Promise.resolve({data:requests,error:null});
     if(table==='sqf_request_messages'){
       const id=this._id;
       return new Promise(resolve=>setTimeout(()=>resolve({data:[{id:'88888888-8888-4888-8888-888888888888',sender_id:provider,created_at:'2026-11-04T12:30:00Z',body:id===r1?'Mensagem privada do primeiro pedido.':'Mensagem privada do segundo pedido.'}],error:null}),state.delay && id===r1?300:10));
     }
     return Promise.resolve({data:[],error:null});
   },
   maybeSingle:async()=>({data:{account_type:'cliente'},error:null}),
   insert:async data=>({data,error:null})};
 return query;
}
window.getSQFClient=()=>({
 auth:{getUser:async()=>({data:{user:{id:uid}}})},
 from:response,
 rpc:async(name,payload)=>{
   state.calls.push({name,payload});
   if(name==='sqf_request_unread_counts')return {data:Object.entries(state.unread).map(([request_id,unread_count])=>({request_id,unread_count})),error:null};
   if(name==='sqf_mark_request_read'){state.unread[payload.p_request]=0;return {data:null,error:null};}
   if(name==='sqf_create_request')return {data:r2,error:null};
   return {data:'accepted',error:null};
 },
 storage:{from:()=>({createSignedUrl:async()=>({data:null,error:null})})}
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
        page.wait_for_function("document.querySelectorAll('.sqf-request-list-item').length===2")
        assert page.locator('.sqf-request-stat').count()==4, 'resumo não exibido'
        assert page.locator('.sqf-unread-badge').count()==1, 'indicador inicial ausente'
        page.locator('.sqf-request-list-item').first.click()
        page.wait_for_function("document.querySelector('.sqf-messages-thread')?.textContent.includes('Mensagem privada do primeiro')")
        page.wait_for_function("document.querySelectorAll('.sqf-unread-badge').length===0")
        assert page.locator('.sqf-request-stat').count()==4
        # Race: uma consulta antiga não deve modificar a solicitação aberta depois.
        page.evaluate('window.__sqfMock.delay=true')
        page.locator('.sqf-request-list-item').first.click()
        page.locator('.sqf-request-list-item').nth(1).click()
        page.wait_for_timeout(430)
        assert 'Mensagem privada do segundo pedido.' in page.locator('.sqf-messages-thread').inner_text()
        assert 'Mensagem privada do primeiro pedido.' not in page.locator('.sqf-messages-thread').inner_text()
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth')<=width+1, 'rolagem horizontal'
        snap=root/'.artifacts'/'previews'/f'PREVIA-v3.9.1-pedidos-{label}.png'
        page.screenshot(path=str(snap),full_page=True)
        print(f'{label} — resumo, leitura, troca rápida de conversa e responsividade OK')
        page.close()

        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(f'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="legal-page"><main class="container" style="max-width:720px"><h1>Perfil público</h1>{quote}</main></body></html>')
        page.add_style_tag(content=css)
        page.add_script_tag(content=mock)
        page.add_script_tag(content=(root/'assets/request-profile.js').read_text())
        page.evaluate("""async()=>window.SQFRequestProfile.setup(window.getSQFClient(),{id:'11111111-1111-4111-8111-111111111111'},'33333333-3333-4333-8333-333333333333',[{id:'99999999-9999-4999-8999-999999999999',service_title:'Instalação elétrica'}])""")
        page.locator('#sqfQuoteService').select_option('99999999-9999-4999-8999-999999999999')
        page.locator('#sqfQuoteDescription').fill('Instalação de pontos de luz na cozinha e na sala.')
        page.locator('#sqfQuotePhotos').set_input_files(files=[{'name':'arquivo-invalido.gif','mimeType':'image/gif','buffer':b'GIF89a\x01\x00\x01\x00'}])
        page.locator('#sqfQuoteSubmit').click()
        assert 'Nenhum pedido foi enviado' in page.locator('#sqfQuoteStatus').inner_text()
        assert page.evaluate("window.__sqfMock.calls.filter(x=>x.name==='sqf_create_request').length")==0
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth')<=width+1
        print(f'{label} — validação de mídia antes de criar a solicitação OK')
        page.close()
    browser.close()
