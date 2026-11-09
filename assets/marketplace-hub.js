'use strict';
/* SERÁ QUEM FAZ? — módulos conectados à sessão e protegidos por RLS/RPC.
   Nunca utilizar conteúdo do banco como innerHTML nem simular métricas. */
(async()=>{
 const $=id=>document.getElementById(id);
 if(!$('sqfNotificationHub'))return;
 const make=(tag,klass,text)=>{
  const el=document.createElement(tag);if(klass)el.className=klass;
  if(text!==undefined)el.textContent=String(text);return el;
 };
 const missing=(target,message)=>target.replaceChildren(make('p','sqf-empty-state',message));
 const fmtMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const fmtDate=v=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
 const tell=(id,message,isError=false)=>{const e=$(id);if(e){e.textContent=message;e.dataset.error=String(isError);}};
 const validId=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
 let client,user,role;
 function activity(title,detail,stamp,link){
  const item=make('article','sqf-activity-item');
  const content=make('div');
  content.append(make('strong','',title),make('p','muted',detail));
  if(stamp)content.append(make('small','',fmtDate(stamp)));
  item.append(content);
  if(link&&validId(link)){
   const a=make('a','button button-outline button-small','Abrir');
   a.href='painel.html?solicitacao='+encodeURIComponent(link)+'#sqfRequestPortal';
   item.append(a);
  }
  return item;
 }
 async function notifications(){
  const list=$('sqfNotifications');if(!list)return;
  try{
   const {data,error}=await client.from('sqf_notifications')
    .select('id,kind,title,body,request_id,created_at,read_at')
    .order('created_at',{ascending:false}).limit(45);
   if(error)throw error;
   list.replaceChildren();
   if(!data?.length){missing(list,'Nenhuma notificação no momento. Novos avisos aparecerão quando houver atividade.');return;}
   const unread=data.filter(n=>!n.read_at).length;
   tell('sqfNotifyStatus',unread?unread+' aviso(s) não lido(s).':'Todos os avisos recentes foram lidos.');
   for(const n of data){
    const article=activity(n.title,n.body||'Atualização da conta',n.created_at,n.request_id);
    if(!n.read_at){
     article.classList.add('sqf-activity-unread');
     const button=make('button','button button-outline button-small','Marcar como lido');
     button.type='button';
     button.addEventListener('click',async()=>{
      button.disabled=true;
      const {error:err}=await client.from('sqf_notifications').update({read_at:new Date().toISOString()}).eq('id',n.id);
      if(err){button.disabled=false;tell('sqfNotifyStatus','Não foi possível marcar o aviso.',true);}
      else await notifications();
     });
     article.append(button);
    }
    list.append(article);
   }
  }catch{
   missing(list,'Notificações ainda indisponíveis. A migração do banco pode estar pendente.');
   tell('sqfNotifyStatus','Verifique a implantação da central de notificações.',true);
  }
 }
 async function preferences(){
  const control=$('sqfEmailNotify');if(!control)return;
  try{
   const {data,error}=await client.from('sqf_notification_preferences').select('email_enabled').eq('user_id',user.id).maybeSingle();
   if(error)throw error;
   control.checked=Boolean(data?.email_enabled);
   control.addEventListener('change',async()=>{
    control.disabled=true;
    const {error:saveError}=await client.from('sqf_notification_preferences').upsert({
     user_id:user.id,email_enabled:control.checked
    },{onConflict:'user_id'});
    if(saveError){
     control.checked=!control.checked;
     tell('sqfNotifyStatus','Não foi possível salvar a preferência de e-mail.',true);
    }else{
     tell('sqfNotifyStatus','Preferência registrada. O envio dependerá da implantação do serviço de e-mails.');
    }
    control.disabled=false;
   });
  }catch{
   control.disabled=true;
   $('sqfEmailNotifyHelp').textContent='Preferências indisponíveis até a aplicação da migração de notificações.';
  }
 }
 async function appointments(){
  const list=$('sqfAppointmentList');if(!list)return;
  try{
   const {data,error}=await client.from('sqf_appointments')
    .select('id,request_id,starts_at,duration_minutes,status,proposed_by')
    .order('starts_at',{ascending:true}).limit(70);
   if(error)throw error;
   list.replaceChildren();
   if(!data?.length){missing(list,'Sua agenda está vazia. Abra um orçamento aceito para propor um horário de atendimento.');return;}
   const labels={proposed:'Aguardando confirmação',confirmed:'Horário confirmado',declined:'Proposta recusada',canceled:'Agendamento cancelado'};
   for(const row of data){
    const detail=fmtDate(row.starts_at)+' · '+row.duration_minutes+' minutos';
    list.append(activity(labels[row.status]||'Agenda',detail,'',row.request_id));
   }
   tell('sqfAppointmentStatus',data.filter(x=>x.status==='confirmed').length+' horário(s) confirmado(s).');
  }catch{
   missing(list,'Agenda ainda não implantada no banco. Solicitações e mensagens continuam disponíveis.');
   tell('sqfAppointmentStatus','Não foi possível consultar a agenda.',true);
  }
 }
 async function compareQuotes(){
  const list=$('sqfQuoteCompareList');if(!list||role!=='cliente')return;
  try{
   const {data,error}=await client.from('sqf_service_requests')
    .select('id,provider_id,description,quote_cents,quote_terms,status,created_at')
    .eq('client_id',user.id).not('quote_cents','is',null)
    .order('quote_cents',{ascending:true}).limit(35);
   if(error)throw error;
   list.replaceChildren();
   if(!data?.length){missing(list,'Nenhum orçamento recebido. Solicite propostas diretamente nos perfis dos profissionais.');return;}
   const ids=[...new Set(data.map(x=>x.provider_id))];
   const {data:profiles,error:pe}=await client.from('profiles').select('id,full_name').in('id',ids);
   const names=new Map((pe?[]:profiles||[]).map(x=>[x.id,x.full_name]));
   for(const item of data){
    const card=make('article','sqf-quote-compare-card');
    card.append(make('span','sqf-quote-meta',names.get(item.provider_id)||'Prestador da solicitação'));
    card.append(make('strong','',fmtMoney(item.quote_cents)));
    card.append(make('p','',item.description.slice(0,165)));
    if(item.quote_terms)card.append(make('p','muted','Condições: '+item.quote_terms.slice(0,190)));
    card.append(make('small','', 'Situação: '+({
     quoted:'Aguardando decisão',accepted:'Aceito',in_progress:'Em atendimento',
     completed:'Concluído',canceled:'Cancelado',declined:'Recusado'
    }[item.status]||item.status)));
    if(validId(item.id)){
     const a=make('a','button button-outline button-small','Ver proposta');
     a.href='painel.html?solicitacao='+encodeURIComponent(item.id)+'#sqfRequestPortal';
     card.append(a);
    }
    list.append(card);
   }
  }catch{
   missing(list,'Não foi possível comparar propostas. Confirme sua sessão e tente atualizar.');
  }
 }
 async function performance(){
  if(role!=='prestador')return;
  const list=$('sqfPerformanceStats');if(!list)return;
  try{
   const {data,error}=await client.rpc('sqf_my_performance');
   if(error||!Array.isArray(data)||!data.length)throw error||new Error('Métrica não disponível');
   const row=data[0];
   const metrics=[
    ['Visualizações autenticadas',row.views_authenticated],
    ['Solicitações recebidas',row.requests_total],
    ['Orçamentos enviados',row.quotes_sent],
    ['Atendimentos concluídos',row.requests_completed]
   ];
   list.replaceChildren();
   for(const [label,total] of metrics){
    const block=make('div','client-stat');
    block.append(make('span','',label),make('strong','',Number.isFinite(Number(total))?String(total):'—'));
    list.append(block);
   }
   tell('sqfPerformanceStatus','Valores consultados do banco; não incluem visualizações anônimas.');
  }catch{
   missing(list,'Relatório de desempenho ainda indisponível. A migração de métricas pode estar pendente.');
   tell('sqfPerformanceStatus','Nenhum indicador foi estimado ou inventado.',true);
  }
 }
 async function support(){
  const list=$('sqfSupportList');if(!list)return;
  try{
   const {data,error}=await client.from('sqf_support_tickets')
    .select('id,topic,message,status,created_at').eq('user_id',user.id)
    .order('created_at',{ascending:false}).limit(12);
   if(error)throw error;
   list.replaceChildren();
   if(!data?.length){missing(list,'Nenhuma solicitação de suporte registrada.');return;}
   const status={open:'Recebida',reviewing:'Em análise',resolved:'Resolvida'};
   for(const ticket of data)
    list.append(activity(status[ticket.status]||'Solicitação',ticket.message.slice(0,180),ticket.created_at));
  }catch{
   missing(list,'Histórico de suporte indisponível até a implantação da migração.');
  }
 }
 async function init(){
  client=window.getSQFClient();
  const {data:session,error:sessionError}=await client.auth.getUser();
  if(sessionError||!session?.user)return;
  user=session.user;
  const {data:p,error:profileError}=await client.from('profiles').select('account_type').eq('id',user.id).maybeSingle();
  if(profileError||!['cliente','prestador'].includes(p?.account_type))return;
  role=p.account_type;
  for(const id of ['sqfNotificationHub','sqfAppointmentHub','sqfSupportHub']){
   if($(id))$(id).hidden=false;
  }
  if(role==='prestador')$('sqfPerformanceHub').hidden=false;
  if(role==='cliente')$('sqfQuoteCompare').hidden=false;
  $('sqfNotifyRefresh')?.addEventListener('click',()=>void notifications());
  $('sqfAppointmentRefresh')?.addEventListener('click',()=>void appointments());
  $('sqfPerformanceRefresh')?.addEventListener('click',()=>void performance());
  window.addEventListener('sqf:appointment-updated',()=>void appointments());
  document.addEventListener('visibilitychange',()=>{
   if(!document.hidden)void notifications();
  });
  const form=$('sqfSupportForm');
  form?.addEventListener('submit',async e=>{
   e.preventDefault();
   const text=$('sqfSupportText').value.trim(),topic=$('sqfSupportTopic').value;
   if(text.length<15||text.length>2000){tell('sqfSupportStatus','Escreva entre 15 e 2000 caracteres.',true);return;}
   const b=$('sqfSupportSubmit');b.disabled=true;
   try{
    const {error}=await client.from('sqf_support_tickets')
     .insert({user_id:user.id,topic,message:text});
    if(error)throw error;
    $('sqfSupportText').value='';
    tell('sqfSupportStatus','Solicitação registrada. Você poderá acompanhar a situação neste painel.');
    await support();
   }catch{
    tell('sqfSupportStatus','Não foi possível registrar o pedido. Confirme a conexão e as permissões.',true);
   }finally{b.disabled=false;}
  });
  await Promise.allSettled([notifications(),preferences(),appointments(),compareQuotes(),performance(),support()]);
 }
 try{await init();}catch{ /* Se a sessão não carregar, nenhum dado é exibido. */ }
})();
