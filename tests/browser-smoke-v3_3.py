"""Testes opcionais no Chromium, sem requisições HTTP (ambiente local bloqueia localhost).

Os 13 itens e os municípios são fixtures; não representam dados do Supabase.
Uso: python tests/browser-smoke-v3_3.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from base64 import b64encode
import json, mimetypes, re, shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts'/'previews'/'previews-v3_3';OUT.mkdir(parents=True,exist_ok=True)
CITIES=[dict(id=2101202,nome='Bacabal',microrregiao={'mesorregiao':{'UF':{'sigla':'MA'}}}),dict(id=2109908,nome='Santa Inês',microrregiao={'mesorregiao':{'UF':{'sigla':'MA'}}})]
CITIES += [dict(id=3000000+i,nome=f'Município Teste {i}',microrregiao={'mesorregiao':{'UF':{'sigla':'SP'}}}) for i in range(5501)]
CATEGORIES=[dict(id=i,name=n,description=d,image_url=None,status='active',created_at=f'2026-10-{(i%28)+1:02d}T10:00:00Z') for i,(n,d) in enumerate([
 ('Ar-Condicionado','Instalação, manutenção e higienização'),('Eletricista','Reparos e instalações elétricas'),
 ('Mecânico','Manutenção de veículos leves'),('Informática','Suporte a computadores e redes'),
 ('Pedreiro','Construção, alvenaria e reformas'),('Pintura residencial','Acabamento e pintura'),
 ('Jardinagem','Cuidado de jardins e paisagismo'),('Beleza','Cabeleireiro e estética'),
 ('Limpeza','Faxina e higienização'),('Educação','Aulas e reforço'),
 ('Design','Comunicação e identidade visual'),('Refrigeração','Manutenção especializada'),
 ('Hidráulica','Instalação de tubulações e reparos')],start=1)]

css=(ROOT/'assets/site.css').read_text()
for name in ['profissional-oficina.webp','profissional-cadastro.webp']:
  file=ROOT/'assets/images'/name
  css=css.replace(f"url('images/{name}')",f"url('data:image/webp;base64,{b64encode(file.read_bytes()).decode()}')")

def markup(name):
    html=(ROOT/f'{name}.html').read_text()
    html=re.sub(r'<script\b[^>]*>\s*</script>','',html,flags=re.I|re.S)
    html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
    def image(m):
        file=ROOT/m.group(1)
        if not file.is_file():return m.group(0)
        mime=mimetypes.guess_type(file.name)[0] or 'image/png'
        return f'src="data:{mime};base64,{b64encode(file.read_bytes()).decode()}"'
    return re.sub(r'src="((?:assets|img)/[^"]+\.(?:png|webp))"',image,html)

with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for width in (1440,390):
    context=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1)
    page=context.new_page()
    errors=[];page.on('pageerror',lambda exc: errors.append(str(exc)))
    page.set_content(markup('categorias'),wait_until='domcontentloaded')
    page.add_style_tag(content=css)
    # Browser-restored hidden id/text, emulating a selection that occurs before the catalog handler loads.
    page.locator('#catalogCityId').evaluate("el=>el.value='2101202'")
    page.locator('#catalogCity').evaluate("el=>el.value='Bacabal — MA'")
    data=json.dumps(CITIES,ensure_ascii=False)
    categories=json.dumps(CATEGORIES,ensure_ascii=False)
    page.evaluate(f"""() => {{
      window.history.replaceState = () => {{}};
      const cities = {data};
      window.fetch = async url => String(url).includes('municipios-br.json') ? {{ok:false,status:404}} : {{ok:true,json: async () => cities}};
      const entries = {categories};
      window.getSQFClient = () => ({{from:() => ({{select(){{return this}},eq(){{return this}},order(){{return Promise.resolve({{data:entries,error:null}})}}}})}});
    }}""")
    for script in ['utils.js','cities.js','categories.js']:
      page.add_script_tag(content=(ROOT/'assets'/script).read_text())
    page.locator('.category-card').first.wait_for(timeout=12000)
    assert 'Bacabal' in page.locator('#resultsDescription').inner_text(),page.locator('#resultsDescription').inner_text()
    assert page.locator('#catalogCount').inner_text()=='13'
    assert page.locator('.category-card').count()==12
    page.screenshot(path=str(OUT/f'categorias-funcional-{width}.png'),full_page=(width==1440))
    page.locator('#loadMore').click();assert page.locator('.category-card').count()==13
    if width==390:page.locator('#filterToggle').click()
    page.locator('#viewList').click();assert page.locator('#categorias').evaluate("el=>el.classList.contains('is-list-view')")
    page.locator('#viewGrid').click();assert not page.locator('#categorias').evaluate("el=>el.classList.contains('is-list-view')")
    page.locator('#categoryQuery').fill('eletricista');assert page.locator('.category-card').count()==1
    assert 'Eletricista' in page.locator('.category-card').first.inner_text()
    assert 'cidade=2101202' in page.locator('.category-open-link').first.get_attribute('href')
    page.locator('#resetFilters').click();assert page.locator('.category-card').count()==12
    if width==390:page.locator('#filterToggle').click()
    page.locator('#withDescription').check();page.locator('#sortSelect').select_option('za')
    assert page.locator('.category-card').count()==12
    overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    assert overflow<=3,('overflow',width,overflow)
    assert not errors,errors
    print(f'PASS Chromium {width}px: cidade pré-selecionada, 13 categorias, paginação, filtros, grade/lista, 0 erros JS, overflow={overflow}')
    page.close();context.close()
  browser.close()
print('Nota: testes funcionais com dados simulados, sem autenticação real ou rede.')
