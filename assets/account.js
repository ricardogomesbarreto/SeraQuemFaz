'use strict';
(async () => {
  const status = document.querySelector('#accountStatus');
  const details = document.querySelector('#accountDetails');
  const ui = window.SQFProfiles;
  const $ = id => document.getElementById(id);
  const announce = (id,text,bad=false) => { const node=$(id); if(node){node.textContent=text;node.dataset.error=String(bad);} };
  let client,user,profile,categories=[];
  let preparedPortrait=null, portraitPreviewUrl=null, portraitBusy=false, portraitVersion=0, portraitDebounce=null;
  let currentServiceCount=0, currentPhotoCount=0, currentVerification=null, professionalExtras=null;
  function syncClientSidebar() {
    if (profile?.account_type !== 'cliente') return;
    const label=$('clientSideName'), target=$('clientSideAvatar');
    if (label) label.textContent=profile.full_name || 'Cliente';
    const avatar=$('avatarPreview')?.querySelector('.avatar');
    if (target && avatar) target.replaceChildren(avatar.cloneNode(true));
  }
  // Durante a edição, mostramos somente a foto recortada, evitando a
  // duplicação do avatar antigo (a caixa com a inicial do usuário).
  function showPreparedPortrait(url) {
    const savedPreview=$('avatarPreview');
    if(savedPreview) savedPreview.hidden=Boolean(url);
    if(profile?.account_type !== 'cliente') return;
    if(!url){syncClientSidebar();return;}
    const target=$('clientSideAvatar');
    if(!target)return;
    const img=document.createElement('img');
    img.src=url;
    img.alt='Prévia da fotografia antes de salvar';
    target.replaceChildren(img);
  }
  function openSettingsForHash() {
    if (!['#accountSettings','#privacyRequestCard'].includes(location.hash)) return;
    const settings=$('accountSettings');
    if (settings) settings.open=true;
  }
  function updateReadiness(){
    const box=$('providerReadiness');
    if(!box || profile?.account_type!=='prestador')return;
    box.hidden=false;
    const items=[
      ['Nome informado',Boolean(profile?.full_name?.trim())],
      ['Cidade selecionada',/^\d{7}$/.test(String(profile?.city_ibge||''))],
      ['Foto de rosto cadastrada',Boolean(profile?.avatar_path)],
      ['Apresentação profissional completa',String(profile?.bio||'').trim().length>=40],
      ['Ao menos um serviço cadastrado',currentServiceCount>0]
    ];
    const done=items.filter(([,checked])=>checked).length;
    $('readinessProgress').value=done;
    const statusText={pending:'Aguardando análise da equipe',approved:'Cadastro aprovado para publicação',rejected:'Revisão necessária',suspended:'Cadastro suspenso'};
    $('readinessDescription').textContent=`${done} de ${items.length} etapas concluídas · ${statusText[currentVerification]||'Análise não solicitada'}.`;
    const ul=$('readinessChecklist');ul.replaceChildren();
    for(const [label,checked] of items){
      const li=ui.make('li',checked?'readiness-done':'readiness-open',`${checked?'✓':'○'} ${label}`);
      ul.append(li);
    }
  }
  async function preparePortrait(file) {
    const token=++portraitVersion;
    if(!file){portraitBusy=false;return;}
    portraitBusy=true;
    preparedPortrait=null;
    announce('portraitMessage','Preparando imagem e removendo metadados...');
    try{
      const options={zoom:Number($('portraitZoom').value)/100,panX:Number($('portraitPanX').value),panY:Number($('portraitPanY').value)};
      const blob=await window.SQFPortrait.process(file,options);
      if(token!==portraitVersion || $('avatarFile').files?.[0]!==file)return;
      preparedPortrait={source:file,blob};
      if(portraitPreviewUrl)URL.revokeObjectURL(portraitPreviewUrl);
      portraitPreviewUrl=URL.createObjectURL(blob);
      $('portraitCandidate').src=portraitPreviewUrl;
      $('portraitCandidateBox').hidden=false;
      showPreparedPortrait(portraitPreviewUrl);
      $('portraitCandidateStatus').textContent=`Prévia final do recorte (3:4) · ${(blob.size/1024).toFixed(0)} KB · Ajustes refletidos na imagem enviada.`;
      $('portraitDeclarationLabel').hidden=profile?.account_type!=='prestador';
      announce('portraitMessage',profile?.account_type==='prestador'
        ? 'Prévia atualizada. Confira a fotografia e confirme a declaração para salvar.'
        : 'Prévia atualizada. Clique em Salvar informações para aplicar a fotografia.');
    }catch(error){
      if(token!==portraitVersion)return;
      announce('portraitMessage',error?.message||'Não foi possível preparar o retrato.',true);
      $('portraitDeclarationLabel').hidden=true;
      $('portraitCandidateBox').hidden=true;
      showPreparedPortrait(null);
    }finally{if(token===portraitVersion)portraitBusy=false;}
  }
  function updatePortraitControlLabels() {
    for (const [rangeId,labelId] of [
      ['portraitZoom','portraitZoomValue'],['portraitPanX','portraitPanXValue'],['portraitPanY','portraitPanYValue']
    ]) {
      const range=$(rangeId), label=$(labelId);
      if(range && label)label.textContent=range.value+'%';
    }
  }
  function discardPortraitSelection() {
    clearTimeout(portraitDebounce);
    ++portraitVersion;
    portraitBusy=false;
    preparedPortrait=null;
    $('avatarFile').value='';
    $('portraitDeclaration').checked=false;
    $('portraitDeclarationLabel').hidden=true;
    $('portraitCandidateBox').hidden=true;
    showPreparedPortrait(null);
    if(portraitPreviewUrl){URL.revokeObjectURL(portraitPreviewUrl);portraitPreviewUrl=null;}
    for(const [id,value] of [['portraitZoom','100'],['portraitPanX','50'],['portraitPanY','50']])$(id).value=value;
    updatePortraitControlLabels();
    announce('portraitMessage','Foto não salva descartada. Seus dados e a fotografia anterior foram preservados.');
    announce('profileMessage','');
  }
  function schedulePortraitPreview(){
    const file=$('avatarFile').files?.[0];
    updatePortraitControlLabels();
    ++portraitVersion; preparedPortrait=null; portraitBusy=Boolean(file);
    // O titular confirma a fotografia selecionada uma vez; mover os
    // controles não deve apagar a confirmação.
    clearTimeout(portraitDebounce);
    portraitDebounce=setTimeout(()=>preparePortrait(file),180);
  }

  function updateProfessionalExtrasProgress(data){
    const result=window.SQFProfessionalDetails.completion(data||{});
    const progress=$('detailsCompletionProgress'),label=$('detailsCompletionText');
    if(progress)progress.value=result.done;
    if(label)label.textContent=`${result.done} de ${result.total} informações opcionais preenchidas`;
  }
  async function loadProfessionalExtras(){
    const form=$('professionalDetailsForm');
    if(!form)return;
    $('providerDetailsCard').hidden=false;
    const {data,error}=await client.from('provider_professional_details')
      .select('provider_id,professional_title,specialties,experience_years,service_mode,coverage_area,workdays,work_period,quote_policy,professional_website')
      .eq('provider_id',user.id).maybeSingle();
    if(error){
      const msg='Dados complementares indisponíveis: é necessário aplicar a migração v3.7.1 no Supabase.';
      announce('professionalDetailsMessage',msg,true);
      form.querySelectorAll('input,select,button').forEach(node=>{node.disabled=true;});
      updateProfessionalExtrasProgress({});
      return;
    }
    professionalExtras=data||null;
    window.SQFProfessionalDetails.populate(form,data||{});
    updateProfessionalExtrasProgress(data||{});
  }
  async function imageUpload(file,bucket) {
    if(bucket==='sqf-avatars' || bucket==='sqf-client-avatars') {
      const blob = file?.type==='image/webp' && file?.size<=window.SQFPortrait.MAX_OUTPUT
        ? file : await window.SQFPortrait.process(file);
      const path=`${user.id}/${crypto.randomUUID()}.webp`;
      const {error}=await client.storage.from(bucket).upload(path,blob,{contentType:'image/webp',cacheControl:'3600',upsert:false});
      if(error)throw error;
      return path;
    }
    if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024 || file.size === 0)
      throw new Error('Escolha uma imagem JPG, PNG ou WebP com até 5 MB.');
    // Recodificar no navegador para WebP remove metadados EXIF/GPS comuns.
    // Não substitui a inspeção de arquivos no servidor nem moderação do conteúdo.
    const bitmap=await createImageBitmap(file);
    try {
      const maxSide=1600, scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível processar a imagem.');
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const encoded=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob&&blob.type==='image/webp' ? resolve(blob) : reject(new Error('Seu navegador não permite gerar WebP.')), 'image/webp',0.84));
      const path=`${user.id}/${crypto.randomUUID()}.webp`;
      const {error}=await client.storage.from(bucket).upload(path,encoded,{contentType:'image/webp',cacheControl:'3600',upsert:false});
      if(error)throw error;return path;
    }finally{bitmap.close();}
  }
  async function reloadActiveCategories() {
    const select=$('newServiceCategory'),retry=$('reloadCategories'),save=$('addServiceBtn');
    if(!select)return;
    const previous=select.value;
    const placeholder=document.createElement('option');
    placeholder.value='';placeholder.textContent='Selecione uma área de serviço';
    select.replaceChildren(placeholder);
    select.disabled=true;
    if(save)save.disabled=true;
    if(retry)retry.disabled=true;
    announce('serviceMessage','Consultando categorias de serviços...');
    try {
      const {data,error}=await client.from('categories')
        .select('id,name,status').eq('status','active').order('name');
      if(error)throw error;
      categories=(data||[]).filter(item=>ui.validId(item.id)&&
        typeof item.name==='string'&&item.name.trim().length>0);
      for(const category of categories){
        const option=document.createElement('option');
        option.value=String(category.id);
        option.textContent=category.name;
        select.append(option);
      }
      if(categories.some(item=>String(item.id)===previous))select.value=previous;
      announce('serviceMessage',categories.length
        ?`${categories.length} categorias disponíveis. Selecione sua área e cadastre o serviço.`
        :'Não há categorias ativas disponíveis. Tente novamente ou consulte o suporte.',
        !categories.length);
    } catch(error) {
      categories=[];
      console.warn('Consulta de categorias:',error?.message);
      announce('serviceMessage','Falha ao consultar as categorias. Clique em Recarregar categorias e tente novamente.',true);
    } finally {
      select.disabled=!categories.length;
      if(save)save.disabled=!categories.length;
      if(retry)retry.disabled=false;
    }
  }
  async function loadServices() {
    const list = $('myServices');list.replaceChildren();
    const {data,error}=await client.from('provider_services').select('id,category_id,service_title,description').eq('provider_id',user.id).order('service_title');
    if(error) throw error;
    currentServiceCount=data?.length||0;updateReadiness();
    if($('providerStatServices'))$('providerStatServices').textContent=String(currentServiceCount);
    if(!data?.length) {ui.state(list,'Nenhum serviço cadastrado','Adicione uma categoria e descreva a sua atividade.'); return data || [];}
    for(const service of data){
      const item=ui.make('div','editable-row'); const text=ui.make('div');
      text.append(ui.make('strong','',service.service_title));
      const cat=categories.find(c=>String(c.id)===service.category_id);
      text.append(ui.make('p','muted', `${cat?.name || 'Categoria'}${service.description ? ` · ${service.description}` : ''}`));
      const del=ui.make('button','button button-outline button-small','Remover');del.type='button';del.setAttribute('aria-label',`Remover serviço ${service.service_title}`);
      del.addEventListener('click', async()=>{
        if(!confirm('Remover este serviço do seu perfil?')) return;
        del.disabled=true;
        const {error:err}=await client.from('provider_services').delete().eq('id',service.id).eq('provider_id',user.id);
        if(err) {announce('serviceMessage','Não foi possível remover o serviço.',true);del.disabled=false;return;}
        announce('serviceMessage','Serviço removido. O cadastro poderá exigir nova análise.');await loadServices();await loadVerification();
      });
      const edit=ui.make('button','button button-outline button-small','Editar');
      edit.type='button';
      edit.setAttribute('aria-label',`Editar serviço ${service.service_title}`);
      const editForm=ui.make('form','service-inline-editor');
      editForm.hidden=true;
      const editCatLabel=ui.make('label','', 'Categoria');
      const editCat=ui.make('select');editCat.required=true;
      for(const available of categories){
        const option=ui.make('option','',available.name);option.value=String(available.id);editCat.append(option);
      }
      if(!categories.some(c=>String(c.id)===String(service.category_id))){
        const option=ui.make('option','', 'Categoria anterior indisponível');option.value=String(service.category_id);editCat.prepend(option);
      }
      editCat.value=String(service.category_id);
      editCatLabel.append(editCat);
      const editTitleLabel=ui.make('label','','Nome do serviço');
      const editTitle=ui.make('input');editTitle.value=service.service_title;
      editTitle.minLength=3;editTitle.maxLength=100;editTitle.required=true;
      editTitleLabel.append(editTitle);
      const editDescLabel=ui.make('label','','Descrição (opcional)');
      const editDesc=ui.make('textarea');editDesc.value=service.description||'';
      editDesc.rows=3;editDesc.maxLength=500;editDescLabel.append(editDesc);
      const save=ui.make('button','button button-primary button-small','Salvar edição');save.type='submit';
      const cancel=ui.make('button','button button-outline button-small','Cancelar');cancel.type='button';
      const editMsg=ui.make('p','form-feedback');editMsg.setAttribute('role','status');
      cancel.addEventListener('click',()=>{editForm.hidden=true;edit.hidden=false;});
      edit.addEventListener('click',()=>{editForm.hidden=false;edit.hidden=true;editTitle.focus();});
      editForm.addEventListener('submit',async event=>{
        event.preventDefault();
        const title=editTitle.value.trim(), description=editDesc.value.trim();
        const categoryId=editCat.value;
        if(!ui.validId(categoryId)||title.length<3||title.length>100||description.length>500){
          editMsg.textContent='Selecione uma categoria e um título válido (3–100 caracteres).';return;
        }
        save.disabled=true;
        try{
          const {error:saveError}=await client.from('provider_services')
            .update({category_id:categoryId,service_title:title,description})
            .eq('id',service.id).eq('provider_id',user.id);
          if(saveError)throw saveError;
          announce('serviceMessage','Serviço atualizado. Uma nova análise cadastral poderá ser necessária.');
          await loadServices();await loadVerification();
        }catch{
          editMsg.textContent='Não foi possível editar. Verifique se a categoria está ativa e se o serviço já existe.';
          save.disabled=false;
        }
      });
      const editActions=ui.make('div','service-row-actions');editActions.append(edit,del);
      const formActions=ui.make('div','service-row-actions');formActions.append(save,cancel);
      editForm.append(editCatLabel,editTitleLabel,editDescLabel,formActions,editMsg);
      item.append(text,editActions,editForm);list.append(item);
    }
    return data;
  }
  async function loadOwnReviews() {
    const list=$('myReviews'),rating=$('myRating');
    if(!list||!rating)return;
    const [reviewsResult,disputesResult,repliesResult]=await Promise.all([
      client.rpc('sqf_public_reviews', {p_provider_ids:[user.id]}),
      client.from('sqf_review_disputes').select('id,review_id,status'),
      client.from('sqf_review_responses').select('review_id,moderation_status')
    ]);
    if(reviewsResult.error)throw reviewsResult.error;
    if(disputesResult.error || repliesResult.error){
      // Exigir as migrações, em vez de fingir que as novas proteções existem no banco.
      ui.state(list,'Contestações indisponíveis','A migração de segurança v3.6.0 ainda não foi aplicada.');return;
    }
    const data=reviewsResult.data || [],disputes=disputesResult.data || [],replies=repliesResult.data || [];
    rating.replaceChildren(ui.ratingLine(data));list.replaceChildren();
    if($('providerStatReviews'))$('providerStatReviews').textContent=String(data.length);
    if(!data.length){ui.state(list,'Nenhuma avaliação publicada');return;}
    for(const review of data){
      const row=ui.make('article','review-card');
      const top=ui.make('div','review-top');
      top.append(ui.stars(review.rating),ui.make('span','muted',new Date(review.created_at).toLocaleDateString('pt-BR')));
      row.append(top,ui.make('p','',review.comment));
      const dispute=disputes.find(d=>String(d.review_id)===String(review.id));
      const reply=replies.find(r=>String(r.review_id)===String(review.id));
      const actions=ui.make('div','review-case-actions');
      if(!dispute){
        const button=ui.make('button','button button-outline button-small','Contestar possível abuso');button.type='button';
        button.addEventListener('click',()=>{
          button.hidden=true;
          const form=ui.make('form','review-case-form');
          const label=ui.make('label','', 'Motivo da contestação');
          const reason=ui.make('select');reason.required=true;
          for(const [value,name] of [['','Selecione o motivo'],['false_service','Atendimento possivelmente não realizado'],['inaccurate','Informação objetivamente incorreta'],['harassment','Ofensa ou perseguição'],['personal_data','Exposição de dados pessoais'],['other','Outra situação verificável']]){
            const option=ui.make('option','',name);option.value=value;reason.append(option);
          }
          const descriptionLabel=ui.make('label','', 'Explique os fatos para a equipe, sem dados pessoais');
          const details=ui.make('textarea');details.required=true;details.minLength=30;details.maxLength=1200;details.rows=4;
          details.placeholder='Descreva o que pode ser comprovado. Críticas negativas legítimas não são motivo para remoção.';
          const submit=ui.make('button','button button-outline button-small','Enviar contestação');submit.type='submit';
          const message=ui.make('p','form-feedback');message.setAttribute('role','status');
          form.append(label,reason,descriptionLabel,details,submit,message);
          form.addEventListener('submit',async event=>{
            event.preventDefault();
            if(!reason.value||details.value.trim().length<30){message.textContent='Preencha o motivo e detalhe os fatos.';return;}
            submit.disabled=true;
            try{
              const {error}=await client.rpc('sqf_submit_review_dispute',{
                p_review:review.id,p_reason:reason.value,p_details:details.value.trim()
              });
              if(error)throw error;
              announce('reviewCaseMessage','Contestação registrada para análise imparcial. A nota não será removida automaticamente.');
              await loadOwnReviews();
            }catch{message.textContent='Não foi possível registrar. Confira os campos ou tente mais tarde.';submit.disabled=false;}
          });
          row.append(form);
        });actions.append(button);
      } else {
        actions.append(ui.make('span','muted',`Contestação: ${{
          pending:'aguardando revisão',reviewing:'em análise',upheld:'acolhida após análise',dismissed:'não acolhida'
        }[dispute.status] || dispute.status}.`));
      }
      if(!reply){
        const button=ui.make('button','button button-outline button-small','Responder à avaliação');button.type='button';
        button.addEventListener('click',()=>{
          button.hidden=true;
          const form=ui.make('form','review-case-form');
          const label=ui.make('label','', 'Sua resposta pública será moderada');
          const comment=ui.make('textarea');comment.required=true;comment.minLength=20;comment.maxLength=600;comment.rows=4;
          comment.placeholder='Explique sua versão de forma respeitosa. Não publique dados do cliente ou contatos.';
          const submit=ui.make('button','button button-outline button-small','Enviar resposta para moderação');submit.type='submit';
          const message=ui.make('p','form-feedback');message.setAttribute('role','status');
          form.append(label,comment,submit,message);
          form.addEventListener('submit',async(event)=>{
            event.preventDefault();const value=comment.value.trim();
            if(value.length<20||value.length>600){message.textContent='Escreva entre 20 e 600 caracteres.';return;}
            submit.disabled=true;
            try{
              const {error}=await client.rpc('sqf_submit_review_response',{p_review:review.id,p_message:value});
              if(error)throw error;
              announce('reviewCaseMessage','Resposta recebida. Será publicada apenas após moderação.');
              await loadOwnReviews();
            }catch{message.textContent='Não foi possível enviar a resposta. Evite URLs e e-mails.';submit.disabled=false;}
          });
          row.append(form);
        });actions.append(button);
      } else {
        actions.append(ui.make('span','muted',`Resposta: ${{
          pending:'aguardando moderação',published:'publicada',rejected:'não aprovada',hidden:'oculta'
        }[reply.moderation_status] || reply.moderation_status}.`));
      }
      row.append(actions);list.append(row);
    }
  }
  async function loadVerification() {
    const label=$('providerVerificationStatus');
    if(!label)return;
    const {data,error}=await client.from('provider_verifications').select('status,requested_at,reviewed_at').eq('provider_id',user.id).maybeSingle();
    if(error){label.textContent='Não foi possível consultar a análise cadastral.';return;}
    currentVerification=data?.status||null;updateReadiness();
    const statusText={pending:'Análise pendente pela equipe.',approved:'Cadastro analisado e aprovado para exibição pública (não é certificação de idoneidade).',rejected:'Solicitação não aprovada. Revise os dados e peça nova análise.',suspended:'Cadastro suspenso. Solicite revisão administrativa.'};
    label.textContent=data ? statusText[data.status]||'Situação não identificada.' : 'Ainda não houve solicitação de análise.';
    $('requestVerification').hidden=Boolean(data && ['approved','pending','suspended'].includes(data.status));
    const myLink=$('myPublicProfile');
    if(myLink)myLink.hidden=!(profile.is_public && data?.status==='approved');
  }
  async function loadPendingEngagements() {
    const list=$('pendingEngagements');list.replaceChildren();
    const {data,error}=await client.from('service_engagements').select('id,requested_at,status').eq('provider_id',user.id).eq('status','requested').order('requested_at',{ascending:false});
    if(error){ui.state(list,'Não foi possível consultar os atendimentos.');return;}
    if($('providerStatPending'))$('providerStatPending').textContent=String(data?.length||0);
    if(!data?.length){ui.state(list,'Nenhuma confirmação pendente.');return;}
    for(const entry of data){
      const item=ui.make('div','editable-row'),description=ui.make('span','',`Solicitado em ${new Date(entry.requested_at).toLocaleDateString('pt-BR')}`);
      const button=ui.make('button','button button-outline button-small','Confirmar atendimento realizado');button.type='button';
      button.addEventListener('click',async()=>{
        if(!confirm('Você confirma que prestou um serviço real ao solicitante? Essa confirmação permitirá que o cliente avalie.'))return;
        button.disabled=true;
        const {error:confirmError}=await client.from('service_engagements').update({status:'confirmed'}).eq('id',entry.id).eq('provider_id',user.id).eq('status','requested');
        announce('engagementMessage',confirmError?'Não foi possível confirmar.':'Atendimento confirmado; o cliente poderá avaliar após entrar na conta.',Boolean(confirmError));
        await loadPendingEngagements();
      });
      item.append(description,button);list.append(item);
    }
  }
  async function loadPhotos() {
    const list=$('myGallery');list.replaceChildren();
    const {data,error}=await client.from('portfolio_photos').select('id,storage_path,caption').eq('provider_id',user.id).order('created_at',{ascending:false});
    if(error) throw error;
    currentPhotoCount=data?.length||0;
    if($('providerStatPhotos'))$('providerStatPhotos').textContent=String(currentPhotoCount);
    if(!data?.length){ui.state(list,'Sem fotos no portfólio','Mostre fotos autorais de serviços que você realizou.');return;}
    for(const photo of data){
      const imgUrl=ui.publicUrl(client,'sqf-portfolios',photo.storage_path);
      if(!imgUrl)continue;
      const card=ui.make('figure','portfolio-photo');card.append(ui.safeImg(imgUrl,photo.caption || 'Trabalho do prestador'));
      if(photo.caption)card.append(ui.make('figcaption','',photo.caption));
      const remove=ui.make('button','button button-outline button-small','Excluir foto');remove.type='button';
      remove.addEventListener('click',async()=>{
        if(!confirm('Excluir esta foto do portfólio público?'))return;
        remove.disabled=true;
        try{
          const {error:dbErr}=await client.from('portfolio_photos').delete().eq('id',photo.id).eq('provider_id',user.id);
          if(dbErr)throw dbErr;
          const {error:storageError}=await client.storage.from('sqf-portfolios').remove([photo.storage_path]);
          if(storageError)console.warn('Foto removida do catálogo; objeto órfão no storage:',storageError.message);
          announce('galleryMessage','Foto removida. O cadastro poderá exigir nova análise.');await loadPhotos();await loadVerification();
        }catch(err){console.warn(err?.message);announce('galleryMessage','Falha ao remover a foto.',true);remove.disabled=false;}
      });
      card.append(remove);list.append(card);
    }
  }
  async function renderOwnAvatar() {
    const target=$('avatarPreview');
    if(!target || !profile)return;
    target.hidden=false;
    if(profile.account_type!=='cliente') {
      target.replaceChildren(ui.avatar(client,profile.avatar_path,profile.full_name));
      return;
    }
    // A fotografia de clientes é privada; nunca construir uma URL pública para ela.
    const visual=ui.make('div','avatar avatar-private-preview');
    const fallback=ui.make('span','sqf-avatar-initials',profile.full_name?.trim()?.slice(0,1)?.toLocaleUpperCase('pt-BR') || 'C');
    visual.append(fallback);
    const path=profile.avatar_path;
    if(path && new RegExp(`^${user.id}/[0-9a-f-]{36}\\.webp$`,'i').test(path)){
      try{
        const {data,error}=await client.storage.from('sqf-client-avatars').createSignedUrl(path,120);
        if(!error && data?.signedUrl){
          const url=new URL(data.signedUrl,location.href);
          if(url.protocol==='https:' && url.host===new URL(window.SQFSupabase.url).host){
            const image=ui.make('img');image.src=url.href;image.alt='Minha foto de perfil';
            image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove(),{once:true});
            visual.append(image);
          }
        }
      }catch{ /* Sem bucket privado, manter a inicial em vez de expor a foto. */ }
    }
    target.replaceChildren(visual);
    syncClientSidebar();
  }
  function wireFallbackActions() {
    const signout = async (button, label) => {
      button.disabled=true;
      try {
        const {error}=await client.auth.signOut();if(error)throw error;
        location.replace('index.html');
      } catch { announce(label,'Não foi possível sair agora. Tente novamente.',true); button.disabled=false; }
    };
    $('fallbackLogout').addEventListener('click',()=>signout($('fallbackLogout'),'fallbackStatus'));
    $('fallbackRetry').addEventListener('click',()=>location.reload());

  }
  async function showMissingProfile(error) {
    // Ocorre quando o Supabase Auth funciona, mas public.profiles não existe.
    // Não ocultar a opção de sair ou os dados da sessão.
    const existing=user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Usuário';
    const name=String(existing).slice(0,120);
    $('accountFallbackName').textContent=name;
    $('accountFallbackEmail').textContent=user.email || 'Não informado';
    $('fallbackName').value=name;
    $('accountFallback').hidden=false;
    $('accountToolbar').hidden=false;
    $('accountEditShortcut').hidden=false;
    $('accountRequestsShortcut').hidden=false;
    $('accountEditShortcut').href='#accountProfile';
    $('dashboardHeading').textContent='Minha conta';
    $('dashboardIntroText').textContent='Seus dados de conta estão disponíveis. Recursos profissionais e mensagens dependem da configuração do banco.';
    const missing=/PGRST205|42P01|schema cache|could not find the table|relation.*does not exist/i.test(String(error?.message||error||''));
    status.textContent=missing
      ? 'Sua conta está conectada ao esquema anterior do Supabase. Seus dados básicos podem ser editados após instalar a compatibilidade; os módulos completos exigem as migrações.'
      : 'Sua conta está conectada, mas não foi possível carregar seu perfil. Confira as permissões e a conexão com o Supabase.';
    wireFallbackActions();
    await window.SQFAccountFallback?.init(client,user);
  }
  try {
    client=window.getSQFClient();
    const {data,error}=await client.auth.getUser();
    if(error || !data?.user){
      const requestId=window.SQFUtils.requestIdFromSearch(location.search);
      location.replace(requestId ? `entrar.html?solicitacao=${requestId}` : 'entrar.html');
      return;
    }
    user=data.user;
    const {data:myProfile,error:pe}=await client.from('profiles')
      .select('id,full_name,account_type,city,city_ibge,bio,avatar_path,is_public').eq('id',user.id).maybeSingle();
    if(pe||!myProfile){
      await showMissingProfile(pe || new Error('Perfil inexistente. É necessário aplicar a migração SQL.'));
      return;
    }
    profile=myProfile;
    $('accountEditShortcut').href='#profileSettings';
    $('accountSettingsShortcut')?.addEventListener('click',()=>{ $('accountSettings').open=true; });
    document.querySelectorAll('[data-open-settings]').forEach(link=>
      link.addEventListener('click',()=>{ $('accountSettings').open=true; })
    );
    window.addEventListener('hashchange',openSettingsForHash);
    openSettingsForHash();
    $('accountToolbar').hidden=false;
    $('accountName').textContent=profile.full_name;
    $('accountEmail').textContent=user.email || 'Não informado';
    $('accountType').textContent=profile.account_type==='prestador'?'Prestador de serviços':'Cliente';
    $('profileFullName').value=profile.full_name;
    const cityPicker = $('profileCity')?.closest('[data-city-picker]')?.__cityPicker;
    if (profile.city_ibge) await cityPicker?.setId(profile.city_ibge);
    else $('profileCity').value = profile.city || '';
    $('profileBio').value=profile.bio || '';
    $('profilePublic').checked=Boolean(profile.is_public);
    await renderOwnAvatar();
    status.textContent='Sessão e perfil confirmados.';
    details.hidden=false;
    // A âncora pode ser resolvida antes de o painel terminar de carregar.
    if (location.hash === '#profileSettings') {
      requestAnimationFrame(() => $('profileSettings')?.scrollIntoView({block:'start',behavior:'instant'}));
    }
    const providerAccount=profile.account_type==='prestador';
    $('dashboardKicker').textContent=providerAccount?'PAINEL PROFISSIONAL':'MINHA CONTA · CLIENTE';
    $('dashboardHeading').textContent=providerAccount?'Central do prestador':'Central do cliente';
    $('dashboardIntroText').textContent=providerAccount
      ? 'Organize seus dados profissionais, formas de atendimento, serviços, portfólio e verificação.'
      : 'Acompanhe seus atendimentos confirmados, avaliações, favoritos e solicitações com privacidade.';
    $('accountCatalogShortcut').hidden=providerAccount;
    $('accountFavoritesShortcut').hidden=providerAccount;
    $('accountServicesShortcut').hidden=!providerAccount;
    $('accountPortfolioShortcut').hidden=!providerAccount;
    // A presença do link é somente conveniência visual. A autorização real ocorre no servidor.
    try {
      const {data:membership,error:membershipError}=await client.rpc('sqf_staff_whoami');
      if(!membershipError && membership?.role) $('adminAccessLink').hidden=false;
    } catch { /* migração administrativa ainda não instalada: continuar sem acesso */ }
    $('privacyRequestForm').addEventListener('submit',async(event)=>{
      event.preventDefault();
      const button=$('privacyRequestSubmit');button.disabled=true;
      const request_type=$('privacyRequestType').value,details=$('privacyRequestDetails').value.trim();
      try{
        const {error}=await client.from('privacy_requests').insert({user_id:user.id,request_type,details});
        if(error)throw error;
        announce('privacyRequestMessage','Solicitação registrada para análise humana. Nenhum dado foi excluído automaticamente.');
        $('privacyRequestDetails').value='';
        if(profile.account_type==='cliente')await window.SQFClientDashboard.refresh(client,user);
      }catch{announce('privacyRequestMessage','Não foi possível registrar a solicitação.',true);}
      finally{button.disabled=false;}
    });
    $('logoutButton').addEventListener('click',async()=>{
      const button=$('logoutButton');button.disabled=true;
      try{const {error:signOutError}=await client.auth.signOut();if(signOutError)throw signOutError;location.replace('index.html');}
      catch{status.textContent='Não foi possível encerrar a sessão. Tente novamente.';button.disabled=false;}
    });
    if(profile.account_type==='prestador'){
      if(window.SQFBillingUI) void window.SQFBillingUI.init(client,user,profile);
      $('providerEditor').hidden=false;
      $('providerOverview').hidden=false;
      $('reloadCategories')?.addEventListener('click',()=>void reloadActiveCategories());
      await reloadActiveCategories();
      await Promise.all([loadServices(),loadPhotos(),loadOwnReviews(),loadVerification(),loadPendingEngagements(),loadProfessionalExtras()]);
      const extrasForm=$('professionalDetailsForm');
      const refreshExtrasPreview=()=>{
        try{updateProfessionalExtrasProgress(window.SQFProfessionalDetails.readForm(extrasForm));}
        catch{/* Campos em edição: a mensagem de validação é mostrada ao salvar. */}
      };
      extrasForm.addEventListener('input',refreshExtrasPreview);
      extrasForm.addEventListener('change',refreshExtrasPreview);
      extrasForm.addEventListener('submit',async(event)=>{
        event.preventDefault();
        let payload;
        try{payload=window.SQFProfessionalDetails.readForm(extrasForm);}
        catch(error){announce('professionalDetailsMessage',error.message,true);return;}
        const button=$('saveProfessionalDetails');button.disabled=true;
        announce('professionalDetailsMessage','Salvando informações profissionais...');
        try{
          let result;
          if(professionalExtras){
            result=await client.from('provider_professional_details').update(payload)
              .eq('provider_id',user.id).select('*').single();
          } else {
            result=await client.from('provider_professional_details')
              .insert({...payload,provider_id:user.id}).select('*').single();
          }
          if(result.error)throw result.error;
          professionalExtras=result.data;
          updateProfessionalExtrasProgress(professionalExtras);
          announce('professionalDetailsMessage','Informações salvas. Se o perfil estava aprovado, a edição poderá exigir nova análise.');
          await loadVerification();
        }catch(error){
          console.warn('Dados profissionais:',error?.message);
          announce('professionalDetailsMessage','Não foi possível salvar. Confira os campos e a migração v3.7.1 do Supabase.',true);
        }finally{button.disabled=false;}
      });
      $('requestVerification').addEventListener('click',async()=>{
        const button=$('requestVerification');button.disabled=true;
        try{const {error}=await client.rpc('sqf_request_verification');if(error)throw error;announce('verificationMessage','Solicitação registrada. A equipe precisa analisar os dados antes da aprovação.');await loadVerification();}
        catch{announce('verificationMessage','Complete seu perfil, confirme o e-mail, cadastre um serviço e tente novamente.',true);}
        finally{button.disabled=false;}
      });
      $('profilePublic').addEventListener('change',()=>{
        $('publishHelp').textContent=$('profilePublic').checked
          ? 'Após salvar, o perfil só será exibido quando a equipe aprovar o cadastro.'
          : 'Seu perfil profissional não aparecerá nas pesquisas públicas.';
      });
      if(profile.is_public){const link=$('myPublicProfile');link.href=`prestador.html?id=${encodeURIComponent(user.id)}`;}
    }else {
      $('profileBioGroup').hidden=true;$('profilePublicGroup').hidden=true;
      $('avatarEditor').querySelector('label[for="avatarFile"]').textContent='Foto opcional da minha conta';
      $('avatarHelp').textContent='JPG, PNG ou WebP, até 5 MB, sem dimensão mínima. Sua foto é armazenada de forma privada e exibida somente em sua conta autenticada. Se preferir, serão mostradas suas iniciais.';
      document.body.classList.add('sqf-client-layout');
      $('providerAsideBrand').hidden=true;
      $('clientInfo').hidden=false;
      $('clientAccountBadge').hidden=false;
      const mainColumn=$('accountSharedGrid').querySelector('.dashboard-main-col');
      mainColumn.prepend($('clientDashboard'));
      $('accountSummaryCard').after($('profileSettings'),$('clientDashboard'));
      $('privacyRequestCard').before($('clientPrivacySection'));
      $('clientLogoutSlot').append($('logoutButton'));
      syncClientSidebar();
      $('profileSettings').querySelector('h2').textContent='Editar meu perfil';
      const cityLabel=$('profileCity')?.closest('[data-city-picker]')?.querySelector('.city-picker-label');
      if(cityLabel)cityLabel.textContent='Minha cidade';
      await window.SQFClientDashboard.init(client,user);
    }
    $('avatarFile').addEventListener('change',()=>{
      clearTimeout(portraitDebounce);
      ++portraitVersion;
      preparedPortrait=null;
      $('portraitDeclaration').checked=false;
      $('portraitDeclarationLabel').hidden=true;
      $('portraitCandidateBox').hidden=true;
      if(portraitPreviewUrl){URL.revokeObjectURL(portraitPreviewUrl);portraitPreviewUrl=null;}
      const file=$('avatarFile').files?.[0];
      if(!file){
        portraitBusy=false;
        showPreparedPortrait(null);
        announce('portraitMessage','');
        return;
      }
      for(const [id,value] of [['portraitZoom','100'],['portraitPanX','50'],['portraitPanY','50']])$(id).value=value;
      updatePortraitControlLabels();
      preparePortrait(file);
    });
    for(const id of ['portraitZoom','portraitPanX','portraitPanY']) {
      $(id)?.addEventListener('input',schedulePortraitPreview);
    }
    $('portraitReset')?.addEventListener('click',()=>{
      for(const [id,value] of [['portraitZoom','100'],['portraitPanX','50'],['portraitPanY','50']])$(id).value=value;
      schedulePortraitPreview();
    });
    $('portraitDiscard')?.addEventListener('click',discardPortraitSelection);
    updatePortraitControlLabels();
    $('profileForm').addEventListener('submit',async(event)=>{
      event.preventDefault();
      const fullName=$('profileFullName').value.trim();
      const selectedCity=cityPicker?.getSelected();
      if (!selectedCity) {
        cityPicker?.validate();
        announce('profileMessage','Selecione uma cidade válida na lista antes de salvar.',true);
        return;
      }
      const city=window.SQFCities.format(selectedCity);
      const bio=$('profileBio').value.trim();
      const publish=$('profilePublic').checked && profile.account_type==='prestador';
      const selectedAvatar=$('avatarFile').files?.[0];
      // Salvar imediatamente depois de mover um controle conclui a última
      // conversão antes do upload, sem exigir um segundo clique.
      if(selectedAvatar && (portraitBusy || !preparedPortrait || preparedPortrait.source!==selectedAvatar)){
        clearTimeout(portraitDebounce);
        announce('profileMessage','Finalizando o enquadramento da fotografia...');
        await preparePortrait(selectedAvatar);
      }
      if(selectedAvatar && (!preparedPortrait || preparedPortrait.source!==selectedAvatar)){
        announce('profileMessage','Não foi possível preparar essa fotografia. Selecione-a novamente.',true);
        return;
      }
      if(selectedAvatar && profile.account_type==='prestador' && !$('portraitDeclaration').checked){
        announce('profileMessage','Confirme a declaração sobre a fotografia antes de salvar o perfil profissional.',true);
        $('portraitDeclaration').focus();
        return;
      }
      if(fullName.length<2 || fullName.length>120 || city.length>100 || bio.length>1500){announce('profileMessage','Confira os tamanhos dos campos.',true);return;}
      if(publish){
        if(!profile.avatar_path && !$('avatarFile').files[0]){announce('profileMessage','Para publicar, adicione sua foto de perfil.',true);return;}
        const {data:services,error}=await client.from('provider_services').select('id').eq('provider_id',user.id).limit(1);
        if(error) {announce('profileMessage','Não foi possível validar os serviços cadastrados.',true);return;}
        if(!services?.length || bio.length<40){announce('profileMessage','Para solicitar publicação, cadastre pelo menos um serviço e uma apresentação de 40 caracteres.',true);return;}
      }
      const button=$('saveProfile');button.disabled=true;
      try{
        const file=$('avatarFile').files[0];
        const oldAvatar=profile.avatar_path;
        let avatarPath=profile.avatar_path;
        const avatarBucket=profile.account_type==='cliente'?'sqf-client-avatars':'sqf-avatars';
        if(file)avatarPath=await imageUpload(preparedPortrait.blob,avatarBucket);
        const {data:updated,error}=await client.from('profiles').update({full_name:fullName,city,city_ibge:selectedCity.id,bio,avatar_path:avatarPath,is_public:publish})
          .eq('id',user.id).select('id,full_name,account_type,city,city_ibge,bio,avatar_path,is_public').single();
        if(error){if(file && avatarPath)await client.storage.from(avatarBucket).remove([avatarPath]);throw error;}
        profile=updated;updateReadiness();
        if(file && oldAvatar && oldAvatar!==avatarPath){
          const {error:removeError}=await client.storage.from(avatarBucket).remove([oldAvatar]);
          if(removeError)console.warn('Avatar antigo não removido:',removeError.message);
        }
        $('accountName').textContent=updated.full_name;
        await renderOwnAvatar();
        void window.SQFAccountNavigation?.refresh();
        $('avatarFile').value='';
        $('portraitDeclaration').checked=false;
        $('portraitDeclarationLabel').hidden=true;
        $('portraitCandidateBox').hidden=true;
        showPreparedPortrait(null);
        preparedPortrait=null;
        if(portraitPreviewUrl){URL.revokeObjectURL(portraitPreviewUrl);portraitPreviewUrl=null;}
        if(profile.account_type==='prestador'){
          const link=$('myPublicProfile');link.href=`prestador.html?id=${encodeURIComponent(user.id)}`;await loadVerification();
        }
        announce('profileMessage',profile.account_type==='prestador'
          ? 'Informações salvas. A publicação dependerá de aprovação administrativa.'
          : 'Seus dados pessoais foram atualizados.');
      }catch(error){console.warn(error?.message);announce('profileMessage',error?.message?.includes('Escolha uma imagem')?error.message:'Não foi possível salvar o perfil.',true);}
      finally{button.disabled=false;}
    });
    $('addServiceForm').addEventListener('submit',async(event)=>{
      event.preventDefault();
      const categoryId=$('newServiceCategory').value;
      const title=$('newServiceTitle').value.trim();
      const description=$('newServiceDescription').value.trim();
      if(!ui.validId(categoryId)||title.length<3||title.length>100||description.length>500){announce('serviceMessage','Escolha uma categoria válida e informe um título de 3 a 100 caracteres.',true);return;}
      const btn=$('addServiceBtn');btn.disabled=true;
      try{
        const {error}=await client.from('provider_services').insert({provider_id:user.id,category_id:categoryId,service_title:title,description});
        if(error)throw error;
        $('newServiceTitle').value='';$('newServiceDescription').value='';
        announce('serviceMessage','Serviço adicionado. A aprovação anterior pode precisar de nova análise.');await loadServices();await loadVerification();
      }catch(error){console.warn(error?.message);announce('serviceMessage','Não foi possível adicionar. Verifique se o serviço já existe.',true);}
      finally{btn.disabled=false;}
    });
    $('addPhotoForm').addEventListener('submit',async(event)=>{
      event.preventDefault();
      const file=$('portfolioFile').files?.[0];const caption=$('portfolioCaption').value.trim();
      if(!file || caption.length>160){announce('galleryMessage','Selecione uma imagem válida e uma legenda de até 160 caracteres.',true);return;}
      const button=$('addPhotoBtn');button.disabled=true;
      let path;
      try{
        path=await imageUpload(file,'sqf-portfolios');
        const {error}=await client.from('portfolio_photos').insert({provider_id:user.id,storage_path:path,caption});
        if(error)throw error;
        $('portfolioFile').value='';$('portfolioCaption').value='';
        announce('galleryMessage','Imagem adicionada. A aprovação anterior pode precisar de nova análise.');await loadPhotos();await loadVerification();
      }catch(error){if(path)await client.storage.from('sqf-portfolios').remove([path]);console.warn(error?.message);announce('galleryMessage',error?.message?.includes('Escolha uma imagem')?error.message:'Não foi possível enviar a foto.',true);}
      finally{button.disabled=false;}
    });
  }catch(error){status.textContent=ui.message(error);}
})();
