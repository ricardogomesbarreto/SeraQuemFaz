const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHmac } = require('node:crypto');
const root=path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const core = () => import('../supabase/functions/_shared/billing-core.mjs');

test('preços mensal e anual são regras imutáveis no servidor', async () => {
  const {getPlan}=await core();
  assert.equal(getPlan('monthly').cents,1490);
  assert.equal(getPlan('monthly').frequency,1);
  assert.equal(getPlan('yearly').cents,14900);
  assert.equal(getPlan('yearly').frequency,12);
  for(const value of ['free','pro',null,'YEARLY','annual',14900]) {
    assert.throws(()=>getPlan(value),/Ciclo/);
  }
});

test('vigência depende de pagamento aprovado, valores e moeda corretos', async () => {
  const {invoiceIsApproved,getPlan,isPaidThrough,addMonths}=await core();
  const invoice={currency_id:'BRL',transaction_amount:'14.90',payment:{id:453,status:'approved'}};
  const payment={id:453,status:'approved',currency_id:'BRL',transaction_amount:14.90};
  assert.equal(invoiceIsApproved(invoice,payment,getPlan('monthly')),true);
  assert.equal(invoiceIsApproved(invoice,{...payment,status:'pending'},getPlan('monthly')),false);
  assert.equal(invoiceIsApproved({...invoice,currency_id:'USD'},payment,getPlan('monthly')),false);
  assert.equal(invoiceIsApproved(invoice,{...payment,transaction_amount:0.01},getPlan('monthly')),false);
  assert.equal(invoiceIsApproved(invoice,payment,getPlan('yearly')),false);
  assert.equal(isPaidThrough('2025-01-01T00:00:00Z',new Date('2026-01-01')),false);
  assert.equal(isPaidThrough('2027-01-01T00:00:00Z',new Date('2026-01-01')),true);
  assert.equal(addMonths('2026-01-31T14:00:00Z',1),'2026-02-28T14:00:00.000Z');
  assert.equal(addMonths('2024-02-29T14:00:00Z',12),'2025-02-28T14:00:00.000Z');
});

test('assinatura HMAC válida; replay, adulteração e assinatura malformada são rejeitados', async () => {
  const {verifyWebhook,manifest}=await core();
  const dataId='123456789',requestId='uuid-req-123',secret='segredo-de-testes';
  const ts=Math.floor(Date.now()/1000).toString();
  const signature=createHmac('sha256',secret).update(manifest(dataId,requestId,ts)).digest('hex');
  const base={signatureHeader:`ts=${ts},v1=${signature}`,dataId,requestId,secret};
  assert.equal(await verifyWebhook(base),true);
  assert.equal(await verifyWebhook({...base,dataId:'123456788'}),false);
  assert.equal(await verifyWebhook({...base,requestId:'outro-request'}),false);
  assert.equal(await verifyWebhook({...base,secret:'outro segredo'}),false);
  assert.equal(await verifyWebhook({...base,signatureHeader:'invalid'}),false);
  assert.equal(await verifyWebhook({...base,now:Date.now()+11*60*1000}),false);
});

test('URLs de checkout não permitem redirecionamento arbitrário', async () => {
  const {safeCheckoutUrl}=await core();
  assert.equal(safeCheckoutUrl('https://www.mercadopago.com.br/subscriptions/checkout?id=1'),
    'https://www.mercadopago.com.br/subscriptions/checkout?id=1');
  for(const url of ['http://mercadopago.com.br/pagar','https://mercadopago.com.br.evil.io/pagar',
    'javascript:alert(1)','https://evil.io/checkout','https://mercadopago.com.br@evil.com/']) {
    assert.equal(safeCheckoutUrl(url),null);
  }
});

test('banco permite escrita de faturas só pelo servidor e publicação paga opt-in',()=>{
  const sql=read('supabase/migrations/20261104_08_assinaturas_mercado_pago.sql');
  for(const table of ['sqf_billing_subscriptions','sqf_billing_invoices','sqf_billing_settings']) {
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql,new RegExp(`revoke all on public\\.${table} from public,anon,authenticated`));
  }
  assert.match(sql,/require_paid_subscription boolean not null default false/);
  assert.match(sql,/v\.status = 'approved' and public\.sqf_billing_permits_publication/);
  assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.sqf_billing_/i);
});

test('checkout, cancelamento e webhook ficam em Edge Function com credenciais privadas',()=>{
  const code=read('supabase/functions/sqf-billing/index.ts');
  assert.match(code,/MP_ACCESS_TOKEN/);
  assert.match(code,/MP_WEBHOOK_SECRET/);
  assert.match(code,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(code,/SQF_BILLING_ENABLED/);
  assert.match(code,/verifyWebhook/);
  assert.match(code,/authenticated\(req\)/);
  assert.match(code,/invoiceIsApproved/);
  assert.match(code,/state:'pending'/);
  assert.match(code,/status:'canceled'/);
  assert.match(code,/refreshPeriod/);
  assert.doesNotMatch(read('assets/billing-config.js')+read('assets/billing.js'),/MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});

test('frontend mantém cobrança desativada, portal no painel e seleção mensal/anual',()=>{
  assert.match(read('assets/billing-config.js'),/enabled: false/);
  assert.match(read('painel.html'),/id="billingPanel"/);
  assert.match(read('painel.html'),/id="billingCancel"/);
  assert.match(read('painel.html'),/id="billingRefresh"/);
  assert.match(read('index.html'),/data-billing-plan-link/);
  assert.match(read('assets/account.js'),/SQFBillingUI\.init/);
  assert.match(read('assets/billing.js'),/data\.checkout_url/);
  assert.match(read('assets/billing.js'),/has\('pagamento'\)/);
});
