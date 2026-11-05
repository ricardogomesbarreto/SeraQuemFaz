"""Testes UI do modo de recuperação: imagens remotas simuladas, sem afirmar disponibilidade externa."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64,shutil
ROOT=Path(__file__).resolve().parents[1]
PIXEL=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==')
def html(page):
    text=(ROOT/page).read_text()
    text=re.sub(r'<script\b[^>]*>\s*</script>','',text,flags=re.I|re.S)
    text=re.sub(r'<link\b[^>]*>','',text,flags=re.I)
    return text
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in (1440,390):
        context=browser.new_context(viewport={'width':width,'height':900})
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('https://**/*',lambda route: route.fulfill(status=200,content_type='image/png',body=PIXEL))
        page.set_content(html('categorias.html'),wait_until='domcontentloaded')
        page.add_style_tag(content=(ROOT/'assets/site.css').read_text())
        page.evaluate('''() => {
            const city={id:'4300109',name:'Água Santa',uf:'RS'};
            const box=document.querySelector('#catalogCity').closest('[data-city-picker]');
            box.__cityPicker={ready:Promise.resolve(),getSelected:()=>city,validate:()=>true,setId:async()=>{}};
            window.SQFCities={normalize:v=>String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim(),format:c=>`${c.name} — ${c.uf}`};
            window.history.replaceState=()=>{};
            window.getSQFClient=()=>({from:()=>({select(){return this},eq(){return this},order:async()=>({data:[],error:null})})});
        }''')
        for script in ('utils.js','category-original-images.js','catalog-preview.js','categories.js'):
            page.add_script_tag(content=(ROOT/'assets'/script).read_text())
        page.locator('.category-card').first.wait_for()
        assert page.locator('.category-card').count()==12
        assert page.locator('#catalogReferenceNotice').is_visible()
        first=page.locator('.category-cover img').first.get_attribute('src')
        assert first.startswith('https://encrypted-tbn0.gstatic.com/images'),first
        assert page.locator('.category-card').first.locator('h3').inner_text()=='Advogado'
        assert not errors,errors
        print('PASS',width,'snapshot 51/51, cartão com URL original preservada')
        page.close()
        # Teste alternativo sem supabase-js, mas REST pública disponível (dados reais simulados).
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('https://**/*',lambda route: route.fulfill(status=200,content_type='image/png',body=PIXEL))
        page.set_content(html('categorias.html'),wait_until='domcontentloaded')
        page.add_style_tag(content=(ROOT/'assets/site.css').read_text())
        page.evaluate('''() => {
            const city={id:'4300109',name:'Água Santa',uf:'RS'};
            const box=document.querySelector('#catalogCity').closest('[data-city-picker]');
            box.__cityPicker={ready:Promise.resolve(),getSelected:()=>city,validate:()=>true,setId:async()=>{}};
            window.SQFCities={normalize:v=>String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim(),format:c=>`${c.name} — ${c.uf}`};
            window.history.replaceState=()=>{};
            window.SQFSupabase={url:'https://projeto.supabase.co',publishableKey:'sb_publishable_demo'};
            window.getSQFClient=()=>{throw new Error('CDN indisponível')};
            window.fetch=async ()=>({ok:true,json:async()=>[{id:'00000000-0000-4000-8000-000000000001',name:'Advogado',description:'Serviços jurídicos',image_url:'https://static.example.com/advogado.jpg',status:'active'}]});
        }''')
        for script in ('utils.js','category-original-images.js','catalog-preview.js','categories.js'):
            page.add_script_tag(content=(ROOT/'assets'/script).read_text())
        page.locator('.category-card').first.wait_for()
        assert page.locator('.category-card').count()==1
        assert page.locator('#catalogReferenceNotice').is_hidden()
        assert 'categoria.html?id=' in page.locator('.category-open-link').first.get_attribute('href')
        assert page.locator('.category-cover img').first.get_attribute('src')=='https://static.example.com/advogado.jpg'
        assert not errors,errors
        print('PASS',width,'REST pública de contingência sem biblioteca CDN')
        page.close();context.close()
    browser.close()
