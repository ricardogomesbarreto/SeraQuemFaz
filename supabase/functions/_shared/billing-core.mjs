/* Regras puras da assinatura SERÁ QUEM FAZ?. Sem credenciais, DOM ou dependências. */
export const PLANS = Object.freeze({
  monthly: Object.freeze({ cycle: 'monthly', cents: 1490, amount: 14.90, frequency: 1, unit: 'months' }),
  yearly: Object.freeze({ cycle: 'yearly', cents: 14900, amount: 149, frequency: 12, unit: 'months' })
});
export function getPlan(cycle) {
  if (!Object.hasOwn(PLANS, cycle)) throw new Error('Ciclo de assinatura inválido.');
  return PLANS[cycle];
}
export function addMonths(date, months) {
  const start = new Date(date);
  if (!Number.isInteger(months) || months < 1 || !Number.isFinite(start.getTime())) throw new Error('Período inválido');
  const day = start.getUTCDate();
  const result = new Date(start);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const monthEnd = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, monthEnd));
  return result.toISOString();
}
export function isPaidThrough(date, now = new Date()) {
  return Boolean(date && Number.isFinite(Date.parse(date)) && Date.parse(date) > +now);
}
export function invoiceIsApproved(invoice, payment, plan) {
  if (!invoice || !payment || !plan) return false;
  return invoice.currency_id === 'BRL'
    && Number(invoice.transaction_amount) === plan.amount
    && String(invoice.payment?.id || '') === String(payment.id || '')
    && invoice.payment?.status === 'approved'
    && payment.status === 'approved'
    && payment.currency_id === 'BRL'
    && Number(payment.transaction_amount) === plan.amount;
}
export function parseSignature(value) {
  const params = Object.fromEntries(String(value || '').split(',').map(part => part.trim().split('=')));
  return (/^\d{10,13}$/.test(params.ts || '') && /^[0-9a-f]{64}$/i.test(params.v1 || ''))
    ? { ts: params.ts, signature: params.v1.toLowerCase() } : null;
}
export function manifest(id, requestId, ts) {
  if (!id || !requestId || !ts) throw new Error('Campos de assinatura ausentes.');
  return `id:${String(id).toLowerCase()};request-id:${requestId};ts:${ts};`;
}
export async function verifyWebhook({ signatureHeader, dataId, requestId, secret, now = Date.now() }) {
  const parsed = parseSignature(signatureHeader);
  if (!parsed || !secret || !dataId || !requestId) return false;
  const at = Number(parsed.ts) * (parsed.ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - at) > 10 * 60 * 1000) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(manifest(dataId, requestId, parsed.ts))));
  const given = Uint8Array.from(parsed.signature.match(/.{2}/g).map(v => parseInt(v, 16)));
  let difference = expected.length ^ given.length;
  for (let i = 0; i < Math.min(expected.length, given.length); i++) difference |= expected[i] ^ given[i];
  return difference === 0;
}
export function safeCheckoutUrl(uri) {
  try {
    const url = new URL(uri);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (
      host === 'mercadopago.com.br' || host.endsWith('.mercadopago.com.br') ||
      host === 'mercadopago.com' || host.endsWith('.mercadopago.com')
    ) ? url.href : null;
  } catch { return null; }
}
