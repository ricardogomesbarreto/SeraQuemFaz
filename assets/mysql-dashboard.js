'use strict';
(async()=>{
 const $=id=>document.getElementById(id),api=window.SQFMySQL;
 const status=(s)=>{$('mysqlStatus').textContent=s;};
 const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
 const button=(text,fn)=>{const n=el('button',text);n.type='button';n.className='button button-outline button-small';n.addEventListener('click',async()=>{n.disabled=true;try{await fn();}catch(e){status(e.message||'Operação indisponível');}finally{n.disabled=false;}});return n;};
 const wrap=(title)=>{const d=el('article');d.className='card';d.append(el('h3',title));return d;};
 const empty=(root,items,msg)=>{root.replaceChildren();if(!items.length)root.append(el('p',msg));};
 const image=(kind,id,alt)=>{const img=el('img');img.src=api.mediaUrl(kind,id);img.alt=alt;img.loading='lazy';img.style.maxWidth='100%';img.style.maxHeight='220px';img.style.objectFit='contain';return img;};
 let user,profile;
 const load=async()=>{
   const [p,q,a,n]=await Promise.all([api.profile(),api.requests(),api.appointments(),api.notifications()]);
   profile=p.data;if(!profile)throw new Error('Perfil indisponível');
   $('mysqlTitle').textContent=(profile.account_type==='prestador'?'Painel do prestador — ':'Painel do cliente — ')+profile.full_name;
   const avatar=$('mysqlAvatar');avatar.hidden=Number(profile.has_avatar)!==1;if(!avatar.hidden)avatar.src=api.mediaUrl('avatar',user)+'&v='+Date.now();
   const form=$('mysqlProfile');form.elements.full_name.value=profile.full_name;form.elements.bio.value=profile.bio||'';form.elements.city_ibge.value=profile.city_ibge||'';
   const list=$('mysqlRequests');empty(list,q.data,'Nenhuma solicitação registrada.');
   for(const r of q.data){const card=wrap(r.description);card.append(el('p','Situação: '+r.status));if(r.quote_cents!==null)card.append(el('p',new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(r.quote_cents)/100)+' — '+(r.quote_terms||'')));
     const provider=r.provider_id===user;
     if(provider&&['requested','quoted'].includes(r.status)){const price=el('input');price.type='number';price.min='100';price.max='100000000';price.placeholder='Valor em centavos';const terms=el('textarea');terms.placeholder='Condições do orçamento';card.append(price,terms,button('Enviar orçamento',async()=>{await api.quote({request_id:r.id,amount_cents:Number(price.value),terms:terms.value});await load();}));}
     const actions=provider?{requested:['decline'],quoted:['decline'],accepted:['start'],in_progress:['finish']}:{requested:['cancel'],quoted:['accept','cancel'],accepted:['cancel'],awaiting_confirmation:['confirm']};
     const names={accept:'Aceitar',decline:'Recusar',cancel:'Cancelar',start:'Iniciar',finish:'Finalizar',confirm:'Confirmar conclusão'};
     for(const action of actions[r.status]||[])card.append(button(names[action],async()=>{await api.requestAction({request_id:r.id,action});await load();}));
     if(!provider&&r.status==='completed'){
       const form=el('form'),rating=el('select'),comment=el('textarea');
       rating.setAttribute('aria-label','Nota da avaliação');
       for(let i=1;i<=5;i++){const option=el('option',i+' estrela(s)');option.value=String(i);rating.append(option);}
       comment.required=true;comment.minLength=15;comment.maxLength=1500;comment.placeholder='Conte como foi o atendimento';
       const submit=el('button','Enviar avaliação');submit.type='submit';submit.className='button button-primary';
       form.append(rating,comment,submit);
       form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{
         await api.createReview({request_id:r.id,rating:Number(rating.value),comment:comment.value});
         status('Avaliação enviada para moderação.');form.remove();
       }catch(error){status(error.message);}finally{submit.disabled=false;}});
       card.append(form);
     }
     const messages=el('div');card.append(button('Abrir conversa',async()=>{const result=await api.messages(r.id);messages.replaceChildren();for(const m of result.data.slice().reverse())messages.append(el('p',(m.sender_id===user?'Você: ':'Outra parte: ')+m.body));}),messages);
     const attachments=el('div');card.append(button('Ver anexos',async()=>{const result=await api.mediaList('attachment',r.id);empty(attachments,result.data,'Nenhum anexo.');for(const item of result.data){const box=el('figure');box.append(image('attachment',item.id,item.caption||'Anexo da solicitação'),el('figcaption',item.caption||'Imagem'));attachments.append(box);}}),attachments);
     if(['requested','quoted','accepted','in_progress','awaiting_confirmation'].includes(r.status)){
       const file=el('input');file.type='file';file.accept='image/webp,image/jpeg,image/png';file.setAttribute('aria-label','Imagem para anexar');
       card.append(file,button('Enviar anexo',async()=>{const selected=file.files?.[0];if(!selected||!['image/webp','image/jpeg','image/png'].includes(selected.type)||selected.size>5*1024*1024)throw new Error('Selecione WebP, JPEG ou PNG de até 5 MB.');await api.uploadMedia('attachment',r.id,selected);file.value='';status('Anexo enviado.');}));
     }
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
   const reviewRoot=$('mysqlReviews'), reviewData=await api.reviews();
   empty(reviewRoot,reviewData.data,'Nenhuma avaliação registrada.');
   for(const review of reviewData.data){
     const card=wrap(review.rating+'/5');card.append(el('p',review.comment),el('p','Situação: '+review.moderation_status));
     if(profile.account_type==='prestador'&&review.moderation_status==='published'){
       const response=el('textarea');response.placeholder='Resposta ao cliente (mínimo 20 caracteres)';response.maxLength=600;
       card.append(response,button('Enviar resposta',async()=>{await api.reviewResponse({id:review.id,message:response.value});status('Resposta enviada para moderação.');await load();}));
       const reason=el('select');for(const [value,label] of [['false_service','Serviço não realizado'],['inaccurate','Informação incorreta'],['harassment','Assédio'],['personal_data','Dados pessoais'],['other','Outro']]){const option=el('option',label);option.value=value;reason.append(option);}
       const details=el('textarea');details.placeholder='Justifique a contestação (mínimo 30 caracteres)';details.maxLength=1200;
       card.append(reason,details,button('Contestar avaliação',async()=>{await api.reviewDispute({id:review.id,reason:reason.value,details:details.value});status('Contestação enviada.');await load();}));
     }
     reviewRoot.append(card);
   }
   if(profile.account_type==='prestador'){
     const cases=(await api.reviewCases()).data;
     for(const item of cases.responses)reviewRoot.append(el('p','Resposta: '+item.moderation_status+' — '+item.message));
     for(const item of cases.disputes)reviewRoot.append(el('p','Contestação: '+item.status+' — '+item.details));
   }
   const favSection=$('mysqlFavoriteSection');favSection.hidden=profile.account_type!=='cliente';
   if(!favSection.hidden){const items=(await api.favoriteCategories()).data,root=$('mysqlFavorites');empty(root,items,'Nenhuma categoria favorita.');for(const item of items){const card=wrap(item.name);const link=el('a','Pesquisar categoria');link.href='categorias.html?q='+encodeURIComponent(item.name)+(profile.city_ibge?'&cidade='+encodeURIComponent(profile.city_ibge):'');card.append(link,button('Remover favorito',async()=>{await api.favoriteCategory({category_id:item.id,saved:false});await load();}));root.append(card);}}
   const discoverySection=$('mysqlDiscoverySection');
   discoverySection.hidden=profile.account_type!=='cliente';
   if(!discoverySection.hidden&&profile.city_ibge&&!$('mysqlDiscoveryForm').elements.city.value)$('mysqlDiscoveryForm').elements.city.value=profile.city_ibge;
   const docsSection=$('mysqlDocumentsSection');
   docsSection.hidden=profile.account_type!=='prestador';
   if(!docsSection.hidden){
     const result=await api.mediaList('verification');
     const target=$('mysqlDocuments');empty(target,result.data,'Nenhum documento enviado.');
     for(const document of result.data){
       const item=wrap((document.document_kind==='identity_evidence'?'Identificação':'Documento profissional')+' — '+document.status);
       const link=el('a','Visualizar documento');link.href=api.mediaUrl('verification',document.id);link.target='_blank';link.rel='noopener noreferrer';
       item.append(link);target.append(item);
     }
   }
   const professionalSection=$('mysqlProfessionalSection');professionalSection.hidden=profile.account_type!=='prestador';
   if(!professionalSection.hidden){const data=(await api.professional()).data,form=$('mysqlProfessionalForm');for(const key of ['professional_title','specialties','experience_years','service_mode','coverage_area','work_period','quote_policy','professional_website'])if(data[key]!=null)form.elements[key].value=data[key];const days=typeof data.workdays==='string'?JSON.parse(data.workdays):data.workdays||[];for(const input of form.querySelectorAll('[name=workdays]'))input.checked=days.includes(input.value);}
   const portfolioSection=$('mysqlPortfolioSection');portfolioSection.hidden=profile.account_type!=='prestador';
   const serviceSection=$('mysqlServiceSection');
   serviceSection.hidden=profile.account_type!=='prestador';
   if(!serviceSection.hidden){
     const [categories,services]=await Promise.all([api.categories(),api.services()]);
     const select=$('mysqlServiceForm').elements.category_id;
     const previous=select.value;select.replaceChildren();
     for(const category of categories.data){const option=el('option',category.name);option.value=category.id;select.append(option);}
     if(categories.data.some(x=>x.id===previous))select.value=previous;
     const portfolioSelect=$('mysqlPortfolioForm').elements.service_id;portfolioSelect.replaceChildren();
     for(const service of services.data){const option=el('option',service.service_title);option.value=service.id;portfolioSelect.append(option);}
     const portfolio=(await api.mediaList('portfolio')).data;const portfolioRoot=$('mysqlPortfolio');empty(portfolioRoot,portfolio,'Nenhuma foto no portfólio.');
     for(const item of portfolio){const box=el('figure');box.append(image('portfolio',item.id,item.caption||'Foto do portfólio'),el('figcaption',item.caption||'Trabalho realizado'));box.append(button(Number(item.is_cover)===1?'Capa atual':'Definir capa',async()=>{await api.managePortfolio({id:item.id,action:'cover'});await load();}),button('Excluir foto',async()=>{if(confirm('Excluir esta foto do portfólio?')){await api.managePortfolio({id:item.id,action:'delete'});await load();}}));portfolioRoot.append(box);}
     const target=$('mysqlServices');empty(target,services.data,'Nenhum serviço cadastrado.');
     for(const service of services.data){
       const card=wrap(service.service_title);
       const active=Number(service.is_active)===1;
       card.append(el('p',(active?'Ativo':'Inativo')+' · '+(service.description||'Sem descrição')));
       card.append(button('Editar serviço',async()=>{const f=$('mysqlServiceForm');for(const key of ['id','category_id','service_title','description','price_min_cents','price_max_cents'])f.elements[key].value=service[key]??'';f.querySelector('[type=submit]').textContent='Salvar alterações';$('mysqlServiceCancel').hidden=false;f.scrollIntoView({block:'start'});}),button(active?'Desativar serviço':'Ativar serviço',async()=>{
         await api.toggleService({id:service.id,is_active:!active});
         await load();
       }));
       target.append(card);
     }
   }
   $('mysqlContent').hidden=false;status('Dados carregados.');
 };
 $('mysqlLogout').addEventListener('click',async()=>{try{await api.logout();location.replace('entrar.html');}catch(e){status(e.message);}});
 $('mysqlDiscoveryForm').addEventListener('submit',async e=>{
   e.preventDefault();const form=e.currentTarget,city=String(form.elements.city.value).trim(),target=$('mysqlDiscoveryResults');
   target.replaceChildren(el('p','Buscando profissionais aprovados…'));
   try{
     const result=await api.catalog(city);
     empty(target,result.data,'Nenhum profissional aprovado e disponível para este município.');
     for(const provider of result.data){
       const card=wrap(provider.full_name);
       card.append(el('p',provider.city||''),el('p',provider.bio||''));
       const details=el('div');
       card.append(button('Ver serviços',async()=>{
         const [result,reviews]=await Promise.all([api.provider(provider.id),api.publicReviews(provider.id)]);details.replaceChildren();
         if(Number(result.data?.has_avatar)===1)details.append(image('avatar',provider.id,'Foto de '+provider.full_name));
         if(result.data?.portfolio?.length){details.append(el('h4','Portfólio'));for(const item of result.data.portfolio){const box=el('figure');box.append(image('portfolio',item.id,item.caption||'Trabalho realizado'),el('figcaption',item.caption||'Foto do trabalho'));details.append(box);}}
         if(reviews.data.length){details.append(el('h4','Avaliações publicadas'));for(const review of reviews.data){details.append(el('p',review.rating+'/5 — '+review.comment));if(review.response)details.append(el('p','Resposta do profissional: '+review.response));}}
         if(!result.data?.services?.length){details.append(el('p','Nenhum serviço ativo.'));return;}
         const form=el('form'),list=el('select');
         list.required=true;
         for(const service of result.data.services){
           const option=el('option',service.service_title);option.value=service.id;list.append(option);
         }
         const description=el('textarea');description.required=true;description.minLength=25;description.maxLength=2000;
         description.placeholder='Descreva o serviço desejado (mínimo 25 caracteres)';
         const date=el('input');date.type='date';
         const submit=el('button','Solicitar orçamento');submit.className='button button-primary';submit.type='submit';
         form.append(list,description,date,submit);
         form.addEventListener('submit',async event=>{
           event.preventDefault();submit.disabled=true;
           try{
             await api.createRequest({provider_id:provider.id,service_id:list.value,description:description.value,desired_date:date.value||undefined});
             status('Solicitação enviada ao profissional.');await load();
           }catch(error){status(error.message||'Falha ao solicitar orçamento.');}
           finally{submit.disabled=false;}
         });
         details.append(form);
       }),details);
       target.append(card);
     }
   }catch(error){target.replaceChildren(el('p',error.message||'Busca indisponível'));}
 });
 for(const [id,kind] of [['mysqlAvatarForm','avatar'],['mysqlPortfolioForm','portfolio']]){
   $(id).addEventListener('submit',async event=>{
     event.preventDefault();const form=event.currentTarget,file=form.elements.file.files?.[0];
     if(!file||!['image/webp','image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024){status('Envie WebP, JPEG ou PNG de até 5 MB.');return;}
     const submit=form.querySelector('[type="submit"]');submit.disabled=true;
     try{await api.uploadMedia(kind,kind==='avatar'?'self':form.elements.service_id.value,file,form.elements.caption?.value||'');form.reset();await load();status('Imagem salva.');}
     catch(error){status(error.message||'Falha ao salvar imagem.');}finally{submit.disabled=false;}
   });
 }
 $('mysqlDocumentForm').addEventListener('submit',async event=>{
   event.preventDefault();
   const form=event.currentTarget,file=form.elements.file.files?.[0],type=form.elements.document_kind.value;
   if(!file||!['image/webp','image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024){status('Envie uma imagem WebP, JPEG ou PNG válida de até 5 MB.');return;}
   const submit=form.querySelector('[type="submit"]');submit.disabled=true;
   try{await api.uploadMedia('verification',type,file);form.reset();await load();status('Documento enviado para análise.');}
   catch(error){status(error.message||'Falha ao enviar documento.');}
   finally{submit.disabled=false;}
 });
 $('mysqlProfessionalForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const data=Object.fromEntries(f);data.workdays=f.getAll('workdays');data.experience_years=data.experience_years===''?null:Number(data.experience_years);try{await api.saveProfessional(data);await load();status('Informações profissionais salvas.');}catch(error){status(error.message);}});
 $('mysqlServiceCancel').addEventListener('click',()=>{const f=$('mysqlServiceForm');f.reset();f.elements.id.value='';f.querySelector('[type=submit]').textContent='Cadastrar serviço';$('mysqlServiceCancel').hidden=true;});
 $('mysqlServiceForm').addEventListener('submit',async e=>{
   e.preventDefault();const form=e.currentTarget,fields=form.elements;
   const minimum=fields.price_min_cents.value,maximum=fields.price_max_cents.value;
   if((minimum==='')!==(maximum==='')){status('Informe os dois preços ou deixe ambos em branco.');return;}
   const request={...(fields.id.value?{id:fields.id.value}:{}),category_id:fields.category_id.value,service_title:fields.service_title.value,
     description:fields.description.value,price_min_cents:minimum===''?null:Number(minimum),
     price_max_cents:maximum===''?null:Number(maximum)};
   const submit=form.querySelector('[type="submit"]');submit.disabled=true;
   try{await api.saveService(request);$('mysqlServiceCancel').click();await load();status('Serviço salvo.');}
   catch(error){status(error.message||'Falha ao cadastrar serviço.');}
   finally{submit.disabled=false;}
 });
 $('mysqlProfile').addEventListener('submit',async e=>{e.preventDefault();try{const f=new FormData(e.currentTarget);await api.updateProfile({full_name:f.get('full_name'),bio:f.get('bio'),city_ibge:f.get('city_ibge')||null});await load();status('Perfil atualizado.');}catch(e){status(e.message);}});
 try{if(window.SQFDataMode!=='mysql')throw new Error('Ative MySQL apenas no ambiente de homologação.');const s=await api.session();if(!s.user_id){location.replace('entrar.html');return;}user=s.user_id;await load();}catch(e){status(e.message||'Falha ao carregar painel.');}
})();
