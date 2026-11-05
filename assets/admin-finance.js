'use strict';
/* Indicadores financeiros somente via RPC com papel admin e JWT aal2. */
(async()=>{
  const $=id=>document.getElementById(id),section=$('sqfAdminBilling');if(!section)return;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // A autenticação de admin.js é assíncrona. O botão permanece indisponível para visitantes.
  for(let step=0;step<25;step++){
    if(!$('adminContent')?.hidden)break;
    await pause(200);
  }
  if($('adminContent')?.hidden)return;
  let client;try{client=window.getSQFClient();}catch{return;}
  const {data, error}=await client.rpc('sqf_staff_whoami');
  if(error||data?.role!=='admin'||data?.mfa_ready!==true)return;
  section.hidden=false;
  const button=$('sqfBillingAdminRefresh'),box=$('sqfBillingAdminStats'),status=$('sqfBillingAdminStatus');
  const fields=[['subscription_pending','Assinaturas pendentes'],['paid_active','Períodos pagos vigentes'],['payment_failed','Falhas/contestações'],['refunds','Estornos'],['subscription_canceled','Cancelamentos'],['stale_reconciliation','Conciliação atrasada']];
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='Consultando contagens agregadas...';
    try{
      const result=await client.rpc('sqf_staff_billing_overview');if(result.error)throw result.error;
      box.replaceChildren();
      const risk=await client.rpc('sqf_staff_request_risk_overview');
      if(!risk.error){
        for(const [key,label] of [['clients_high_volume','Volume elevado de pedidos (24h)'],['messages_high_volume','Volume elevado de mensagens (1h)'],['requests_pending','Pedidos aguardando resposta'],['waiting_confirmation','Serviços aguardando confirmação']]){
          if(!fields.some(([name])=>name===key))fields.push([key,label]);
        }
      }
      const metrics={...result.data,...(!risk.error?risk.data:{})};
      for(const [key,label] of fields){
        const tile=document.createElement('div');tile.className='admin-stat';
        const title=document.createElement('span');title.textContent=label;
        const value=document.createElement('strong');value.textContent=String(metrics?.[key]??'—');
        tile.append(title,value);box.append(tile);
      }
      status.textContent='Dados obtidos pelo servidor. Falhas de pagamento não comprovam fraude.';
    }catch{status.textContent='Indicadores indisponíveis. Verifique MFA e as migrações no Supabase.';}
    finally{button.disabled=false;}
  });
})();
