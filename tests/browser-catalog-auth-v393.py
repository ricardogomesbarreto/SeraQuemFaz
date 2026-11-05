"""Testes de interface locais com respostas simuladas: NÃO substituem homologação Supabase."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil, re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts'/'previews'/'previews-v3_9_3';OUT.mkdir(parents=True,exist_ok=True)

def no_external_markup(page):
    html=(ROOT/f'{page}.html').read_text()
    html=re.sub(r'<script\b[^>]*>\s*</script>','',html,flags=re.I|re.S)
    html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
    return html

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for viewport in (1440,390):
      context=browser.new_context(viewport={'width':viewport,'height':900})
      for mode in ('empty','error','real'):
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(no_external_markup('categorias'),wait_until='domcontentloaded')
        page.add_style_tag(content=(ROOT/'assets/site.css').read_text())
        page.evaluate("""(mode) => {
         const city = {id:'4300109', name:'Água Santa',uf:'RS'};
         const box=document.querySelector('#catalogCity').closest('[data-city-picker]');
         box.__cityPicker={ready:Promise.resolve(),getSelected:()=>city,validate:()=>true,setId:async()=>{}};
         window.SQFCities={normalize:v=>String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim(),format:c=>`${c.name} — ${c.uf}`};
         window.history.replaceState=()=>{};
         const remote=[{id:'7',name:'Eletricista',description:'Reparos e instalações',image_url:null,status:'active'}];
         window.getSQFClient=()=>({from:()=>({select(){return this},eq(){return this},order:async()=>({data:mode==='real'?remote:[],error:mode==='error'?{code:'PGRST205',message:'table not found'}:null})})});
        }""", mode)
        for script in ['utils.js','category-original-images.js','catalog-preview.js','categories.js']:
          page.add_script_tag(content=(ROOT/'assets'/script).read_text())
        if mode=='real':
          page.locator('.category-card').first.wait_for(timeout=10000)
          assert page.locator('.category-card').count()==1
          assert page.locator('#catalogReferenceNotice').is_hidden()
          assert 'categoria.html?id=7' in page.locator('.category-open-link').first.get_attribute('href')
        else:
          page.locator('.category-card').first.wait_for(timeout=10000)
          assert page.locator('#catalogReferenceNotice').is_visible(),mode
          assert page.locator('.category-card').count()==12
          assert 'ref-' in page.locator('.category-open-link').first.get_attribute('href')
          assert 'ÁREA DE REFERÊNCIA' in page.locator('.category-card').first.inner_text()
          if viewport==390: page.locator('#filterToggle').click()
          page.locator('#categoryQuery').fill('costureiro')
          assert page.locator('.category-card').count()==1
          assert 'Costureiro' in page.locator('.category-card').first.inner_text()
          if mode=='empty':
            page.locator('#categoryQuery').fill('')
            if viewport==390: page.locator('#filterClose').click()
            page.screenshot(path=str(OUT/f'catalogo-referencia-{viewport}.png'),full_page=False)
        assert not errors,(viewport,mode,errors)
        over=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
        if over>3:
          print('OVERFLOW ELEMENTS',page.evaluate("""[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+5&&r.width>20}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,txt:e.textContent.slice(0,32),right:e.getBoundingClientRect().right.toFixed(0),width:e.getBoundingClientRect().width.toFixed(0)}))"""))
        assert over<=3,(viewport,mode,over)
        print('PASS', viewport, mode, 'catálogo', '0 erros JS')
        page.close()
      context.close()

    # Verifica a mensagem para um cadastro recusado com o limite de e-mail (sem enviar e-mail real).
    context=browser.new_context(viewport={'width':1200,'height':900})
    page=context.new_page()
    page.set_content(no_external_markup('cadastro'),wait_until='domcontentloaded')
    page.evaluate("""() => {
      const box=document.querySelector('#signupCity').closest('[data-city-picker]');
      box.__cityPicker={ready:Promise.resolve(),getSelected:()=>({id:'2109908',name:'Santa Inês',uf:'MA'}),validate:()=>true};
      window.SQFCities={format:c=>`${c.name} — ${c.uf}`};
      const NativeURL=window.URL;
      window.URL=function(value,base){return new NativeURL(value,base==='about:blank' ? 'https://sqf.test/cadastro.html' : base)};
      window.URL.prototype=NativeURL.prototype;
      window.getSQFClient=()=>({auth:{signUp:async()=>({data:null,error:{status:429,code:'over_email_send_rate_limit',message:'email rate limit exceeded'}})}});
    }""")
    for script in ['utils.js','auth-feedback.js','auth.js']:
      page.add_script_tag(content=(ROOT/'assets'/script).read_text())
    page.locator('#firstName').fill('Ana');page.locator('#lastName').fill('Teste');
    page.locator('#email').fill('ana@example.com');page.locator('#password').fill('SenhaForte123!');page.locator('#confirmPassword').fill('SenhaForte123!')
    page.locator('#submitBtn').click()
    page.wait_for_function("document.querySelector('#message').textContent.includes('limite de envios')",timeout=10000)
    assert 'SMTP' in page.locator('#message').inner_text()
    print('PASS cadastro: erro 429 explicado de forma específica')
    page.close();context.close();browser.close()
