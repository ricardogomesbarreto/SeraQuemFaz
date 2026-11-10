'use strict';
(async()=>{
 const $=id=>document.getElementById(id),api=window.SQFMySQL;
 const status=(s)=>{$('mysqlStatus').textContent=s;};
 const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
 const button=(text,fn)=>{const n=el('button',text);n.type='button';n.className='button button-outline button-small';n.addEventListener('click',async()=>{n.disabled=true;try{await fn();}catch(e){status(e.message||'Operação indisponível');}finally{n.disabled=false;}});return n;};
 const wrap=(title)=>{const d=el('article');d.className='card';d.append(el('h3',title));return d;};
 const empty=(root,items,msg)=>{root.replaceChildren();if(!items.length)root.append(el('p',msg));};
 let user,profile;
 const load=async()=>{
   const [p,q,a,n]=await Promise.all([api.profile(),api.requests(),api.appointments(),api.notifications()]);
   profile=p.data;if(!profile)throw new Error('Perfil indisponível');
   $('mysqlTitle').textContent=(profile.account_type==='prestador'?'Painel do prestador — ':'Painel do cliente — ')+profile.full_name;
   const form=$('mysqlProfile');form.elements.full_name.value=profile.full_name;form.elements.bio.value=profile.bio||'';form.elements.city_ibge.value=profile.city_ibge||'';
   const list=$('mysqlRequests');empty(list,q.data,'Nenhuma solicitação registrada.');
   for(const r of q.data){const card=wrap(r.description);card.append(el('p','Situação: '+r.status));if(r.quote_cents!==null)card.append(el('p',new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(r.quote_cents)/100)+' — '+(r.quote_terms||'')));
     const provider=r.provider_id===user;
     if(provider&&['requested','quoted'].includes(r.status)){const price=el('input');price.type='number';price.min='100';price.max='100000000';price.placeholder='Valor em centavos';const terms=el('textarea');terms.placeholder='Condições do orçamento';card.append(price,terms,button('Enviar orçamento',async()=>{await api.quote({request_id:r.id,amount_cents:Number(price.value),terms:terms.value});await load();}));}
     const actions=provider?{requested:['decline'],quoted:['decline'],accepted:['start'],in_progress:['finish']}:{requested:['cancel'],quoted:['accept','cancel'],accepted:['cancel'],awaiting_confirmation:['confirm']};
     const names={accept:'Aceitar',decline:'Recusar',cancel:'Cancelar',start:'Iniciar',finish:'Finalizar',confirm:'Confirmar conclusão'};
     for(const action of actions[r.status]||[])card.append(button(names[action],async()=>{await api.requestAction({request_id:r.id,action});await load();}));
     const messages=el('div');card.append(button('Abrir conversa',async()=>{const result=await api.messages(r.id);messages.replaceChildren();for(const m of result.data.slice().reverse())messages.append(el('p',(m.sender_id===user?'Você: ':'Outra parte: ')+m.body));}),messages);
     if(['requested','quoted','accepted','in_progress','awaiting_confirmation'].includes(r.status)){const input=el('textarea');input.placeholder='Mensagem privada';input.maxLength=2000;card.append(input,button('Enviar mensagem',async()=>{await api.sendMessage({request_id:r.id,body:input.value});input.value='';status('Mensagem enviada.');}));}
     if(['accepted','in_progress','awaiting_confirmation'].includes(r.status)){const dt=el('input');dt.type='datetime-local';const dur=el('input');dur.type='number';dur.min='30';dur.max='480';dur.value='60';card.append(dt,dur,button('Propor horário',async()=>{if(!dt.value)throw new Error('Informe a data');await api.appointment({request_id:r.id,action:'propose',starts_at:new Date(dt.value).toISOString(),duration_minutes:Number(dur.value)});await load();}));}
     list.append(card);
   }
   const agenda=$('mysqlAppointments');empty(agenda,a.data,'Nenhum agendamento.');
   for(const x of a.data){const card=wrap(x.status);card.append(el('p',x.starts_at+' UTC — '+x.duration_minutes+' min'));if(x.pending_starts_at)card.append(el('p','Proposta de reagendamento: '+x.pending_starts_at+' UTC. Reserva original preservada.'));
     if((x.status==='proposed'&&x.proposed_by!==user)||(x.pending_starts_at&&x.pending_proposed_by!==user))for(const action of ['confirm','decline'])card.append(button(action==='confirm'?'Confirmar horário':'Recusar proposta',async()=>{await api.appointment({request_id:x.request_id,action});await load();}));
     if(['proposed','confirmed'].includes(x.status))card.append(button('Cancelar horário',async()=>{await api.appointment({request_id:x.request_id,action:'cancel'});await load();}));agenda.append(card);
   }
   const notes=$('mysqlNotifications');empty(notes,n.data,'Nenhuma notificação.');for(const item of n.data){const c=wrap(item.title);c.append(el('p',item.body));notes.append(c);}
   const serviceSection=$('mysqlServiceSection');
   serviceSection.hidden=profile.account_type!=='prestador';
   if(!serviceSection.hidden){
     const [categories,services]=await Promise.all([api.categories(),api.services()]);
     const select=$('mysqlServiceForm').elements.category_id;
     const previous=select.value;select.replaceChildren();
     for(const category of categories.data){const option=el('option',category.name);option.value=category.id;select.append(option);}
     if(categories.data.some(x=>x.id===previous))select.value=previous;
     const target=$('mysqlServices');empty(target,services.data,'Nenhum serviço cadastrado.');
     for(const service of services.data){
       const card=wrap(service.service_title);
       const active=Number(service.is_active)===1;
       card.append(el('p',(active?'Ativo':'Inativo')+' · '+(service.description||'Sem descrição')));
       card.append(button(active?'Desativar serviço':'Ativar serviço',async()=>{
         await api.toggleService({id:service.id,is_active:!active});
         await load();
       }));
       target.append(card);
     }
   }
   $('mysqlContent').hidden=false;status('Dados carregados.');
 };
 $('mysqlLogout').addEventListener('click',async()=>{try{await api.logout();location.replace('entrar.html');}catch(e){status(e.message);}});
 $('mysqlServiceForm').addEventListener('submit',async e=>{
   e.preventDefault();const form=e.currentTarget,fields=form.elements;
   const minimum=fields.price_min_cents.value,maximum=fields.price_max_cents.value;
   if((minimum==='')!==(maximum==='')){status('Informe os dois preços ou deixe ambos em branco.');return;}
   const request={category_id:fields.category_id.value,service_title:fields.service_title.value,
     description:fields.description.value,price_min_cents:minimum===''?null:Number(minimum),
     price_max_cents:maximum===''?null:Number(maximum)};
   const submit=form.querySelector('[type="submit"]');submit.disabled=true;
   try{await api.saveService(request);form.reset();await load();status('Serviço cadastrado.');}
   catch(error){status(error.message||'Falha ao cadastrar serviço.');}
   finally{submit.disabled=false;}
 });
 $('mysqlProfile').addEventListener('submit',async e=>{e.preventDefault();try{const f=new FormData(e.currentTarget);await api.updateProfile({full_name:f.get('full_name'),bio:f.get('bio'),city_ibge:f.get('city_ibge')||null});await load();status('Perfil atualizado.');}catch(e){status(e.message);}});
 try{if(window.SQFDataMode!=='mysql')throw new Error('Ative MySQL apenas no ambiente de homologação.');const s=await api.session();if(!s.user_id){location.replace('entrar.html');return;}user=s.user_id;await load();}catch(e){status(e.message||'Falha ao carregar painel.');}
})();
