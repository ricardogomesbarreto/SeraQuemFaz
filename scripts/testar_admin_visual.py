"""Teste local de interface do painel administrativo com RPC mockado.
Não é teste de permissão real do Supabase ou PostgreSQL.
"""
from pathlib import Path
import asyncio
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
(ROOT/'.artifacts'/'previews').mkdir(parents=True,exist_ok=True)
# A navegação file:// e HTTP local é bloqueada pelo navegador deste ambiente.
# Renderizar HTML/CSS/JS inline (somente para teste visual, não para deploy).
import re
import base64
html=(ROOT/'admin.html').read_text()
css=(ROOT/'assets/site.css').read_text()
config=(ROOT/'assets/supabase-config.js').read_text()
site_js=(ROOT/'assets/site.js').read_text()
admin_js=(ROOT/'assets/admin.js').read_text()

MOCK='''
window.supabase = {
  createClient: () => ({
    auth: {
      getUser: async () => ({data:{user: {id:'00000000-0000-0000-0000-000000000001'}},error:null}),
      signOut: async () => ({error:null}),
      mfa: {
        listFactors: async () => ({data:{totp:[{id:'testfactor',status:'verified'}]},error:null}),
        enroll: async () => ({data:{id:'testfactor',totp:{secret:'TEST_SECRET_ONLY'}},error:null}),
        challengeAndVerify: async () => ({data:{},error:null})
      }
    },
    rpc: async (name,params) => {
      const mode=window.__sqfMockMode || 'admin';
      if(name==='sqf_staff_whoami') return {data: mode==='nonstaff'? null : {role: mode==='moderator'?'moderator':'admin',mfa_ready:mode!=='pendingmfa'},error:null};
      if(name==='sqf_staff_overview')return {data:{providers:2,reviews:4,reports:1,privacy:3},error:null};
      if(name==='sqf_staff_queue')return {data:[{id:'c1413b85-59b1-426a-b047-2ca3b0096200',title:'Profissional de exemplo',subtitle:'4 de 5 estrelas',summary:'Relato ilustrativo de atendimento para teste visual.',status:'pending',created_at:'2026-11-03T20:00:00Z'}],error:null};
      return {data:null,error:{message:'Unhandled mock'}};
    }
  })
}
'''

async def test():
  async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'],headless=True)
    try:
      for mode,width in [('nonstaff',1440),('pendingmfa',1440),('admin',1440),('moderator',390)]:
        page=await browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        built = re.sub(r'<script[^>]+src=["\'][^"\']+["\'][^>]*></script>', '', html)
        built = re.sub(r'<link[^>]+href=["\'](?:assets/site\.css|https://fonts\.[^"\']+)["\'][^>]*>', '', built)
        built = built.replace('</head>', '<style>'+css+'</style></head>')
        for asset in ['assets/brand/logo-horizontal.png','assets/brand/logo-horizontal-footer.png']:
          data=base64.b64encode((ROOT/asset).read_bytes()).decode('ascii')
          built=built.replace(asset, 'data:image/png;base64,'+data)
        built = built.replace('</body>', '<script>window.__sqfMockMode='+repr(mode)+';</script><script>'+MOCK+'</script><script>'+config+'</script><script>'+site_js+'</script><script>'+admin_js+'</script></body>')
        await page.set_content(built,wait_until='domcontentloaded')
        await page.wait_for_timeout(500)
        status=await page.locator('#adminStatus').inner_text()
        admin_visible=await page.locator('#adminContent').is_visible()
        mfa_visible=await page.locator('#mfaSection').is_visible()
        print(f'{mode}/{width}: status={status!r}, admin={admin_visible}, mfa={mfa_visible}, pageerrors={errors[:2]}')
        assert not errors, f'JS error for {mode}: {errors}'
        assert not await page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
        if mode=='nonstaff': assert 'Acesso negado' in status and not admin_visible
        elif mode=='pendingmfa': assert mfa_visible and not admin_visible
        else: assert admin_visible and not mfa_visible
        if mode=='admin' and width==1440:
          await page.screenshot(path=str(ROOT/'.artifacts'/'previews'/'admin-1440.png'),full_page=True)
        if mode=='moderator' and width==390:
          await page.screenshot(path=str(ROOT/'.artifacts'/'previews'/'moderador-390.png'),full_page=True)
        await page.close()
    finally: await browser.close()

if __name__=='__main__': asyncio.run(test())
