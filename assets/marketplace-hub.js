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
 let compareCache=[],compareNames=new Map();
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
   let hasPreference=Boolean(data);
   control.addEventListener('change',async()=>{
    control.disabled=true;
    // UPDATE é permitido apenas na coluna email_enabled; não enviar outras
    // colunas via UPSERT que exija permissões além da declaração de RLS.
    const query=client.from('sqf_notification_preferences');
    const result=hasPreference
      ?await query.update({email_enabled:control.checked}).eq('user_id',user.id)
      :await query.insert({user_id:user.id,email_enabled:control.checked});
    const saveError=result.error;
    if(!saveError)hasPreference=true;
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
 function renderComparedQuotes(){
  const list=$('sqfQuoteCompareList');if(!list||role!=='cliente')return;
  const status=$('sqfCompareStatus')?.value||'all';
  const query=($('sqfCompareSearch')?.value||'').slice(0,100);
  const order=$('sqfCompareOrder')?.value||'lowest';
  const visible=window.SQFQuoteComparison
   ?window.SQFQuoteComparison.filter(compareCache,{status,query,order},compareNames)
   :compareCache.filter(item=>Number.isSafeInteger(item.quote_cents)&&item.quote_cents>=0);
  list.replaceChildren();
  tell('sqfCompareCount',visible.length+' de '+compareCache.length+' proposta(s) recebida(s) nesta consulta. O valor é declarado pelo prestador; compare escopo e condições antes de aceitar.');
  if(!compareCache.length){
   missing(list,'Nenhum orçamento recebido. Solicite propostas em perfis publicados para começar.');
   return;
  }
  if(!visible.length){
   missing(list,'Nenhuma proposta corresponde aos filtros. Limpe a busca ou escolha outra situação.');
   return;
  }
  const names={quoted:'Aguardando decisão',accepted:'Aceito',in_progress:'Em atendimento',
    awaiting_confirmation:'Aguardando confirmação',completed:'Concluído',
    canceled:'Cancelado',declined:'Recusado',requested:'Solicitado'};
  for(const item of visible){
   const card=make('article','sqf-quote-compare-card');
   const providerName=compareNames.get(item.provider_id)||'Prestador da solicitação';
   card.append(make('span','sqf-quote-meta',providerName));
   card.append(make('strong','',fmtMoney(item.quote_cents)));
   card.append(make('p','',String(item.description||'Descrição não informada.').slice(0,165)));
   if(item.quote_terms)card.append(make('p','muted','Condições: '+String(item.quote_terms).slice(0,190)));
   card.append(make('small','', 'Situação: '+(names[item.status]||'A consultar')));
   if(validId(item.id)){
    const link=make('a','button button-outline button-small','Ver proposta e conversar');
    link.href='painel.html?solicitacao='+encodeURIComponent(item.id)+'#sqfRequestPortal';
    card.append(link);
   }
   list.append(card);
  }
 }
 async function compareQuotes(){
  const list=$('sqfQuoteCompareList');if(!list||role!=='cliente')return;
  const button=$('sqfCompareRefresh');if(button)button.disabled=true;
  tell('sqfCompareCount','Consultando propostas privadas desta conta...');
  try{
   const {data,error}=await client.from('sqf_service_requests')
    .select('id,provider_id,description,quote_cents,quote_terms,status,created_at')
    .eq('client_id',user.id).not('quote_cents','is',null)
    .order('created_at',{ascending:false}).limit(60);
   if(error)throw error;
   compareCache=Array.isArray(data)?data:[];
   const ids=[...new Set(compareCache.map(x=>x.provider_id).filter(validId))];
   compareNames=new Map();
   if(ids.length){
    // Nome é opcional; falha do lookup não esconde orçamento legítimo do cliente.
    const {data:profiles,error:pe}=await client.from('profiles')
     .select('id,full_name').in('id',ids);
    if(!pe)compareNames=new Map((profiles||[]).map(x=>[x.id,x.full_name]));
   }
   renderComparedQuotes();
  }catch{
   compareCache=[];compareNames=new Map();
   missing(list,'Não foi possível consultar seus orçamentos. Confira a sessão e tente novamente.');
   tell('sqfCompareCount','A consulta falhou. Nenhum valor foi estimado.',true);
  }finally{if(button)button.disabled=false;}
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
  $('sqfCompareRefresh')?.addEventListener('click',()=>void compareQuotes());
  for(const id of ['sqfCompareSearch','sqfCompareStatus','sqfCompareOrder']){
    $(id)?.addEventListener(id==='sqfCompareSearch'?'input':'change',renderComparedQuotes);
  }
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
