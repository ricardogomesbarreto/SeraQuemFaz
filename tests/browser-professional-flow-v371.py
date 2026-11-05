"""Test real account.js in mocked browser, not a Supabase/RLS integration test."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, shutil
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'painel.html').read_text()
HTML=re.sub(r'<script\b[^>]*>.*?</script>','',HTML,flags=re.I|re.S)
HTML=re.sub(r'<link\b[^>]*>','',HTML,flags=re.I)
CSS=(ROOT/'assets/site.css').read_text()
MOCK=r'''() => {
  const providerId='11111111-1111-4111-8111-111111111111';
  const categoryId='33333333-3333-4333-8333-333333333333';
  const user={id:providerId,email:'prestador@example.test',email_confirmed_at:'2026-10-04T10:00:00Z'};
  const db={
    profiles:[{id:providerId,full_name:'Patricia Técnica',account_type:'prestador',city:'Santa Inês — MA',city_ibge:'2109908',bio:'Técnica de manutenção residencial e instalações para a região.',avatar_path:providerId+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',is_public:true}],
    categories:[{id:categoryId,name:'Manutenção',status:'active'}],
    provider_services:[{id:'44444444-4444-4444-8444-444444444444',provider_id:providerId,category_id:categoryId,service_title:'Instalação elétrica',description:'Revisão e instalação em residências'}],
    portfolio_photos:[],
    sqf_review_disputes:[],
    sqf_review_responses:[],
    provider_verifications:[{provider_id:providerId,status:'pending'}],
    service_engagements:[],
    provider_professional_details:[]
  };
  window.__mockdb=db;
  window.SQFProfiles={
    make:(tag,cls='',value)=>{const el=document.createElement(tag);el.className=cls;if(value!==undefined)el.textContent=String(value);return el;},
    state:(parent,title,details)=>{const el=document.createElement('p');el.textContent=[title,details].filter(Boolean).join(' — ');parent.append(el);},
    avatar:(client,path,name)=>{const el=document.createElement('span');el.className='avatar';el.textContent=name.slice(0,2);return el;},
    ratingLine:()=>document.createElement('span'),
    validId:id=>/^[0-9a-f-]{36}$/i.test(String(id)),
    stars:()=>document.createElement('span'),
    publicUrl:()=>null,
    message:error=>error?.message||'Erro'
  };
  window.SQFCities={format:city=>`${city.name} — ${city.uf}`};
  const picker=document.getElementById('profileCity').closest('[data-city-picker]');
  picker.__cityPicker={setId:async id=>{document.getElementById('profileCity').value='Santa Inês — MA';},getSelected:()=>({id:'2109908',name:'Santa Inês',uf:'MA'}),validate:()=>true};
  class Query{
    constructor(name){this.name=name;this.filters=[];this.changes=null;this.op='select';this.take=1000;}
    select(){return this;}
    eq(k,v){this.filters.push(row=>String(row[k])===String(v));return this;}
    order(){return this;}
    limit(n){this.take=n;return this;}
    maybeSingle(){const rows=this.rows();return Promise.resolve({data:rows[0]||null,error:null});}
    single(){const result=this.perform();return Promise.resolve({data:result.data?.[0]||null,error:result.error||null});}
    insert(payload){this.op='insert';this.changes=payload;return this;}
    update(payload){this.op='update';this.changes=payload;return this;}
    delete(){this.op='delete';return this;}
    rows(){const rows=db[this.name]||[];return rows.filter(row=>this.filters.every(fn=>fn(row))).slice(0,this.take);}
    perform(){
      if(this.op==='select')return {data:this.rows(),error:null};
      if(this.op==='insert'){
        const row={...this.changes};db[this.name].push(row);return {data:[row],error:null};
      }
      if(this.op==='update'){
        for(const row of this.rows())Object.assign(row,this.changes);
        return {data:this.rows(),error:null};
      }
      if(this.op==='delete')return {data:[],error:null};
    }
    then(resolve,reject){try{resolve(this.perform());}catch(err){reject?.(err);}}
  }
  window.getSQFClient=()=>({
    auth:{getUser:async()=>({data:{user},error:null}),signOut:async()=>({error:null})},
    from:name=>new Query(name),
    rpc:async name=>({data:name==='sqf_public_reviews'?[]:null,error:null}),
    storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:'https://example.test/abc.webp'}}),remove:async()=>({error:null})})}
  });
}'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in [1440,390]:
        page=browser.new_page(viewport={'width':width,'height':850})
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(HTML,wait_until='domcontentloaded');page.add_style_tag(content=CSS)
        page.evaluate(MOCK)
        for src in ['professional-details.js','account.js']:
            page.add_script_tag(content=(ROOT/'assets'/src).read_text())
        page.locator('#providerDetailsCard').wait_for(state='visible',timeout=10000)
        assert not page.locator('#clientDashboard').is_visible()
        assert page.locator('#providerOverview').is_visible()
        page.locator('#professionalTitle').fill('Técnica eletricista e manutenção')
        page.locator('#professionalExperience').fill('8')
        page.locator('#professionalSpecialties').fill('Instalação, reparos residenciais')
        page.locator('#professionalServiceMode').select_option('presencial')
        page.locator('#professionalCoverage').fill('Centro e bairros próximos')
        page.locator('[name="workdays"][value="1"]').check()
        page.locator('#saveProfessionalDetails').click()
        page.locator('#professionalDetailsMessage').get_by_text('Informações salvas',exact=False).wait_for(timeout=10000)
        record=page.evaluate('window.__mockdb.provider_professional_details[0]')
        assert record['provider_id']=='11111111-1111-4111-8111-111111111111'
        assert record['experience_years']==8
        assert record['workdays']==[1]
        page.locator('#myServices').get_by_role('button',name='Editar serviço Instalação elétrica').click()
        page.locator('.service-inline-editor input').fill('Instalação e revisão elétrica')
        page.locator('.service-inline-editor button[type=submit]').click()
        page.locator('#serviceMessage').get_by_text('Serviço atualizado',exact=False).wait_for(timeout=10000)
        service=page.evaluate('window.__mockdb.provider_services[0]')
        assert service['service_title']=='Instalação e revisão elétrica'
        assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=3
        assert not errors,errors
        print('PASS provider persisted mocked flow',width)
        page.close()
    browser.close()
