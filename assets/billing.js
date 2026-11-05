'use strict';
/* Interface do plano profissional: somente o servidor conhece o estado de pagamento.
 * Nunca ativar assinatura por query string, status no localStorage ou retorno do checkout. */
(function(scope) {
  const $ = id => document.getElementById(id);
  const planPrice = { monthly: 'R$ 14,90/mês', yearly: 'R$ 149,00/ano' };
  const cleanCycle = value => value === 'yearly' ? 'yearly' : 'monthly';
  const formatDate = date => date && Number.isFinite(Date.parse(date))
    ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(date)) : 'não informado';
  function message(text,isError=false) {
    const el=$('billingMessage'); if(!el)return;
    el.textContent=text;el.dataset.error=String(isError);
  }
  async function request(client, path, body) {
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente na conta.');
    const base=scope.SQFSupabase.url.replace(/\/$/,'');
    const response=await fetch(`${base}/functions/v1/sqf-billing/${path}`,{
      method:body===undefined?'GET':'POST',
      headers:{'Content-Type':'application/json',authorization:`Bearer ${session.access_token}`,
        apikey:scope.SQFSupabase.publishableKey},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error || 'Não foi possível consultar sua assinatura.');
    return result;
  }
  function render(state) {
    const row=state?.subscription;
    $('billingStatus').textContent=!row ? 'Sem assinatura' :
      row.active ? (row.state==='canceled'?'Cancelada — acesso pago vigente':'Período pago vigente') :
      ({pending:'Aguardando autorização ou pagamento',authorized:'Aguardando confirmação do pagamento',
        canceled:'Assinatura cancelada',paused:'Assinatura pausada',failed:'Tentativa não concluída',
        creating:'Preparando assinatura'}[row.state] || 'Sem período pago confirmado');
    $('billingPaidUntil').textContent=row?.paid_until ? `Vigência paga até ${formatDate(row.paid_until)}.` :
      'A vigência começa somente depois da confirmação de um pagamento aprovado.';
    $('billingCurrentCycle').textContent=row?.cycle ? `Ciclo contratado: ${row.cycle==='yearly'?'anual':'mensal'}.` : '';
    const cancel=$('billingCancel');
    cancel.hidden=!row || !['authorized','pending','paused'].includes(row.state);
    const subscribe=$('billingCheckout');
    subscribe.disabled=Boolean(row && (row.active || ['pending','authorized','creating','paused'].includes(row.state)));
    if (row?.cancel_requested_at) message('A renovação automática foi cancelada. O período já pago é preservado até o vencimento.');
  }

  function showHistory(data){
    const holder=$('billingHistory');if(!holder)return;
    holder.replaceChildren();
    const rows=Array.isArray(data?.invoices)?data.invoices:[];
    if(!rows.length){const p=document.createElement('p');p.className='muted';
      p.textContent='Nenhuma cobrança verificada registrada nesta conta.';holder.append(p);return;}
    const labels={approved:'Aprovada',pending:'Pendente',rejected:'Recusada',refunded:'Estornada',charged_back:'Contestada'};
    for(const item of rows){
      const article=document.createElement('article');article.className='sqf-payment-row';
      const heading=document.createElement('strong');heading.textContent=`${labels[item.status]||'Em análise'} · ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(item.amount_cents||0)/100)}`;
      const detail=document.createElement('p');detail.className='muted';
      detail.textContent=`Verificação: ${formatDate(item.verified_at)}${item.paid_at?' · Pago em '+formatDate(item.paid_at):''}${item.paid_period_end?' · Vigência até '+formatDate(item.paid_period_end):''}`;
      article.append(heading,detail);holder.append(article);
    }
  }
  async function init(client,user,profile) {
    if(profile.account_type!=='prestador')return;
    const panel=$('billingPanel');if(!panel)return;
    panel.hidden=false;
    const cfg=scope.SQFBillingConfig;
    const enabled=cfg?.enabled===true;
    const cycle=$('billingCycle');
    const routeCycle=new URLSearchParams(location.search).get('ciclo');
    cycle.value=cleanCycle(routeCycle);
    const updatePrice=()=>{$('billingSelectedPrice').textContent=planPrice[cleanCycle(cycle.value)];};
    cycle.addEventListener('change',updatePrice);updatePrice();
    if(!enabled){
      message('Pagamento em homologação. Não há cobrança disponível no momento. Seu cadastro e a análise profissional continuam separados.',false);
      $('billingCheckout').disabled=true;
      $('billingCancel').hidden=true;
      $('billingRefresh').disabled=true;
      $('billingStatus').textContent='Integração não ativada';
      $('billingHistoryRefresh').disabled=true;
      return;
    }
    let busy=false;
    const lock=(value)=>{busy=value;$('billingRefresh').disabled=value;$('billingCancel').disabled=value;
      if(value)$('billingCheckout').disabled=true;};
    const refresh=async (force=false)=>{
      if(busy)return;
      lock(true);
      try{
        const result=await request(client,force?'refresh':'status',force?{}:undefined);
        render(result);message(force?'Situação consultada no servidor.':'Cobrança gerenciada por conexão segura.');
        if(new URLSearchParams(location.search).has('pagamento'))
          message('Retorno do Mercado Pago recebido. A autorização ou o pagamento será confirmado pelo servidor; o retorno não ativa sua assinatura.');
      }catch(error){message(error.message,true);}finally{lock(false);}
    };
    $('billingRefresh').addEventListener('click',()=>refresh(true));
    $('billingHistoryRefresh')?.addEventListener('click',async()=>{
      const b=$('billingHistoryRefresh');b.disabled=true;
      $('billingHistory').textContent='Consultando registros verificados...';
      try{showHistory(await request(client,'history'));}
      catch(error){$('billingHistory').textContent=error.message||'Histórico indisponível.';}
      finally{b.disabled=false;}
    });
    $('billingCheckout').addEventListener('click',async()=>{
      if(busy)return;
      const selected=cleanCycle(cycle.value);
      if(!confirm(`Você será direcionado ao Mercado Pago para autorizar a assinatura profissional de ${planPrice[selected]}. Deseja continuar?`))return;
      lock(true);
      message('Preparando autorização de assinatura...');
      try{
        const data=await request(client,'checkout',{cycle:selected});
        const link=new URL(data.checkout_url);
        if(link.protocol!=='https:' || !(link.hostname==='mercadopago.com.br'||link.hostname.endsWith('.mercadopago.com.br')||link.hostname==='mercadopago.com'||link.hostname.endsWith('.mercadopago.com')))
          throw new Error('Link de checkout inválido.');
        location.assign(link.href);
      }catch(error){message(error.message,true);}finally{lock(false);}
    });
    $('billingCancel').addEventListener('click',async()=>{
      if(busy)return;
      if(!confirm('Cancelar a renovação automática? O período pago continuará disponível até o vencimento, mas o Mercado Pago não deverá realizar novas cobranças.'))return;
      lock(true);message('Solicitando cancelamento...');
      let canceled=false;
      try{const result=await request(client,'cancel',{});message(result.paid_until
        ? `Cancelamento confirmado. Vigência paga até ${formatDate(result.paid_until)}.`
        : 'Cancelamento confirmado. Nenhum período pago foi identificado.');canceled=true;}
      catch(error){message(error.message,true);}finally{lock(false);}
      if(canceled)await refresh();
    });
    await refresh(new URLSearchParams(location.search).has('pagamento'));
  }
  scope.SQFBillingUI=Object.freeze({init});
})(window);
