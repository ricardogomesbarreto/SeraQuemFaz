"""Conferência visual de HTML/CSS por conteúdo inline (sem rede, sem backend)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from base64 import b64encode
import re, mimetypes, shutil
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'.artifacts'/'previews'/'previews-v3_3'; OUTPUT.mkdir(parents=True,exist_ok=True)
css=(ROOT/'assets/site.css').read_text()
photo=ROOT/'assets/images/profissional-oficina.webp'
for img in ['profissional-oficina.webp','profissional-cadastro.webp']:
 f=ROOT/'assets/images'/img
 css=css.replace(f"url('images/{img}')",f"url('data:image/webp;base64,{b64encode(f.read_bytes()).decode()}')")

def inline(html):
 html=re.sub(r'<script\b[^>]*>\s*</script>', '', html,flags=re.I)
 html=re.sub(r'<link\b[^>]*>', '', html,flags=re.I)
 def img_repl(m):
  path=m.group(1)
  file=ROOT/path
  if not file.is_file(): return m.group(0)
  kind=mimetypes.guess_type(path)[0] or 'image/png'
  return f'src="data:{kind};base64,{b64encode(file.read_bytes()).decode()}"'
 html=re.sub(r'src="((?:assets|img)/[^\"]+\.(?:png|webp))"',img_repl,html)
 return html
with sync_playwright() as p:
 b=p.chromium.launch(headless=True, executable_path=shutil.which('chromium'),args=['--no-sandbox'])
 for width in [1440,390]:
  ctx=b.new_context(viewport={'width':width,'height':870},device_scale_factor=1)
  for file in ('index.html','entrar.html','cadastro.html','categorias.html'):
   page=ctx.new_page()
   page.set_content(inline((ROOT/file).read_text()),wait_until='domcontentloaded')
   page.add_style_tag(content=css)
   page.wait_for_timeout(120)
   overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
   if overflow>3: raise AssertionError(f'{file}: horizontal overflow {overflow} @ {width}px')
   page.screenshot(path=str(OUTPUT/f'{file[:-5]}-{width}.png'),full_page=True)
   print(file,width,'overflow',overflow)
   page.close()
  ctx.close()
 b.close()
print('Prévia visual estática gerada; integração e dados reais não são testados por este script.')
