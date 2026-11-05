"""Reprodução histórica adaptada: foto de formato flexível, sem backend ou terceiros.

Uso: python tests/browser-portrait-v360.py
"""
from pathlib import Path
(Path(__file__).resolve().parents[1]/'.artifacts'/'previews').mkdir(parents=True,exist_ok=True)
from playwright.sync_api import sync_playwright
import shutil, re
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in (1440,390):
        page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        html=(ROOT/'painel.html').read_text()
        html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.I|re.S)
        html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=(ROOT/'assets/site.css').read_text())
        page.locator('#accountDetails').evaluate("el=>el.hidden=false")
        page.locator('#providerEditor').evaluate("el=>el.hidden=false")
        page.locator('#accountStatus').evaluate("el=>el.hidden=true")
        page.add_script_tag(content=(ROOT/'assets/portrait.js').read_text())
        result=page.evaluate("""async()=>{
          const wide=document.createElement('canvas');wide.width=800;wide.height=1200;
          const ctx=wide.getContext('2d');ctx.fillStyle='#dfe8ee';ctx.fillRect(0,0,800,1200);
          ctx.fillStyle='#1b4d73';ctx.beginPath();ctx.arc(400,400,200,0,7);ctx.fill();
          const blob=await new Promise(resolve=>wide.toBlob(resolve,'image/png'));
          const uploaded=new File([blob],'foto.png',{type:'image/png'});
          const processed=await window.SQFPortrait.process(uploaded);
          const bitmap=await createImageBitmap(processed);
          const url=URL.createObjectURL(processed);
          document.querySelector('#portraitCandidate').src=url;
          document.querySelector('#portraitCandidateBox').hidden=false;
          document.querySelector('#portraitDeclarationLabel').hidden=false;
          const result={width:bitmap.width,height:bitmap.height,mime:processed.type,size:processed.size};
          bitmap.close();return result;
        }""")
        assert result['width']==800 and result['height']==1200 and result['mime']=='image/webp',result
        horizontal=page.evaluate("""()=>{try{const result=window.SQFPortrait.crop(1200,700);return result.width>result.height}catch(e){return false}}""")
        assert horizontal, 'imagem horizontal precisa ser aceita'
        assert page.locator('#portraitCandidate').is_visible()
        overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
        assert overflow<=3,('overflow',width,overflow)
        assert not errors,errors
        page.screenshot(path=str(ROOT/'.artifacts'/'previews'/f'PREVIA-retrato-flexivel-{width}.png'),full_page=False)
        print(f'Chromium {width}px PASS: PNG retrato → WebP {result["width"]}×{result["height"]}, {result["size"]} bytes; paisagem permitida; overflow={overflow}')
        page.close()
    browser.close()
