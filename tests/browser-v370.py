"""Smoke tests de UI v3.7.0 com dados sintéticos, sem chamar Supabase.
Não substituem testes de RLS ou transações no banco remoto.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, shutil, base64
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts'/'previews'/'previews-v3_7_0';OUT.mkdir(parents=True,exist_ok=True)
CSS=(ROOT/'assets/site.css').read_text()
HTML=(ROOT/'painel.html').read_text()
HTML=re.sub(r'<script\b[^>]*>.*?</script>','',HTML,flags=re.I|re.S)
HTML=re.sub(r'<link\b[^>]*>','',HTML,flags=re.I)
BRAND_MAP={key:'data:image/png;base64,'+base64.b64encode((ROOT/key).read_bytes()).decode() for key in ['assets/brand/logo-horizontal.png','assets/brand/logo-horizontal-footer.png','assets/brand/simbolo.png','assets/brand/logo-vertical.png']}
def show_logos(page):
    page.evaluate("""assets=>{for(const img of document.querySelectorAll('img[src]')){const src=img.getAttribute('src');if(assets[src])img.src=assets[src];}}""",BRAND_MAP)
MOCK="""() => {
  const clientId='22222222-2222-4222-8222-222222222222';
  const proId='11111111-1111-4111-8111-111111111111';
  const user={id:clientId,email:'cliente@example.test'};
  const tables={
    profiles:[{id:clientId,full_name:'Cliente de teste',account_type:'cliente',city:'Santa Inês — MA',city_ibge:null,bio:'',avatar_path:null,is_public:false},{id:proId,full_name:'Marina Alves',account_type:'prestador',city:'Santa Inês — MA',city_ibge:'2109908',is_public:true,avatar_path:null,bio:'Exemplo'}],
    service_engagements:[{id:'e1',provider_id:proId,status:'requested',requested_at:'2026-10-30T12:00:00Z',confirmed_at:null},{id:'e2',provider_id:proId,status:'confirmed',requested_at:'2026-10-28T12:00:00Z',confirmed_at:'2026-10-29T12:00:00Z'}],
    reviews:[{id:'r1',provider_id:proId,engagement_id:'e2',rating:4,comment:'Atendimento cordial e serviço realizado com cuidado.',created_at:'2026-10-31T12:00:00Z',moderation_status:'pending'}],
    sqf_client_favorites:[{client_id:clientId,provider_id:proId,created_at:'2026-11-01T12:00:00Z'}],
    privacy_requests:[{id:'pr1',request_type:'access',status:'pending',created_at:'2026-10-30T12:00:00Z'}]
  };
  class Query{
    constructor(table){this.table=table;this.filters=[];this.cap=500;this.sorter=null;}
    select(){return this;}
    eq(k,v){this.filters.push(row=>String(row[k])===String(v));return this;}
    in(k,values){this.filters.push(row=>values.map(String).includes(String(row[k])));return this;}
    order(k,opts={}){this.sorter=[k,opts];return this;}
    limit(n){this.cap=n;return this;}
    maybeSingle(){return Promise.resolve({data:this.run().data[0]||null,error:null});}
    run(){let rows=(tables[this.table]||[]).filter(row=>this.filters.every(f=>f(row)));
      if(this.sorter){const [key,options]=this.sorter;rows.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||''))*(options.ascending===false?-1:1));}
      return {data:rows.slice(0,this.cap),error:null};
    }
    then(resolve,reject){try{resolve(this.run());}catch(error){reject?.(error);}}
  }
  window.getSQFClient=()=>({
    auth:{getUser:async()=>({data:{user},error:null}),signOut:async()=>({error:null})},
    from:table=>new Query(table),
    rpc:async name=>({data:null,error:null})
  });
}"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [1440,390]:
        context=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(HTML,wait_until='domcontentloaded')
        page.add_style_tag(content=CSS)
        page.evaluate(MOCK)
        for name in ['profile-ui.js','client-dashboard.js','account.js']:
            page.add_script_tag(content=(ROOT/'assets'/name).read_text())
        page.locator('#clientStatConfirmed').get_by_text('1').wait_for(timeout=12000)
        assert page.locator('#clientDashboard').is_visible()
        assert not page.locator('#providerOverview').is_visible()
        assert not page.locator('#providerEditor').is_visible()
        assert page.locator('#clientReviews').get_by_text('Atendimento cordial',exact=False).count()==1
        assert page.locator('#clientFavorites').get_by_text('Marina Alves').count()==1
        assert page.locator('#clientUpdates').is_visible()
        assert page.locator('#clientStatRequested').inner_text()=='1'
        assert page.locator('#clientStatFavorites').inner_text()=='1'
        assert page.locator('#profileSettings').is_visible()
        assert not page.locator('#avatarEditor').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        show_logos(page)
        page.screenshot(path=str(OUT/f'minha-conta-{width}.png'),full_page=True)
        print('PASS cliente',width)
        page.close()
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(HTML,wait_until='domcontentloaded');page.add_style_tag(content=CSS)
        page.evaluate("""() => {
           document.querySelector('#accountDetails').hidden=false;
           document.querySelector('#providerOverview').hidden=false;
           document.querySelector('#providerReadiness').hidden=false;
           document.querySelector('#providerEditor').hidden=false;
           document.querySelector('#dashboardHeading').textContent='Meu Painel Profissional';
           for(const [id,value] of [['providerStatServices','2'],['providerStatPhotos','3'],['providerStatPending','1'],['providerStatReviews','4']])document.getElementById(id).textContent=value;
        }""")
        assert page.locator('#providerOverview').is_visible()
        assert page.locator('#providerEditor').is_visible()
        assert not page.locator('#clientDashboard').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        show_logos(page)
        page.screenshot(path=str(OUT/f'painel-profissional-{width}.png'),full_page=False)
        print('PASS provider presentation',width)
        page.close();context.close()
    browser.close()
