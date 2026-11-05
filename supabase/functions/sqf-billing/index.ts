/**
 * SERÁ QUEM FAZ? v3.8.0 — gateway seguro de assinaturas (Mercado Pago).
 * Deploy como Supabase Edge Function. Nenhuma chave privada deve ir ao frontend.
 * A execução é BLOQUEADA até SQF_BILLING_ENABLED=true e demais segredos configurados.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { addMonths, getPlan, invoiceIsApproved, isPaidThrough, safeCheckoutUrl, verifyWebhook } from '../_shared/billing-core.mjs';

const env = (key: string) => Deno.env.get(key) || '';
const URL_MP = 'https://api.mercadopago.com';
const origin = (() => { try {return new URL(env('SQF_SITE_URL')).origin;} catch {return '';} })();
const allowedHeaders = 'authorization,apikey,content-type';
const cors = (request: Request) => ({
  'Access-Control-Allow-Origin': request.headers.get('origin') === origin && origin ? origin : 'null',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': allowedHeaders,
  'Cache-Control': 'no-store',
  'Vary': 'Origin'
});
const response = (request: Request, status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: {'Content-Type':'application/json; charset=utf-8',...cors(request)} });
const fail = (msg: string, code=400) => ({ error: msg, status: code });
const uuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const idValid = (value: string) => /^[0-9A-Za-z-]{8,120}$/.test(value);
const invoiceIdValid = (value: string) => /^\d{1,24}$/.test(value);

function admin() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
async function authenticated(req: Request) {
  const jwt = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!jwt) throw fail('Entre na sua conta para continuar.',401);
  const sdk = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: {autoRefreshToken:false,persistSession:false}
  });
  const { data, error } = await sdk.auth.getUser(jwt);
  if (error || !data?.user?.id || !uuid(data.user.id)) throw fail('Sessão inválida ou expirada.',401);
  return data.user;
}
async function dbRow(userId: string) {
  const {data,error} = await admin().from('sqf_billing_subscriptions')
    .select('id,user_id,external_reference,mp_preapproval_id,checkout_url,cycle,price_cents,state,paid_until,cancel_requested_at,created_at,updated_at,last_verified_at')
    .eq('user_id', userId).maybeSingle();
  if (error) throw fail('A base de assinaturas ainda não está configurada.',503);
  return data;
}
async function provider(userId: string) {
  const {data,error} = await admin().from('profiles').select('account_type').eq('id',userId).maybeSingle();
  if (error || data?.account_type !== 'prestador') throw fail('Assinaturas são destinadas apenas a prestadores.',403);
}
async function mp(path: string, init: RequestInit = {}) {
  const res = await fetch(URL_MP + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`,
      'Content-Type':'application/json',
      ...(init.headers||{})
    },
    signal: AbortSignal.timeout(12000)
  });
  let body: any;
  try { body = await res.json(); } catch { throw fail('Resposta inválida do processador de pagamentos.',502); }
  if (!res.ok) {
    console.error('Erro Mercado Pago:', res.status, String(body?.message||'sem detalhes').slice(0,150));
    throw fail('Não foi possível consultar o processador de pagamentos.',502);
  }
  return body;
}
function ensureTrusted(sub: any, mpSub: any) {
  if (String(mpSub.id) !== String(sub.mp_preapproval_id) ||
    String(mpSub.external_reference) !== String(sub.external_reference))
    throw fail('Assinatura externa não corresponde ao cadastro.',409);
  const plan=getPlan(sub.cycle);
  const frequency=mpSub.auto_recurring || {};
  if (frequency.currency_id !== 'BRL' || Number(frequency.transaction_amount) !== plan.amount ||
    Number(frequency.frequency) !== plan.frequency || frequency.frequency_type !== plan.unit)
    throw fail('Divergência de preço ou frequência; atendimento necessário.',409);
  return plan;
}
async function refreshPeriod(sub: any) {
  const db=admin();
  const {data,error} = await db.from('sqf_billing_invoices').select('paid_period_end')
    .eq('subscription_id',sub.id).eq('status','approved').order('paid_period_end',{ascending:false}).limit(1);
  if(error) throw fail('Falha ao consultar pagamentos.',503);
  const paid_until = data?.[0]?.paid_period_end || null;
  const {error:ue}=await db.from('sqf_billing_subscriptions').update({paid_until,updated_at:new Date().toISOString()}).eq('id',sub.id);
  if (ue) throw fail('Falha ao atualizar vigência.',503);
  return paid_until;
}
async function syncInvoice(sub: any, invoiceId: string) {
  if (!invoiceIdValid(invoiceId)) throw fail('ID de fatura inválido.',400);
  const invoice = await mp(`/authorized_payments/${encodeURIComponent(invoiceId)}`);
  if (String(invoice.preapproval_id) !== String(sub.mp_preapproval_id))
    throw fail('Fatura não vinculada à assinatura.',409);
  const plan = getPlan(sub.cycle);
  const paymentId = String(invoice.payment?.id||'');
  let payment = null;
  if (invoiceIdValid(paymentId)) payment = await mp(`/v1/payments/${encodeURIComponent(paymentId)}`);
  const approved = invoiceIsApproved(invoice,payment,plan);
  const paymentState = String(payment?.status || invoice.payment?.status || 'pending');
  const status = approved ? 'approved' :
    paymentState === 'refunded' ? 'refunded' :
    paymentState === 'charged_back' ? 'charged_back' :
    ['rejected','cancelled'].includes(paymentState) ? 'rejected' : 'pending';
  const paidAt = approved ? payment?.date_approved : null;
  const verifiedPaidAt = paidAt && Number.isFinite(Date.parse(paidAt)) ? paidAt : null;
  // Falha fechada: mesmo aprovado, data válida é exigida antes de liberar acesso.
  const safeStatus = approved && verifiedPaidAt ? 'approved' : status === 'approved' ? 'pending' : status;
  const end = safeStatus === 'approved' ? addMonths(verifiedPaidAt, sub.cycle==='yearly' ? 12 : 1) : null;
  const {error}=await admin().from('sqf_billing_invoices').upsert({
    subscription_id:sub.id, mp_invoice_id:invoiceId, mp_payment_id:invoiceIdValid(paymentId)?paymentId:null,
    status:safeStatus, amount_cents:Math.round(Number(invoice.transaction_amount)*100),
    currency:String(invoice.currency_id||'BRL'), paid_at:safeStatus==='approved'?verifiedPaidAt:null,
    paid_period_end:end,verified_at:new Date().toISOString()
  },{onConflict:'mp_invoice_id'});
  if(error) throw fail('Erro ao reconciliar fatura.',503);
  await refreshPeriod(sub);
}
async function syncSubscription(sub: any, includeInvoices=true) {
  if (!idValid(sub.mp_preapproval_id||'')) throw fail('Assinatura externa ainda não cadastrada.',409);
  const mpSub=await mp(`/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`);
  ensureTrusted(sub,mpSub);
  const state=String(mpSub.status||'pending');
  if (!['pending','authorized','paused','canceled'].includes(state)) throw fail('Estado externo inesperado.',502);
  const now=new Date().toISOString();
  const {error}=await admin().from('sqf_billing_subscriptions').update({
    state, last_verified_at:now, updated_at:now,
    ...(state==='canceled' ? {canceled_at:now,cancel_requested_at:sub.cancel_requested_at||now} : {})
  }).eq('id',sub.id);
  if(error) throw fail('Erro ao registrar situação.',503);
  if(includeInvoices) {
    // Faz reconciliação de faturas mesmo se o webhook tiver sido perdido.
    let offset=0;
    for (let page=0; page<10; page++) {
      const result=await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(sub.mp_preapproval_id)}&limit=20&offset=${offset}`);
      const invoices=Array.isArray(result.results) ? result.results : [];
      for (const row of invoices) if(invoiceIdValid(String(row.id))) await syncInvoice(sub,String(row.id));
      offset+=invoices.length;
      if(invoices.length<20 || offset >= Number(result.paging?.total || offset)) break;
      if(page===9) throw fail('Reconciliação incompleta, tente novamente.',503);
    }
  }
}
async function checkout(user: any, body: any) {
  await provider(user.id);
  const plan=getPlan(body?.cycle);
  const previous=await dbRow(user.id);
  if (previous && (isPaidThrough(previous.paid_until) || ['creating','pending','authorized','paused'].includes(previous.state))) {
    throw fail('Existe uma assinatura vigente ou pendente. Gerencie-a pelo painel antes de contratar outra.',409);
  }
  const db=admin();
  const newSub={
    user_id:user.id,cycle:plan.cycle,price_cents:plan.cents,state:'creating',
    external_reference:previous?.state==='failed' ? previous.external_reference : crypto.randomUUID(),mp_preapproval_id:null,checkout_url:null,
    paid_until:null,cancel_requested_at:null,canceled_at:null,last_verified_at:null,updated_at:new Date().toISOString()
  };
  let created: any;
  if(previous) {
    const {data,error}=await db.from('sqf_billing_subscriptions').update(newSub)
      .eq('id',previous.id).eq('state',previous.state).select('*').single();
    if(error) throw fail('Assinatura em atualização. Tente novamente.',409);
    created=data;
  } else {
    const {data,error}=await db.from('sqf_billing_subscriptions').insert(newSub).select('*').single();
    if(error) throw fail('Já existe uma solicitação de assinatura para esta conta.',409);
    created=data;
  }
  try {
    if(!user.email || !user.email_confirmed_at) throw fail('Confirme seu e-mail antes de solicitar uma assinatura.',403);
    const mpSub=await mp('/preapproval',{
      method:'POST',
      headers:{'X-Idempotency-Key':created.external_reference},
      body:JSON.stringify({
        reason:`SERÁ QUEM FAZ? — Plano Profissional ${plan.cycle==='yearly'?'Anual':'Mensal'}`,
        external_reference:created.external_reference,
        payer_email:user.email,
        auto_recurring:{frequency:plan.frequency,frequency_type:plan.unit,transaction_amount:plan.amount,currency_id:'BRL'},
        back_url:new URL('painel.html?pagamento=retorno#assinatura', env('SQF_SITE_URL').replace(/\/?$/, '/')).href,
        status:'pending'
      })
    });
    const url=safeCheckoutUrl(mpSub.init_point);
    if(!url || !idValid(String(mpSub.id||'')) || String(mpSub.external_reference) !== created.external_reference)
      throw fail('O processador não retornou um link válido para a assinatura.',502);
    const {error}=await db.from('sqf_billing_subscriptions').update({
      state:'pending',mp_preapproval_id:String(mpSub.id),checkout_url:url,updated_at:new Date().toISOString()
    }).eq('id',created.id);
    if(error) throw fail('Não foi possível registrar o checkout. Não conclua o pagamento; procure suporte.',503);
    return {checkout_url:url};
  } catch(err) {
    await db.from('sqf_billing_subscriptions').update({state:'failed',updated_at:new Date().toISOString()})
      .eq('id',created.id).eq('state','creating');
    throw err;
  }
}
async function cancel(user: any) {
  await provider(user.id);
  const sub=await dbRow(user.id);
  if(!sub || !sub.mp_preapproval_id || !['pending','authorized','paused'].includes(sub.state))
    throw fail('Não há assinatura recorrente ativa para cancelar.',409);
  // Confirma estado externo e associa a referência antes de cancelar.
  const remote=await mp(`/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`);
  ensureTrusted(sub,remote);
  if(remote.status==='canceled') {
    await syncSubscription(sub,false);
  } else {
    const updated=await mp(`/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`,{
      method:'PUT',body:JSON.stringify({status:'canceled'})
    });
    if(updated.status!=='canceled') throw fail('O processador ainda não confirmou o cancelamento.',502);
    await syncSubscription(sub,false);
  }
  // paid_until é determinado por faturas aprovadas e NÃO é apagado ao cancelar.
  const fresh=await dbRow(user.id);
  return {state:fresh.state,paid_until:fresh.paid_until};
}
async function status(user:any) {
  await provider(user.id);
  const sub=await dbRow(user.id);
  if(!sub) return {subscription:null,enabled:true};
  return {enabled:true, subscription:{
    cycle:sub.cycle,state:sub.state,paid_until:sub.paid_until,
    cancel_requested_at:sub.cancel_requested_at,
    active:isPaidThrough(sub.paid_until), last_verified_at:sub.last_verified_at
  }};
}
// Histórico restrito ao proprietário da assinatura; não expor e-mails, tokens ou IDs do gateway.
async function history(user:any) {
  await provider(user.id);
  const sub=await dbRow(user.id);
  if(!sub)return {subscription:null,invoices:[]};
  const {data,error}=await admin().from('sqf_billing_invoices')
    .select('status,amount_cents,paid_at,verified_at,paid_period_end')
    .eq('subscription_id',sub.id).order('verified_at',{ascending:false}).limit(36);
  if(error)throw fail('O histórico financeiro está temporariamente indisponível.',503);
  return {subscription:{cycle:sub.cycle,state:sub.state,paid_until:sub.paid_until},invoices:(data||[]).map(row=>({
    status:row.status,amount_cents:row.amount_cents,paid_at:row.paid_at,
    verified_at:row.verified_at,paid_period_end:row.paid_period_end
  }))};
}
async function handleWebhook(req:Request) {
  // Body NUNCA autoriza diretamente uma assinatura; sempre reconsulta o recurso na API.
  const url=new URL(req.url);
  const body=await req.json().catch(()=>null);
  if(!body || !['subscription_preapproval','subscription_authorized_payment','payment'].includes(body.type))
    return {accepted:true};
  const dataId=String(url.searchParams.get('data.id') || url.searchParams.get('id') || '');
  const bodyId=String(body.data?.id||'');
  if(!dataId || !bodyId || dataId.toLowerCase()!==bodyId.toLowerCase()) throw fail('Evento inválido.',401);
  const ok=await verifyWebhook({signatureHeader:req.headers.get('x-signature'),
    dataId,requestId:req.headers.get('x-request-id'),secret:env('MP_WEBHOOK_SECRET')});
  if(!ok) throw fail('Assinatura do webhook inválida.',401);
  const db=admin();
  if (body.type==='subscription_preapproval') {
    if(!idValid(dataId)) throw fail('ID de assinatura inválido.',400);
    const {data,error}=await db.from('sqf_billing_subscriptions').select('*').eq('mp_preapproval_id',dataId).maybeSingle();
    if(error) throw fail('Falha interna no webhook.',503);
    if(data) await syncSubscription(data,true);
  } else if (body.type==='subscription_authorized_payment') {
    if(!invoiceIdValid(dataId)) throw fail('ID de fatura inválido.',400);
    const invoice=await mp(`/authorized_payments/${encodeURIComponent(dataId)}`);
    const {data,error}=await db.from('sqf_billing_subscriptions').select('*').eq('mp_preapproval_id',String(invoice.preapproval_id)).maybeSingle();
    if(error) throw fail('Falha interna no webhook.',503);
    if(data) {
      const remote=await mp(`/preapproval/${encodeURIComponent(data.mp_preapproval_id)}`);
      ensureTrusted(data,remote);
      await syncInvoice(data,dataId);
    }
  } else if(invoiceIdValid(dataId)) {
    // Pagamento: nunca vincular pelo e-mail nem por metadados do payload.
    const {data,error}=await db.from('sqf_billing_invoices').select('mp_invoice_id,subscription_id')
      .eq('mp_payment_id',dataId).maybeSingle();
    if(error) throw fail('Falha interna no webhook.',503);
    if(data){
      const {data:sub}=await db.from('sqf_billing_subscriptions').select('*').eq('id',data.subscription_id).maybeSingle();
      if(sub) await syncInvoice(sub,String(data.mp_invoice_id));
    }
  }
  return {accepted:true};
}
async function reconcile(req:Request) {
  if(!env('SQF_RECONCILE_SECRET') || req.headers.get('x-sqf-reconcile-secret')!==env('SQF_RECONCILE_SECRET'))
    throw fail('Acesso negado.',403);
  const {data,error}=await admin().from('sqf_billing_subscriptions').select('*')
    .not('mp_preapproval_id','is',null).order('last_verified_at',{ascending:true,nullsFirst:true}).limit(50);
  if(error) throw fail('Não foi possível consultar assinaturas.',503);
  let succeeded=0;let failed=0;
  for(const sub of data||[]) {
    try{await syncSubscription(sub,true);succeeded++;}
    catch(error){console.error('Falha na reconciliação',sub.id,error);failed++;}
  }
  if(failed) throw fail(`Reconciliação parcial: ${succeeded} processadas; ${failed} pendentes.`,503);
  return {processed:succeeded,failed};
}
Deno.serve(async (req:Request) => {
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(req)});
  try {
    const path=new URL(req.url).pathname.split('/').pop();
    const isWebhook=path==='webhook';
    if(!isWebhook && req.headers.get('origin') && req.headers.get('origin')!==origin)
      throw fail('Origem não autorizada.',403);
    if(!['GET','POST'].includes(req.method)) throw fail('Método não permitido.',405);
    if(!env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY') || !env('SUPABASE_SERVICE_ROLE_KEY'))
      throw fail('Servidor de assinaturas não configurado.',503);
    if(env('SQF_BILLING_ENABLED')!=='true' || !env('MP_ACCESS_TOKEN') || !env('MP_WEBHOOK_SECRET') || !origin || !env('SQF_RECONCILE_SECRET'))
      throw fail('Assinaturas em homologação. Nenhuma cobrança está habilitada.',503);
    const action=path==='sqf-billing' ? 'status':path;
    if(action==='webhook' && req.method==='POST') return response(req,200,await handleWebhook(req));
    if(action==='reconcile' && req.method==='POST') return response(req,200,await reconcile(req));
    const user=await authenticated(req);
    if(action==='status' && req.method==='GET') return response(req,200,await status(user));
    if(action==='history' && req.method==='GET') return response(req,200,await history(user));
    if(action==='refresh' && req.method==='POST') {
      const sub=await dbRow(user.id);
      await provider(user.id);
      if(sub?.mp_preapproval_id){
        if(sub.last_verified_at && Date.now()-Date.parse(sub.last_verified_at)<60000)
          return response(req,200,await status(user));
        await syncSubscription(sub,true);
      }
      return response(req,200,await status(user));
    }
    if(action==='checkout' && req.method==='POST'){
      if(Number(req.headers.get('content-length')||0)>2048) throw fail('Requisição excessiva.',413);
      const body=await req.json().catch(()=>null);
      return response(req,200,await checkout(user,body));
    }
    if(action==='cancel' && req.method==='POST') return response(req,200,await cancel(user));
    throw fail('Ação inexistente.',404);
  } catch (err) {
    const x=err && typeof err==='object' ? err as {error?:string;status?:number} : {};
    console.error('sqf-billing:',x.status||500,x.error||'erro interno');
    return response(req,x.status||500,{error:x.error||'Não foi possível concluir a operação.'});
  }
});
