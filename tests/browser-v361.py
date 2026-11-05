"""Testes visuais e funcionais em Chromium sem rede, com dados simulados.
Não substituem autenticação, MFA, RLS e moderação no Supabase real.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil, re, json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts'/'previews'/'previews-v3_6_1'; OUT.mkdir(parents=True,exist_ok=True)
CSS=(ROOT/'assets/site.css').read_text()

def page_markup(name):
    html=(ROOT/(name+'.html')).read_text()
    html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.I|re.S)
    html=re.sub(r'<link\b[^>]*>','',html,flags=re.I)
    return html

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [1440,390]:
        context=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1)
        # Public profile tabs
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(page_markup('prestador'),wait_until='domcontentloaded')
        page.add_style_tag(content=CSS)
        page.evaluate("document.querySelector('#providerContent').hidden=false;document.querySelector('#providerStatus').hidden=true;")
        page.evaluate("() => { window.SQFProfiles={validId:()=>true,message:()=> 'Modo simulado'}; window.getSQFClient=()=>{throw Error('Mock offline');}; }")
        page.add_script_tag(content=(ROOT/'assets/provider.js').read_text())
        assert page.locator('#profileAboutPanel').is_visible()
        page.get_by_role('tab',name='Serviços').click()
        assert page.locator('#profileServicesPanel').is_visible()
        assert not page.locator('#profileAboutPanel').is_visible()
        page.get_by_role('tab',name='Serviços').press('ArrowRight')
        assert page.locator('#profilePortfolioPanel').is_visible()
        page.get_by_role('tab',name='Portfólio').press('End')
        assert page.locator('#profileReviewsPanel').is_visible()
        assert page.locator('[role=tab][aria-selected=true]').count()==1
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        page.screenshot(path=str(OUT/f'perfil-abas-{width}.png'),full_page=False)
        page.close()
        # Portrait, including horizontal source, zoom and pan
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(page_markup('painel'),wait_until='domcontentloaded')
        page.add_style_tag(content=CSS)
        page.evaluate("document.querySelector('#accountDetails').hidden=false; document.querySelector('#providerReadiness').hidden=false; document.querySelector('#portraitCandidateBox').hidden=false;document.querySelector('#accountStatus').hidden=true;")
        page.add_script_tag(content=(ROOT/'assets/portrait.js').read_text())
        result=page.evaluate("""async()=>{
          const c=document.createElement('canvas');c.width=1280;c.height=720;
          const ctx=c.getContext('2d');ctx.fillStyle='#d6e5ef';ctx.fillRect(0,0,c.width,c.height);
          ctx.fillStyle='#ef8b30';ctx.fillRect(200,100,500,500);
          const raw=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
          const file=new File([raw],'retrato.png',{type:'image/png'});
          const output=await window.SQFPortrait.process(file,{zoom:1.5,panX:70,panY:30});
          const b=await createImageBitmap(output);
          document.querySelector('#portraitCandidate').src=URL.createObjectURL(output);
          const result={width:b.width,height:b.height,type:output.type};b.close();return result;
        }""")
        assert result['type']=='image/webp' and result['width']>result['height'],result
        assert page.locator('#portraitControls').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        page.screenshot(path=str(OUT/f'foto-enquadramento-{width}.png'),full_page=False)
        page.close()
        # Admin queue simulated; server permissions still the actual authorization gate.
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(page_markup('admin'),wait_until='domcontentloaded');page.add_style_tag(content=CSS)
        page.evaluate("""() => { window.getSQFClient=()=>({
          auth:{getUser:async()=>({data:{user:{id:'mock-staff'}}}),signOut:async()=>({})},
          rpc:async(name,params)=>{
            if(name==='sqf_staff_whoami')return {data:{role:'admin',mfa_ready:true},error:null};
            if(name==='sqf_staff_overview')return {data:{providers:2,reviews:3,reports:2,privacy:1},error:null};
            if(name==='sqf_staff_queue')return {data:[
              {id:'one',title:'Avaliação fictícia A',subtitle:'teste',summary:'Primeira avaliação',status:'pending',created_at:'2026-11-02T15:00:00Z'},
              {id:'two',title:'Avaliação fictícia B',subtitle:'teste',summary:'Segunda avaliação',status:'published',created_at:'2026-11-02T15:00:00Z'}],error:null};
            return {data:[],error:null};
          }
        }); }""")
        page.add_script_tag(content=(ROOT/'assets/admin.js').read_text())
        page.locator('.admin-item').first.wait_for()
        assert page.locator('.admin-item').count()==2
        page.locator('#adminStateFilter').select_option('pending')
        assert page.locator('.admin-item').count()==1
        page.locator('#adminSearch').fill('B')
        assert page.locator('.admin-item').count()==0
        page.locator('#adminStateFilter').select_option('')
        assert page.locator('.admin-item').count()==1
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        page.screenshot(path=str(OUT/f'admin-filtros-{width}.png'),full_page=False)
        page.close()
        # Cadastro: acompanhamento progressivo do preenchimento, sem enviar dados.
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(page_markup('cadastro'),wait_until='domcontentloaded');page.add_style_tag(content=CSS)
        page.evaluate("""() => { document.querySelector('#signupCity').closest('[data-city-picker]').__cityPicker={getSelected:()=>({id:'2109908',name:'Santa Inês',uf:'MA'})}; }""")
        page.add_script_tag(content=(ROOT/'assets/utils.js').read_text())
        page.add_script_tag(content=(ROOT/'assets/auth.js').read_text())
        page.locator('#firstName').fill('Ana');page.locator('#lastName').fill('Silva')
        page.locator('#email').fill('teste@example.com')
        page.locator('#password').fill('FraseDeTeste123!');page.locator('#confirmPassword').fill('FraseDeTeste123!')
        page.locator('#signupCity').fill('Santa Inês — MA')
        assert page.locator('#signupProgress').evaluate('el=>el.value')==6
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        page.screenshot(path=str(OUT/f'cadastro-progresso-{width}.png'),full_page=False)
        page.close();context.close()
        print(f'PASS {width}px: abas, retrato, filtros administrativos e progresso do cadastro; sem overflow')
    browser.close()
