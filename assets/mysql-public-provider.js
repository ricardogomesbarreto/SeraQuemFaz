'use strict';
(async()=>{
 const api=window.SQFMySQL,ui=window.SQFProfiles,$=id=>document.getElementById(id);
 const status=message=>$('publicProviderStatus').textContent=message;
 const id=new URL(location.href).searchParams.get('id');
 try{
   if(window.SQFDataMode!=='mysql')throw new Error('Perfil de homologação MySQL indisponível.');
   const [p,r,s]=await Promise.all([api.provider(id),api.publicReviews(id),api.session()]);
   if(!p.data)throw new Error('Perfil indisponível.');
   const provider=p.data,reviews=r.data;
   $('publicProviderName').textContent=provider.full_name;
   $('publicProviderCity').textContent=provider.city||'';
   $('publicProviderBio').textContent=provider.bio||'';
   const details=provider.professional;if(details){const root=$('publicProviderBio').parentElement;for(const [label,value] of [['Título',details.professional_title],['Especialidades',details.specialties],['Experiência',details.experience_years==null?'':details.experience_years+' anos'],['Modalidade',({presencial:'Presencial',remoto:'Remoto',hibrido:'Híbrida'})[details.service_mode]],['Área de atendimento',details.coverage_area]])if(value)root.append(ui.make('p','',label+': '+value));}
   if(Number(provider.has_avatar)===1){const img=ui.safeImg(api.mediaUrl('avatar',id),'Foto do profissional');img.width=120;img.height=120;img.style.objectFit='cover';img.style.borderRadius='50%';$('publicProviderAvatar').append(img);}
   $('publicProviderRating').append(ui.ratingLine(reviews));
   const form=$('publicProviderQuote');
   for(const service of provider.services){
     const card=ui.make('article','card');card.append(ui.make('h3','',service.service_title),ui.make('p','',service.description));$('publicProviderServices').append(card);
     const option=ui.make('option','',service.service_title);option.value=service.id;form.elements.service_id.append(option);
   }
   if(!provider.services.length)$('publicProviderServices').textContent='Nenhum serviço ativo.';
   for(const photo of provider.portfolio||[]){const figure=ui.make('figure'),img=ui.safeImg(api.mediaUrl('portfolio',photo.id),photo.caption||'Trabalho realizado');img.style.maxWidth='100%';img.style.maxHeight='280px';figure.append(img,ui.make('figcaption','',photo.caption));$('publicProviderPortfolio').append(figure);}
   if(!provider.portfolio?.length)$('publicProviderPortfolio').textContent='Nenhuma foto publicada.';
   for(const review of reviews){const card=ui.make('article','card');card.append(ui.make('h3','',review.rating+'/5'),ui.make('p','',review.comment));if(review.response)card.append(ui.make('p','','Resposta: '+review.response));$('publicProviderReviews').append(card);}
   if(!reviews.length)$('publicProviderReviews').textContent='Nenhuma avaliação publicada.';
   const own=s.user_id?(await api.profile()).data:null;
   if(own){try{await api.recordView(id);}catch{/* Metrics must not prevent profile display. */}}
   if(own?.account_type==='cliente'){
     const saved=(await api.favoriteProviders()).data.some(x=>x.id===id);
     let isSaved=saved;const favorite=ui.make('button','button button-outline',saved?'Remover dos favoritos':'Salvar profissional');favorite.type='button';
     favorite.addEventListener('click',async()=>{favorite.disabled=true;try{await api.favoriteProvider({provider_id:id,saved:!isSaved});isSaved=!isSaved;favorite.textContent=isSaved?'Remover dos favoritos':'Salvar profissional';}catch(e){status(e.message);}finally{favorite.disabled=false;}});
     form.parentElement.insertBefore(favorite,form);
   }
   form.hidden=own?.account_type!=='cliente'||!provider.services.length;
   $('publicProviderQuoteNotice').textContent=form.hidden?'Entre como cliente para solicitar um orçamento.':'Envie sua solicitação sem divulgar telefone.';
   form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{await api.createRequest({provider_id:id,service_id:form.elements.service_id.value,description:form.elements.description.value,desired_date:form.elements.date.value||undefined});status('Solicitação enviada.');form.reset();}catch(error){status(error.message);}finally{submit.disabled=false;}});
   $('publicProviderContent').hidden=false;status('Perfil carregado.');
 }catch(e){status(e.message||'Não foi possível consultar o perfil.');}
})();