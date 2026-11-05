"""Visual smoke test with local assets; no Supabase connection or user data."""
import re, base64, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'.artifacts'/'previews'/'previews-v3_7_1'; out.mkdir(parents=True,exist_ok=True)
html=(root/'painel.html').read_text()
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.I|re.S)
html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
css=(root/'assets/site.css').read_text()
assets=['assets/brand/logo-horizontal.png','assets/brand/logo-horizontal-footer.png','assets/brand/logo-vertical.png']
images={name:'data:image/png;base64,'+base64.b64encode((root/name).read_bytes()).decode() for name in assets}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in (1440,390):
        page=browser.new_page(viewport={'width':width,'height':920},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        page.add_style_tag(content='.site-header{display:none!important}')
        page.evaluate('''assets=>{
          document.getElementById('accountDetails').hidden=false;
          for (const id of ['providerOverview','providerReadiness','providerDetailsCard','providerEditor'])document.getElementById(id).hidden=false;
          document.getElementById('dashboardHeading').textContent='Meu Painel Profissional';
          for(const img of document.querySelectorAll('img[src]')) { const url=img.getAttribute('src');if(assets[url])img.src=assets[url]; }
          document.getElementById('readinessDescription').textContent='4 de 5 etapas concluídas · Aguardando análise da equipe';
          document.getElementById('detailsCompletionText').textContent='4 de 6 informações opcionais preenchidas';
          document.getElementById('detailsCompletionProgress').value=4;
        }''',images)
        page.locator('#professionalTitle').fill('Técnica de manutenção residencial')
        page.locator('#professionalExperience').fill('6')
        page.locator('#professionalSpecialties').fill('Instalações, revisão preventiva e reparos')
        page.locator('#professionalServiceMode').select_option('presencial')
        page.locator('#professionalCoverage').fill('Centro e bairros da cidade')
        page.locator('[name="workdays"][value="1"]').check()
        page.locator('[name="workdays"][value="5"]').check()
        page.locator('#professionalPeriod').select_option('manha')
        page.locator('#professionalQuote').select_option('sob_consulta')
        page.locator('#professionalWebsite').fill('https://exemplo.com.br')
        page.add_script_tag(content=(root/'assets/professional-details.js').read_text())
        result=page.evaluate('''() => window.SQFProfessionalDetails.readForm(document.getElementById('professionalDetailsForm'))''')
        assert result['service_mode']=='presencial'
        assert result['workdays']==[1,5]
        assert page.locator('#providerVerificationCard').count()==1
        assert page.locator('#myGallery').count()==1
        assert page.locator('#providerDetailsCard').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        page.locator('#providerDetailsCard').scroll_into_view_if_needed()
        page.locator('#providerDetailsCard').screenshot(path=str(out/f'profissional-{width}.png'))
        print('PASS painel profissional',width,'px')
        page.close()
    browser.close()
