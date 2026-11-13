'use strict';
(async()=>{
 const api=window.SQFMySQL,status=document.getElementById('staffStatus'),form=document.getElementById('staffMfa'),queue=document.getElementById('staffQueue');
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const navigation=document.getElementById('staffNavigation'),account=document.getElementById('staffAccount'),identity=document.getElementById('staffIdentity'),logout=document.getElementById('staffLogout');
 logout.addEventListener('click',async()=>{logout.disabled=true;try{await api.logout();showLogin();}catch(error){status.textContent=error.message;}finally{logout.disabled=false;}});
 function updateNavigation(){
   navigation.replaceChildren();
   const sections=queue.querySelectorAll('h2');
   const links=el('ul');
   for(const [index,heading] of Array.from(sections).entries()){
     if(heading.textContent.startsWith('Avaliação '))continue;
     heading.id='staff-section-'+index;
     const item=el('li'),link=el('a',heading.textContent);link.href='#'+heading.id;item.append(link);links.append(item);
   }
   navigation.append(links);navigation.hidden=false;
 }
 async function load(){
   navigation.hidden=true;
   let isAdmin=false;
   const result=await api.staffReviews();queue.replaceChildren();
   try{const m=(await api.staffMetrics()).data,card=el('article');isAdmin=true;card.className='card';card.append(el('h2','Indicadores da plataforma'));const labels={clients:'Clientes',providers:'Prestadores',published_providers:'Prestadores publicados',requests:'Solicitações',completed:'Atendimentos concluídos',pending_verifications:'Verificações pendentes'};for(const [k,label] of Object.entries(labels))card.append(el('p',label+': '+m[k]));const exportBtn=el('button','Baixar indicadores CSV');exportBtn.type='button';exportBtn.className='button button-outline';exportBtn.addEventListener('click',()=>{const csv='Indicador;Quantidade\n'+Object.entries(labels).map(([k,label])=>label+';'+Number(m[k])).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download='indicadores-sqf.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});card.append(exportBtn);queue.append(card);}catch(error){if(!/Somente administradores/.test(error.message))throw error; /* Moderators retain their authorized queues. */}
   queue.append(el('h2','Avaliações pendentes'));
   if(!result.data.length)queue.append(el('p','Nenhuma avaliação pendente.'));
   for(const r of result.data){
     const card=el('article');card.className='card';card.append(el('h2','Avaliação '+r.rating+'/5'),el('p',r.comment));
     const decision=el('form'),note=el('textarea'),select=el('select');note.required=true;note.minLength=20;note.maxLength=1000;note.placeholder='Justifique a decisão (mínimo 20 caracteres)';note.setAttribute('aria-label','Justificativa da moderação');select.setAttribute('aria-label','Decisão da avaliação');
     for(const [value,label] of [['published','Publicar'],['rejected','Rejeitar'],['hidden','Ocultar']]){const o=el('option',label);o.value=value;select.append(o);}
     const submit=el('button','Registrar decisão');submit.type='submit';submit.className='button button-primary';decision.append(select,note,submit);
     decision.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{
       if(!window.confirm('Registrar esta decisão de moderação?'))return;
       await api.staffReviewDecide({id:r.id,status:select.value,note:note.value});await load();status.textContent='Decisão registrada.';
     }catch(e){status.textContent=e.message;}finally{submit.disabled=false;}});
     card.append(decision);queue.append(card);
   }
   const cases=(await api.staffReviewCases()).data;
   for(const [type,items,states] of [
     ['response',cases.responses,[['published','Publicar'],['rejected','Rejeitar'],['hidden','Ocultar']]],
     ['dispute',cases.disputes,[['reviewing','Em análise'],['upheld','Aceitar contestação'],['dismissed','Recusar contestação']]]
   ]){
     queue.append(el('h2',type==='response'?'Respostas pendentes':'Contestações'));
     if(!items.length)queue.append(el('p','Nenhum caso pendente.'));
     for(const item of items){
       const card=el('article');card.className='card';
       card.append(el('p',item.message||item.details));
       const decision=el('form'),select=el('select'),note=el('textarea');
       for(const [value,label] of states){const option=el('option',label);option.value=value;select.append(option);}
       note.required=true;note.minLength=20;note.maxLength=1000;note.placeholder='Justificativa da decisão';note.setAttribute('aria-label','Justificativa do caso');select.setAttribute('aria-label','Decisão do caso');
       const submit=el('button','Registrar decisão');submit.className='button button-primary';submit.type='submit';
       decision.append(select,note,submit);card.append(decision);queue.append(card);
       decision.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{
         if(!window.confirm('Registrar a decisão deste caso?'))return;
         await api.staffReviewCaseDecide({type,id:type==='response'?item.review_id:item.id,status:select.value,note:note.value});await load();
       }catch(e){status.textContent=e.message;}finally{submit.disabled=false;}});
     }
   }
   const documents=(await api.staffDocuments()).data;
   queue.append(el('h2','Documentos de verificação pendentes'));
   if(!documents.length)queue.append(el('p','Nenhum documento aguardando análise.'));
   for(const item of documents){
     const card=el('article');card.className='card';
     card.append(el('h3',item.document_kind==='identity_evidence'?'Identificação':'Comprovação profissional'));
     const link=el('a','Visualizar documento privado');link.href=api.mediaUrl('verification',item.id);link.target='_blank';link.rel='noopener noreferrer';card.append(link);
     const decision=el('form'),select=el('select'),note=el('textarea');
     for(const [value,label] of [['accepted','Aceitar documento'],['rejected','Rejeitar documento']]){
       const option=el('option',label);option.value=value;select.append(option);
     }
     note.required=true;note.minLength=20;note.maxLength=1000;note.placeholder='Justificativa da análise documental (mínimo 20 caracteres)';note.setAttribute('aria-label','Justificativa documental');select.setAttribute('aria-label','Decisão documental');
     const submit=el('button','Registrar análise');submit.type='submit';submit.className='button button-primary';decision.append(select,note,submit);card.append(decision);queue.append(card);
     decision.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{
       if(!window.confirm('Registrar a decisão documental? Esta ação não aprova automaticamente o prestador.'))return;
       await api.staffDocumentDecide({id:item.id,status:select.value,note:note.value});await load();status.textContent='Análise de documento registrada sem aprovação automática.';
     }catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
   }
   queue.append(el('h2','Verificação de prestadores'));
   for(const item of (await api.staffProviders()).data){
     const card=el('article');card.className='card';card.append(el('h3',item.full_name),el('p',item.city+' · '+item.status+' · Identidade aceita: '+Number(item.accepted_identity)));
     const ready=[];
     if(!Number(item.email_confirmed))ready.push('e-mail não confirmado');
     if(!item.city_ibge)ready.push('município não informado');
     if(!Number(item.accepted_identity))ready.push('identificação ainda não aceita');
     if(!Number(item.active_services))ready.push('nenhum serviço ativo');
     if(ready.length)card.append(el('p','Pendências de publicação: '+ready.join(' · ')));
     else if(item.status!=='approved')card.append(el('p','Documentação e serviços prontos; resta decisão administrativa fundamentada.'));
     const decision=el('form'),select=el('select'),note=el('textarea');note.required=true;note.minLength=20;note.maxLength=1000;
     for(const [value,label] of [['approved','Aprovar'],['rejected','Rejeitar'],['suspended','Suspender']]){const o=el('option',label);o.value=value;select.append(o);}
     const submit=el('button','Registrar decisão');submit.type='submit';submit.className='button button-primary';decision.append(select,note,submit);card.append(decision);queue.append(card);
     decision.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{if(!confirm('Confirmar decisão cadastral?'))return;await api.staffProviderDecide({id:item.id,status:select.value,note:note.value});await load();}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
   }
   try{
     const billing=(await api.staffBilling()).data;
     queue.append(el('h2','Resumo financeiro'),el('p','Prestadores com período pago vigente: '+billing.active_paid),el('p','Checkout indisponível na homologação.'));
     for(const i of billing.invoices)queue.append(el('p',i.status+' · '+i.total+' faturas · '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(i.cents)/100)));
     const cases=(await api.staffCases()).data;
     for(const [kind,items] of [['privacy',cases.privacy],['support',cases.support]]){
       queue.append(el('h2',kind==='privacy'?'Solicitações de privacidade':'Chamados de suporte'));
       for(const item of items){const card=el('article');card.className='card';card.append(el('h3',item.request_type||item.topic),el('p',item.details||item.message),el('p','Situação: '+item.status));
         const decision=el('form'),select=el('select'),note=el('textarea');note.required=true;note.minLength=20;note.maxLength=1000;
         for(const [value,label] of [['reviewing','Em análise'],['resolved','Resolver']]){const o=el('option',label);o.value=value;select.append(o);}
         const submit=el('button','Registrar decisão');submit.type='submit';submit.className='button button-primary';decision.append(select,note,submit);card.append(decision);queue.append(card);
         decision.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{if(!confirm('Confirma a atualização? Resolver não executa exclusão ou exportação de dados.'))return;await api.staffCaseDecide({kind,id:item.id,status:select.value,note:note.value});await load();}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
       }
     }
   }catch(error){if(!/Somente administradores/.test(error.message))throw error;}
   if(isAdmin&&window.SQFAdminCatalog)queue.append(await window.SQFAdminCatalog.panel(api));
   if(isAdmin&&window.SQFAdminMail)queue.append(await window.SQFAdminMail.panel(api));
   identity.textContent=isAdmin?'Administrador':'Moderador';account.hidden=false;
   updateNavigation();form.hidden=true;status.textContent='Fila de moderação carregada.';enterWorkspace();
 }
 const loginSection=document.getElementById('staffLoginSection');
 const loginForm=document.getElementById('staffLoginForm');
 const denied=document.getElementById('staffDenied');
 const switchAccount=document.getElementById('staffSwitchAccount');
 const authLayout=document.getElementById('staffAuthLayout');
 const workspace=document.getElementById('staffWorkspace');
 const authSlot=document.getElementById('staffAuthStatusSlot');
 const workspaceSlot=document.getElementById('staffWorkspaceStatusSlot');
 const enterAuth=()=>{
   workspace.hidden=true;authLayout.hidden=false;authSlot.append(status);
 };
 const enterWorkspace=()=>{
   authLayout.hidden=true;workspace.hidden=false;workspaceSlot.append(status);
 };
 const passwordReveal=document.getElementById('staffShowPassword');
 passwordReveal?.addEventListener('click',()=>{
   const field=document.getElementById('staffLoginPassword');
   const visible=field.type==='password';
   field.type=visible?'text':'password';
   passwordReveal.textContent=visible?'Ocultar':'Mostrar';
   passwordReveal.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');
   passwordReveal.setAttribute('aria-pressed',String(visible));
 });
 const showLogin=()=>{
   enterAuth();
   queue.replaceChildren();queue.hidden=true;navigation.hidden=true;account.hidden=true;
   form.hidden=true;denied.hidden=true;loginSection.hidden=false;
   status.textContent='Informe as credenciais da conta administrativa.';
 };
 const showDenied=()=>{
   enterAuth();
   queue.replaceChildren();queue.hidden=true;navigation.hidden=true;account.hidden=true;
   form.hidden=true;loginSection.hidden=true;denied.hidden=false;
   status.textContent='A conta conectada não possui privilégios administrativos.';
 };
 const begin=async()=>{
   enterAuth();
   queue.hidden=false;loginSection.hidden=true;denied.hidden=true;form.hidden=true;
   try{await load();}
   catch(error){
     if(error.message==='MFA administrativo obrigatório'){
       queue.replaceChildren();queue.hidden=true;navigation.hidden=true;
       form.hidden=false;status.textContent='Informe o código de 6 dígitos do seu aplicativo autenticador.';
       form.elements.code.focus();
     }else if(error.message==='Acesso administrativo negado'){
       showDenied();
     }else{
       queue.replaceChildren();queue.hidden=true;
       status.textContent=error.message||'Não foi possível verificar o acesso administrativo.';
     }
   }
 };
 loginForm?.addEventListener('submit',async event=>{
   event.preventDefault();
   const button=loginForm.querySelector('button[type="submit"]');button.disabled=true;
   status.textContent='Autenticando com segurança...';
   try{
     await api.login(loginForm.elements.email.value.trim(),loginForm.elements.password.value);
     loginForm.elements.password.value='';
     await begin();
   }catch(e){status.textContent=e.message||'Não foi possível entrar. Confira o e-mail e a senha.';}
   finally{button.disabled=false;}
 });
 switchAccount?.addEventListener('click',async()=>{
   switchAccount.disabled=true;
   try{await api.logout();showLogin();}
   catch(e){status.textContent=e.message||'Não foi possível encerrar a sessão.';}
   finally{switchAccount.disabled=false;}
 });
 form.addEventListener('submit',async event=>{
   event.preventDefault();const submit=form.querySelector('button');submit.disabled=true;
   try{await api.staffMfa(form.elements.code.value);form.reset();await begin();}
   catch(e){status.textContent=e.message||'Código inválido ou expirado.';}
   finally{submit.disabled=false;}
 });
 try{
   if(window.SQFDataMode!=='mysql')throw new Error('Ambiente MySQL não ativado.');
   if(!(await api.session()).user_id)showLogin();
   else await begin();
 }catch(e){status.textContent=e.message||'Acesso indisponível';}
})();
