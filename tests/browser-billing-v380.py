#!/usr/bin/env python3
"""Verificação estática do módulo de assinatura, sem rede nem credenciais reais."""
from pathlib import Path
(Path(__file__).resolve().parents[1]/'.artifacts'/'previews').mkdir(parents=True,exist_ok=True)
from html import escape
import re
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
whole=(root/'painel.html').read_text()
match=re.search(r'<section class="dashboard-card billing-card" id="billingPanel"[\s\S]*?</section>',whole)
assert match
markup=match.group(0).replace(' hidden aria-labelledby=', ' aria-labelledby=')
style=(root/'assets/site.css').read_text()
script=(root/'assets/billing.js').read_text()
config=(root/'assets/billing-config.js').read_text()
for width,height,label in ((1440,1000,'desktop'),(390,844,'mobile')):
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    page.set_content(f'''<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="legal-page"><main class="container dashboard-main" id="conteudo"><div class="dashboard-intro"><span class="section-kicker">PAINEL PROFISSIONAL</span><h1>Meu Painel Profissional</h1></div>{markup}</main></body></html>''')
    page.add_style_tag(content=style)
    page.add_script_tag(content=config)
    page.add_script_tag(content=script)
    page.evaluate("""async () => await window.SQFBillingUI.init({}, {id:'example'}, {account_type:'prestador'})""")
    assert page.locator('#billingPanel').is_visible()
    assert page.locator('#billingCheckout').is_disabled()
    assert 'homologação' in page.locator('#billingMessage').inner_text().lower()
    page.locator('#billingCycle').select_option('yearly')
    assert '149,00' in page.locator('#billingSelectedPrice').inner_text()
    width_doc=page.evaluate('document.documentElement.scrollWidth')
    assert width_doc<=width+1,(label,width_doc,width)
    page.locator('#billingPanel').screenshot(path=str(root/'.artifacts'/'previews'/f'PREVIA-v3.8.0-assinatura-{label}.png'))
    print(f'{label}: painel visível, checkout bloqueado, seleção anual OK, sem rolagem ({width_doc}/{width})')
    browser.close()
