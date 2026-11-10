'use strict';
/* Portal compartilhado entre cliente e prestador. A permissão pertence ao banco (RLS). */
(async()=>{
 const $=id=>document.getElementById(id);
 const panel=$('sqfRequestPortal');if(!panel)return;
 const requestedId=window.SQFUtils.requestIdFromSearch(location.search);
 let linkedRequest=null;
 const create=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const stateNames={requested:'Aguardando prestador',quoted:'Orçamento disponível',accepted:'Orçamento aceito',in_progress:'Em atendimento',awaiting_confirmation:'Aguardando confirmação do cliente',completed:'Atendimento confirmado',declined:'Recusada',canceled:'Cancelada'};
 const currency=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
 const dateLabel=value=>value && Number.isFinite(Date.parse(value))
   ?new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(value)):'Não informado';
 const say=(text,bad=false)=>{const el=$('sqfRequestStatus');el.textContent=text;el.dataset.error=String(bad);};
 let client,user,role,requests=[],selected=null,unread=null,totals=null,selectionSequence=0;
 function button(label,onClick,variant='button-outline'){
   const n=create('button','button '+variant+' button-small',label);n.type='button';
   n.addEventListener('click',async()=>{n.disabled=true;try{await onClick();}
     catch(error){say(error?.message||'Não foi possível concluir. Tente atualizar as solicitações.',true);}
     finally{n.disabled=false;}});return n;
 }
 async function loadUnread(){
   // Migração 10 é opcional até ser aplicada: não exiba contagens inventadas se a RPC não existir.
   try {
     const {data,error}=await client.rpc('sqf_request_unread_counts');
     if(error||!Array.isArray(data)){unread=null;return;}
     unread=new Map(data.map(row=>[row.request_id,Math.max(0,Number(row.unread_count)||0)]));
   } catch { unread=null; }
 }
 async function loadTotals(){
   totals=null;
   try {
     const {data,error}=await client.rpc('sqf_dashboard_request_summary');
     if(!error && Array.isArray(data))totals=data[0]||null;
   } catch { /* A lista continua disponível durante uma atualização do backend. */ }
 }
 function renderSummary(){
   const el=$('sqfRequestSummary');if(!el)return;el.replaceChildren();
   const quoteLabel=role==='cliente'?'Orçamentos para analisar':'Orçamentos enviados';
   const items=totals?[
     ['Em aberto',totals.active_count],
     [quoteLabel,totals.quote_count],
     ['Em atendimento',totals.ongoing_count],
     ['Concluídas',totals.completed_count]
   ]:[];
   const unreadTotal=unread?Array.from(unread.values()).reduce((a,b)=>a+b,0):null;
   if(unread)items.push(['Mensagens não lidas',unreadTotal]);
   if(role==='prestador'){
     const stats={
       providerRequestsOpen:totals?.active_count,
       providerQuotesSent:totals?.quote_count,
       providerRequestsOngoing:totals?.ongoing_count,
       providerUnreadMessages:unreadTotal
     };
     for(const [id,value] of Object.entries(stats)){
       const node=$(id);
       if(node)node.textContent=Number.isFinite(Number(value))&&value!==null&&value!==undefined?String(value):'—';
     }
   }
   if(!totals)el.append(create('p','muted','O resumo geral está temporariamente indisponível.'));
   for(const [label,count] of items){
     const block=create('div','sqf-request-stat');block.append(create('strong','',count),create('span','',label));el.append(block);
   }
 }
 async function load(){
   say('Atualizando solicitações...');
   const refresh=$('sqfRequestRefresh');
   refresh.disabled=true;
   try{
   const fields='id,client_id,provider_id,service_id,city_ibge,description,desired_date,status,quote_cents,quote_terms,created_at,completed_at';
   const {data,error}=await client.from('sqf_service_requests').select(fields).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(40);
   if(error)throw error;
   const recent=data||[];
   const linkedId=selected||requestedId;
   linkedRequest=null;
   let linkedLookupFailed=false;
   if(linkedId && !recent.some(item=>item.id===linkedId)){
     try{
       const {data:linked,error:linkedError}=await client.from('sqf_service_requests').select(fields).eq('id',linkedId).maybeSingle();
       linkedLookupFailed=Boolean(linkedError);
       if(!linkedLookupFailed)linkedRequest=linked;
     }catch{linkedLookupFailed=true;}
   }
   requests=recent;
   const visible=linkedId && (linkedRequest?.id===linkedId || recent.some(item=>item.id===linkedId));
   await Promise.all([loadUnread(),loadTotals()]);renderSummary();
   if(visible){
     await show(linkedId);
     say('Solicitações atualizadas. Mensagens e anexos são acessíveis somente aos participantes.');
     return;
   }
   selected=linkedLookupFailed ? linkedId : null;
   selectionSequence++;
   drawList();
   const detail=$('sqfRequestDetail');
   if(linkedId){
     const message=linkedLookupFailed
       ? 'Não foi possível abrir a solicitação. Use Atualizar para tentar novamente.'
       : 'Solicitação indisponível para esta conta.';
     detail.replaceChildren(create('p','muted',message));
     say(message,true);
     return;
   }
   detail.replaceChildren(create('p','muted',requests.length
     ?'Selecione uma solicitação para acompanhar o orçamento, as mensagens e o histórico.'
     :'Ainda não há solicitações nesta conta.'));
   say('Solicitações atualizadas. Mensagens e anexos são acessíveis somente aos participantes.');
   }finally{refresh.disabled=false;}
 }
 function matches(item,filter){
   return filter==='all'||(filter==='unread'&&(unread?.get(item.id)||0)>0)||(filter==='open'&&!['completed','declined','canceled'].includes(item.status))||
     (filter==='quoted'&&item.status==='quoted')||
     (filter==='active'&&['accepted','in_progress','awaiting_confirmation'].includes(item.status))||
     (filter==='completed'&&item.status==='completed')||
     (filter==='closed'&&['declined','canceled'].includes(item.status));
 }
 function drawList(){
   const control=$('sqfRequestFilter');
   const unreadOption=control.querySelector('option[value="unread"]');
   if(unreadOption)unreadOption.disabled=!unread;
   if(!unread&&control.value==='unread')control.value='all';
   document.querySelectorAll('[data-request-filter]').forEach(button=>{
     button.setAttribute('aria-pressed',String(button.dataset.requestFilter===control.value));
     if(button.dataset.requestFilter==='unread')button.disabled=!unread;
   });
   const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
   const term=normalize(($('sqfRequestSearch')?.value||'').trim());
   const view=requests.filter(item=>matches(item,control.value)&&normalize(String(item.description||'')).includes(term));
   $('sqfRequestCount').textContent=`${view.length} de ${requests.length} solicitações recentes exibidas (até 40)`;
   const list=$('sqfRequestList');list.replaceChildren();
   if(!view.length){list.append(create('p','muted',requests.length?'Nenhuma solicitação neste filtro.':'Ainda não há solicitações. Explore os perfis para pedir orçamento.'));return;}
   for(const item of view){
     const card=button(`${stateNames[item.status]||item.status} · ${dateLabel(item.created_at)}`,()=>show(item.id));
     card.classList.add('sqf-request-list-item');card.setAttribute('aria-pressed',String(item.id===selected));
     card.append(create('span','sqf-request-snippet',item.description.slice(0,85)));
     const count=unread?.get(item.id)||0;
     if(count>0)card.append(create('span','sqf-unread-badge',`${count} ${count===1?'mensagem não lida':'mensagens não lidas'}`));
     list.append(card);
   }
 }
 async function mutate(rpc,args,msg){
   say('Registrando alteração no servidor...');
   const {error}=await client.rpc(rpc,args);
   if(error){say(error.message||'Não foi possível concluir. Confira suas permissões.',true);return false;}
   say(msg);await load();return true;
 }
 async function show(id){
   selected=id;const current=++selectionSequence;drawList();
   const item=requests.find(x=>x.id===id)||(linkedRequest?.id===id?linkedRequest:null);if(!item)return;
   const target=$('sqfRequestDetail');target.replaceChildren();
   const head=create('div','sqf-request-head');head.append(create('h3','',stateNames[item.status]||'Solicitação'));
   head.append(create('span','muted','Criada em '+dateLabel(item.created_at)));target.append(head);
   target.append(create('p','',item.description));
   if(item.desired_date)target.append(create('p','muted','Data desejada: '+item.desired_date.split('-').reverse().join('/')));
   if(item.quote_cents!=null){
     const quote=create('div','sqf-quote-summary');quote.append(create('strong','',currency(item.quote_cents)));
     quote.append(create('p','muted',item.quote_terms||'Condições não informadas.'));
     quote.append(create('small','', 'Orçamento informativo. Não há pagamento pelo sistema de solicitações.'));
     target.append(quote);
   }
   const actions=create('div','sqf-request-actions');
   const act=(label,action,confirmText)=>actions.append(button(label,async()=>{
     if(confirmText&&!confirm(confirmText))return;
     await mutate('sqf_request_action',{p_request:id,p_action:action},'Situação atualizada com sucesso.');
   }));
   if(role==='prestador'){
     if(['requested','quoted'].includes(item.status)){
       const form=create('form','sqf-quote-editor');
       const amountLabel=create('label','', 'Valor proposto (R$)');
       const amount=create('input');amount.type='number';amount.min='1';amount.max='1000000';amount.step='0.01';amount.required=true;
       if(item.quote_cents)amount.value=(item.quote_cents/100).toFixed(2);
       amountLabel.append(amount);
       const termsLabel=create('label','','Condições e escopo (10–1500 caracteres)');
       const terms=create('textarea');terms.minLength=10;terms.maxLength=1500;terms.required=true;terms.rows=3;terms.value=item.quote_terms||'';
       termsLabel.append(terms);
       const submit=create('button','button button-primary button-small','Enviar orçamento');submit.type='submit';
       form.append(amountLabel,termsLabel,submit);
       form.addEventListener('submit',async e=>{e.preventDefault();const amountCents=Math.round(Number(amount.value)*100);
         if(!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>100000000||terms.value.trim().length<10){say('Valor ou condições inválidos.',true);return;}
         submit.disabled=true;try{await mutate('sqf_send_quote',{p_request:id,p_amount_cents:amountCents,p_terms:terms.value.trim()},'Orçamento enviado ao cliente.');}finally{submit.disabled=false;}
       });target.append(form);act('Recusar solicitação','decline','Deseja recusar esta solicitação?');
     }
     if(item.status==='accepted')act('Iniciar serviço','start','Confirmar início do atendimento?');
     if(item.status==='in_progress')act('Marcar como realizado','finish','O serviço foi realmente executado? O cliente ainda precisará confirmar.');
   }else{
     if(item.status==='quoted')act('Aceitar orçamento','accept','Confirmar que aceita as condições deste orçamento?');
     if(['requested','quoted','accepted'].includes(item.status))act('Cancelar solicitação','cancel','Deseja cancelar esta solicitação?');
     if(item.status==='awaiting_confirmation')act('Confirmar que o serviço foi realizado','confirm','Confirma que o atendimento foi realizado? Uma avaliação poderá ser enviada pelos mecanismos existentes.');
   }
   if(actions.childElementCount)target.append(actions);
   await window.SQFAgenda?.render({
     client,user,request:item,root:target,
     stillCurrent:()=>current===selectionSequence,
     onSaved:()=>show(item.id)
   });
   if(current!==selectionSequence)return;
   // Mensagens privadas. Remetente e limites são validados no servidor.
   const messageSection=create('section','sqf-messages');
   const messageHeader=create('div','sqf-card-head');
   const messageTitle=create('div');
   messageTitle.append(create('h4','','Conversa privada'),create('p','muted','Somente os participantes podem consultar as mensagens.'));
   messageHeader.append(messageTitle,button('Atualizar conversa',()=>show(id)));
   messageSection.append(messageHeader);
   const thread=create('div','sqf-messages-thread');thread.append(create('p','muted','Carregando conversa...'));messageSection.append(thread);
   const messageForm=create('form','sqf-message-form');
   const msgLabel=create('label','','Nova mensagem (até 2000 caracteres)');
   const msg=create('textarea');msg.required=true;msg.minLength=2;msg.maxLength=2000;msg.rows=3;
   msg.placeholder='Escreva somente sobre o serviço. Nunca compartilhe senhas, documentos, dados bancários ou contatos pessoais.';
   msgLabel.append(msg);const submitMsg=create('button','button button-primary button-small','Enviar mensagem');submitMsg.type='submit';
   msg.addEventListener('keydown',e=>{
     if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();messageForm.requestSubmit();}
   });
   messageForm.append(msgLabel,submitMsg);
   if(['completed','declined','canceled'].includes(item.status))messageForm.hidden=true;
   messageForm.addEventListener('submit',async e=>{e.preventDefault();submitMsg.disabled=true;
     try{const result=await client.from('sqf_request_messages').insert({request_id:id,sender_id:user.id,body:msg.value.trim()});
       if(result.error)throw result.error;msg.value='';await show(id);say('Mensagem enviada privadamente.');
     }catch(error){say(error.message||'Mensagem não enviada.',true);}finally{submitMsg.disabled=false;}
   });
   messageSection.append(messageForm);target.append(messageSection);
   const [messages,attachments,events]=await Promise.all([
     client.from('sqf_request_messages').select('id,sender_id,body,created_at').eq('request_id',id).order('created_at',{ascending:true}).limit(80),
     client.from('sqf_request_attachments').select('id,storage_path,caption').eq('request_id',id).limit(20),
     client.from('sqf_request_events').select('id,actor_id,action,from_status,to_status,amount_cents,created_at').eq('request_id',id).order('created_at',{ascending:true}).limit(60)
   ]);
   if(current!==selectionSequence)return; // A pessoa pode ter aberto outra solicitação enquanto a consulta carregava.
   thread.replaceChildren();
   if(messages.error)thread.append(create('p','muted','As mensagens não estão disponíveis. Verifique a migração e as permissões.'));
   else if(!messages.data?.length)thread.append(create('p','muted','Nenhuma mensagem registrada.'));
   else for(const row of messages.data){
     const mine=row.sender_id===user.id;const bubble=create('article',mine?'sqf-message mine':'sqf-message');
     bubble.append(create('small','',`${mine?'Você':role==='cliente'?'Prestador':'Cliente'} · ${dateLabel(row.created_at)}`));
     bubble.append(create('p','',row.body));thread.append(bubble);
   }
   if(messages.data?.length)thread.scrollTop=thread.scrollHeight;
   if(!events.error && events.data?.length){
     const timeline=create('details','sqf-request-timeline');
     timeline.append(create('summary','','Histórico de alterações e orçamentos'));
     const list=create('ol');
     const eventNames={create:'Solicitação criada',quote:'Orçamento enviado',accept:'Orçamento aceito',cancel:'Solicitação cancelada',decline:'Solicitação recusada',start:'Atendimento iniciado',finish:'Prestador marcou execução',confirm:'Cliente confirmou realização'};
     for(const change of events.data){
       const li=create('li','',`${eventNames[change.action]||'Atualização registrada'} · ${dateLabel(change.created_at)}`);
       if(change.action==='quote'&&Number.isInteger(change.amount_cents))li.append(create('small','',` · ${currency(change.amount_cents)}`));
       list.append(li);
     }
     timeline.append(list);target.append(timeline);
   }
   if(!attachments.error&&attachments.data?.length){
     const media=create('div','sqf-private-photos');media.append(create('h4','','Fotos privadas do atendimento'));
     for(const row of attachments.data){
       const link=await window.SQFRequestMedia.signed(client,row.storage_path);
       if(current!==selectionSequence)return;
       if(!link)continue;
       const a=create('a','sqf-photo-link');a.href=link;a.target='_blank';a.rel='noopener noreferrer';
       const image=create('img');image.src=link;image.alt=row.caption||'Fotografia anexada à solicitação';image.loading='lazy';
       a.append(image);media.append(a);
     }
     target.append(media);
   }
   // Confirmar leitura somente depois de carregar as mensagens e nunca por outra conta.
   if(!messages.error && current===selectionSequence){
     try {
       const {error}=await client.rpc('sqf_mark_request_read',{p_request:id});
       if(!error){await loadUnread();if(current===selectionSequence){renderSummary();drawList();}}
     } catch { /* migração 10 ainda não aplicada: a conversa continua visível */ }
   }
 }
 try{
   client=window.getSQFClient();
   const result=await client.auth.getUser();user=result.data?.user;
   if(!user)return;
   const {data:profile,error}=await client.from('profiles').select('account_type').eq('id',user.id).maybeSingle();
   if(error||!['cliente','prestador'].includes(profile?.account_type)){
     panel.hidden=false;
     const marker=$('sqfRequestStatus');
     if(marker){
       marker.textContent='Não foi possível verificar o tipo da sua conta. Recarregue a página para tentar novamente.';
       marker.dataset.error='true';
     }
     $('sqfRequestSummary')?.replaceChildren();
     $('sqfRequestList')?.replaceChildren();
     $('sqfRequestDetail')?.replaceChildren();
     const controls=$('sqfRequestFilter');if(controls)controls.disabled=true;
     const refresh=$('sqfRequestRefresh');if(refresh)refresh.disabled=true;
     if(location.hash==='#sqfRequestPortal')requestAnimationFrame(()=>panel.scrollIntoView({block:'start'}));
     return;
   }
   role=profile.account_type;panel.hidden=false;
   $('sqfRequestsIntro').textContent=role==='cliente'
     ? 'Acompanhe suas solicitações, orçamentos e mensagens privadas com os prestadores.'
     : 'Responda solicitações, envie orçamentos e acompanhe atendimentos até a confirmação pelo cliente.';
   $('sqfRequestFilter').addEventListener('change',drawList);
   document.querySelectorAll('[data-request-filter]').forEach(button=>{
     button.addEventListener('click',()=>{
       const control=$('sqfRequestFilter');
       if(![...control.options].some(o=>o.value===button.dataset.requestFilter))return;
       control.value=button.dataset.requestFilter;
       drawList();
     });
   });
   $('sqfRequestSearch')?.addEventListener('input',drawList);
   $('sqfRequestRefresh').addEventListener('click',()=>load().catch(e=>say(e.message,true)));
   await load();
   if(location.hash==='#sqfRequestPortal')requestAnimationFrame(()=>panel.scrollIntoView({block:'start'}));

 }catch(error){panel.hidden=false;say('Não foi possível carregar as solicitações. Confira a conexão e tente atualizar.',true);}
})();
