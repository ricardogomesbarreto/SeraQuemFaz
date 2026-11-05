#!/usr/bin/env python3
"""Teste funcional local da seção de precificação; não acessa Supabase remoto."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
import os

ROOT = Path(__file__).resolve().parent.parent
SCREEN = ROOT/'.artifacts'/'previews'/'previews-v3_7_2'
SCREEN.mkdir(parents=True,exist_ok=True)

html = (ROOT/'index.html').read_text(encoding='utf-8')
css = (ROOT/'assets/site.css').read_text(encoding='utf-8')
js = (ROOT/'assets/pricing.js').read_text(encoding='utf-8')
# O navegador do ambiente bloqueia navegação HTTP local. Renderizar o HTML
# com CSS/JS inline, mantendo os controles e o DOM originais do projeto.
html = re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>', '', html)
html = re.sub(r'<link[^>]*href="https://fonts[^>]+>', '', html)
html = html.replace('<link href="assets/site.css" rel="stylesheet"/>', '')
html = re.sub(r'<link[^>]*rel="icon"[^>]*>', '', html)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width in [1440,390]:
            page = browser.new_page(viewport={'width':width,'height':900}, device_scale_factor=1)
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.set_content(html, wait_until='domcontentloaded')
            page.add_style_tag(content=css)
            # A prévia da seção dispensa a sobreposição visual do header sticky;
            # no site o header permanece intacto.
            page.add_style_tag(content='.site-header{position:static!important}')
            page.add_script_tag(content=js)
            section=page.locator('#planos')
            section.scroll_into_view_if_needed()
            assert section.is_visible()
            assert page.locator('[data-pricing-amount]').inner_text()=='R$ 14,90'
            assert page.locator('[data-pricing-equivalent]').is_hidden()
            assert page.locator('a[href="cadastro.html?tipo=prestador"]').count() >= 1
            assert page.locator('.pricing-disclaimer').is_visible()
            assert page.locator('.pricing-cards .pricing-card').count()==2
            section.screenshot(path=str(SCREEN / f'planos-mensal-{width}.png'))
            page.get_by_role('button', name='Anual').click()
            assert page.locator('[data-pricing-amount]').inner_text()=='R$ 149,00'
            assert page.locator('[data-pricing-unit]').inner_text()=='/ ano'
            assert page.locator('[data-pricing-equivalent]').is_visible()
            assert page.get_by_role('button', name='Anual').get_attribute('aria-pressed')=='true'
            assert page.get_by_role('button', name='Mensal').get_attribute('aria-pressed')=='false'
            section.screenshot(path=str(SCREEN / f'planos-anual-{width}.png'))
            page.get_by_role('button', name='Mensal').click()
            assert page.locator('[data-pricing-amount]').inner_text()=='R$ 14,90'
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            assert not errors, errors
            print(f'PASSO: {width}px, mensal/anual, sem rolagem horizontal, sem erros JS')
            page.close()
        browser.close()
finally:
    pass
