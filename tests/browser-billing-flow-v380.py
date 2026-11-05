#!/usr/bin/env python3
"""Teste visual e funcional com backend totalmente simulado, sem pagamentos reais."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
page_html=(root/'painel.html').read_text()
markup=re.search(r'<section class="dashboard-card billing-card" id="billingPanel"[\s\S]*?</section>',page_html).group(0).replace(' hidden aria-labelledby=', ' aria-labelledby=')
style=(root/'assets/site.css').read_text()
script=(root/'assets/billing.js').read_text()
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1280,'height':900})
  page.set_content(f'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main class="container dashboard-main">{markup}</main></body></html>')
  page.add_style_tag(content=style)
  page.add_script_tag(content=script)
  page.evaluate("""() => {
    window.SQFBillingConfig = {enabled:true};
    window.SQFSupabase = {url:'https://example.supabase.co',publishableKey:'publishable-test'};
    window.__subscriptions = {enabled:true,subscription:{cycle:'monthly',state:'authorized',paid_until:'2027-02-01T12:00:00Z',cancel_requested_at:null,active:true,last_verified_at:'2026-11-04T12:00:00Z'}};
    window.fetch = async (url,opts) => {
      if(url.endsWith('/cancel')){
        window.__subscriptions.subscription.state = 'canceled';
        window.__subscriptions.subscription.cancel_requested_at = '2026-11-04T12:00:00Z';
        return {ok:true,json:async()=>({state:'canceled',paid_until:'2027-02-01T12:00:00Z'})};
      }
      return {ok:true,json:async()=>window.__subscriptions};
    };
    window.confirm=()=>true;
    window.__client={auth:{getSession:async()=>({data:{session:{access_token:'jwt-de-homologacao'}}})}};
  }""")
  page.evaluate("""async () => await window.SQFBillingUI.init(window.__client,{id:'fake'},{account_type:'prestador'})""")
  assert 'vigente' in page.locator('#billingStatus').inner_text().lower()
  assert '2027' in page.locator('#billingPaidUntil').inner_text()
  assert page.locator('#billingCheckout').is_disabled()
  assert page.locator('#billingCancel').is_visible()
  page.locator('#billingCancel').click()
  page.wait_for_function("document.querySelector('#billingStatus').textContent.includes('Cancelada')")
  assert '2027' in page.locator('#billingPaidUntil').inner_text()
  assert page.locator('#billingCancel').is_hidden()
  assert page.locator('#billingCheckout').is_disabled()
  print('Fluxo de cancelamento simulado: recorrência cancelada, vigência paga preservada, sem nova contratação imediata')
  browser.close()
