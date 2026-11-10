'use strict';
(async()=>{
 const api=window.SQFMySQL,status=document.getElementById('staffStatus'),form=document.getElementById('staffMfa'),queue=document.getElementById('staffQueue');
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 async function load(){
   const result=await api.staffReviews();queue.replaceChildren();
   if(!result.data.length)queue.append(el('p','Nenhuma avaliação pendente.'));
   for(const r of result.data){
     const card=el('article');card.className='card';card.append(el('h2','Avaliação '+r.rating+'/5'),el('p',r.comment));
     const decision=el('form'),note=el('textarea'),select=el('select');note.required=true;note.minLength=20;note.maxLength=1000;note.placeholder='Justifique a decisão (mínimo 20 caracteres)';
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
       note.required=true;note.minLength=20;note.maxLength=1000;note.placeholder='Justificativa da decisão';
       const submit=el('button','Registrar decisão');submit.className='button button-primary';submit.type='submit';
       decision.append(select,note,submit);card.append(decision);queue.append(card);
       decision.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{
         if(!window.confirm('Registrar a decisão deste caso?'))return;
         await api.staffReviewCaseDecide({type,id:type==='response'?item.review_id:item.id,status:select.value,note:note.value});await load();
       }catch(e){status.textContent=e.message;}finally{submit.disabled=false;}});
     }
   }
   form.hidden=true;status.textContent='Fila de avaliações carregada.';
 }
 form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{await api.staffMfa(form.elements.code.value);form.reset();await load();}catch(e){status.textContent=e.message;}finally{submit.disabled=false;}});
 try{
   if(window.SQFDataMode!=='mysql')throw new Error('Ambiente MySQL não ativado.');
   if(!(await api.session()).user_id){location.replace('entrar.html');return;}
   try{await load();}catch(e){if(e.message!=='MFA administrativo obrigatório')throw e;form.hidden=false;status.textContent='Confirme a autenticação de dois fatores.';}
 }catch(e){status.textContent=e.message||'Acesso indisponível';}
})();
