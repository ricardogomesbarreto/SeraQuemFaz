'use strict';
(async () => {
  const ui = window.SQFProfiles;
  const providerId = new URLSearchParams(location.search).get('id');
  const status = document.getElementById('providerStatus');
  const content = document.getElementById('providerContent');
  const $ = id => document.getElementById(id);
  const feedback = (id, message) => { $(id).textContent = message; };
  function setupProfileTabs() {
    const tabs=[...document.querySelectorAll('[data-profile-tab]')];
    const select=(active, focus=false)=>{
      for(const tab of tabs){
        const selected=tab===active;
        tab.setAttribute('aria-selected',String(selected));
        tab.tabIndex=selected?0:-1;
        const panel=document.getElementById(tab.getAttribute('aria-controls'));
        if(panel)panel.hidden=!selected;
      }
      if(focus)active.focus();
    };
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>select(tab));
      tab.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
          (index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        select(tabs[next],true);
      });
    });
    if(tabs.length)select(tabs[0]);
  }
  setupProfileTabs();
  if (!ui.validId(providerId)) { status.textContent = 'Perfil inválido. Escolha um profissional no catálogo.'; return; }
  try {
    const client = window.getSQFClient();
    const [{ data: profile, error: pe }, {data: authData}] = await Promise.all([
      client.from('profiles').select('id,full_name,city,bio,avatar_path,account_type,is_public').eq('id',providerId).eq('account_type','prestador').maybeSingle(),
      client.auth.getUser()
    ]);
    if (pe) throw pe;
    if (!profile) { status.textContent='Perfil não encontrado, não aprovado ou indisponível.'; return; }
    const authUser = authData?.user || null;
    const viewingOwnProfile=authUser?.id===providerId;
    if(viewingOwnProfile){
      // A política RLS libera a prévia ao proprietário, mesmo sem aprovação.
      // A disponibilidade PÚBLICA é consultada com a mesma função usada nas RLS.
      // Em caso de falha, nunca assumir que o perfil está publicado.
      let publiclyVisible=false;
      try{
        const {data,error}=await client.rpc('sqf_provider_public',{p_provider:providerId});
        publiclyVisible=!error&&data===true;
      }catch{ /* Sem resposta, manter a indicação conservadora de prévia privada. */ }
      if(!publiclyVisible){
        const notice=$('sqfOwnerPreviewNotice');
        if(notice)notice.hidden=false;
        $('providerTrustStatus').textContent='Prévia somente para sua conta: a publicação pública ainda não foi autorizada.';
      }
    }
    if(authUser?.id && authUser.id!==providerId){
      // Contagem única de visitantes autenticados por dia, sem rastreamento anônimo.
      void client.rpc('sqf_register_profile_view',{p_provider:providerId}).then(()=>{},()=>{});
    }
    const [{data: services,error: se},{data: photos,error: fe},{data: reviews,error: re}] = await Promise.all([
      client.from('provider_services').select('id,category_id,service_title,description,price_min_cents,price_max_cents,is_active').eq('provider_id',providerId).eq('is_active',true).order('service_title'),
      client.from('portfolio_photos').select('id,storage_path,caption,service_id,is_cover').eq('provider_id',providerId).order('is_cover',{ascending:false}).order('created_at',{ascending:false}),
      client.rpc('sqf_public_reviews',{p_provider_ids:[providerId]})
    ]);
    if (se || fe || re) throw se || fe || re;
    const publishedReviews = reviews || [];
    let publicResponses=[];
    if(publishedReviews.length){
      try{
        const {data:responseData,error:responseError}=await client.rpc('sqf_public_review_responses',{
          p_review_ids:publishedReviews.map(item=>item.id)
        });
        if(!responseError)publicResponses=responseData||[];
        else console.warn('Respostas de prestadores indisponíveis; verificar migração v3.6.0.');
      }catch{console.warn('Não foi possível consultar as respostas moderadas.');}
    }
    document.title = `${profile.full_name} | SERÁ QUEM FAZ?`;
    $('providerName').textContent=profile.full_name;
    $('providerCity').textContent=profile.city ? `Atendimento informado: ${profile.city}` : 'Cidade não informada';
    $('providerBio').textContent=profile.bio || 'Este profissional ainda não cadastrou sua apresentação.';
    $('profileAboutCopy').textContent=profile.bio || 'Este profissional ainda não publicou sua apresentação.';
    $('providerAvatar').replaceWith(ui.avatar(client,profile.avatar_path,profile.full_name,'avatar-large'));
    $('providerRating').replaceWith(ui.ratingLine(publishedReviews));
    if(!$('sqfOwnerPreviewNotice')?.hidden){
      $('providerTrustStatus').textContent='Prévia somente para sua conta: clientes ainda não podem ver este perfil.';
    }else{
      $('providerTrustStatus').textContent='Cadastro aprovado para exibição pública · A análise não garante idoneidade, qualificação ou segurança.';
    }
    try{
      const {data:completed,error:completedError}=await client.rpc('sqf_provider_completed_count',{p_provider:providerId});
      if(!completedError&&Number.isInteger(completed)){
        $('sqfCompletedProviderCount').hidden=false;
        $('sqfCompletedProviderCount').textContent=`${completed} ${completed===1?'atendimento confirmado':'atendimentos confirmados'} pelo fluxo de solicitações da plataforma. Não substitui verificação independente.`;
      }
    }catch{console.warn('Indicador de atendimentos ainda não implantado.');}
    // Perfil complementar fica público somente se aprovado (RLS).
    // Falha de migração não deve bloquear as páginas e os demais serviços.
    try {
      const {data:professional,error:professionalError}=await client.from('provider_professional_details')
        .select('professional_title,specialties,experience_years,service_mode,coverage_area,workdays,work_period,quote_policy,professional_website')
        .eq('provider_id',providerId).maybeSingle();
      if(!professionalError && professional){
        const helpers=window.SQFProfessionalDetails;
        const headline=$('providerProfessionalTitle');
        if(professional.professional_title?.trim()){
          headline.textContent=professional.professional_title;
          headline.hidden=false;
        }
        const facts=$('providerProfessionalFacts');
        const addFact=(label,value)=>{
          if(value===null || value===undefined || !String(value).trim())return;
          const container=ui.make('div','professional-fact');
          container.append(ui.make('dt','',label),ui.make('dd','',String(value)));
          facts.append(container);
        };
        addFact('Especialidades informadas',professional.specialties);
        if(Number.isInteger(professional.experience_years))addFact('Experiência declarada',`${professional.experience_years} anos`);
        if(professional.service_mode && professional.service_mode!=='nao_informado')
          addFact('Modalidade de atendimento',helpers.MODES[professional.service_mode]||'');
        addFact('Regiões atendidas',professional.coverage_area);
        const days=helpers.normalizeDays(professional.workdays);
        if(days.length)addFact('Dias habituais',days.map(day=>helpers.WORKDAY_LABELS[day]).join(', '));
        if(professional.work_period && professional.work_period!=='nao_informado')
          addFact('Turno habitual',helpers.PERIODS[professional.work_period]||'');
        if(professional.quote_policy && professional.quote_policy!=='sob_consulta')
          addFact('Condição do orçamento',helpers.QUOTES[professional.quote_policy]||'');
        const website=helpers.allowedUrl(professional.professional_website);
        if(website){
          const link=ui.make('a','text-link',`Abrir site profissional externo (${new URL(website).hostname})`);
          link.href=website;link.target='_blank';link.rel='noopener noreferrer nofollow';
          link.referrerPolicy='no-referrer';
          const item=ui.make('div','professional-fact');
          item.append(ui.make('dt','','Site informado pelo prestador'));
          const dd=ui.make('dd');dd.append(link);item.append(dd);facts.append(item);
        }
        if(facts.childElementCount)facts.hidden=false;
      }
    }catch{console.warn('Informações profissionais complementares indisponíveis.');}


    const serviceBox=$('providerServices');
    const catIds=[...new Set((services || []).map(s=>s.category_id))];
    let categories=[];
    if(catIds.length){
      const {data,error}=await client.from('categories').select('id,name,status').in('id',catIds);
      if(error)throw error;categories=data||[];
    }
    if(!services?.length)ui.state(serviceBox,'Nenhum serviço cadastrado');
    else for(const service of services){
      const tile=ui.make('article','service-detail-item');tile.append(ui.make('h3','',service.service_title));
      const category=categories.find(c=>String(c.id)===service.category_id);
      if(category){const link=ui.make('a','category-detail-link',category.name);link.href=`categoria.html?id=${encodeURIComponent(service.category_id)}`;tile.append(link);}
      if(service.description)tile.append(ui.make('p','muted',service.description));
      if(service.price_min_cents!==null && service.price_max_cents!==null){
        const format=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(x)/100);
        tile.append(ui.make('p','sqf-price-note',
          'Estimativa declarada: '+format(service.price_min_cents)+' a '+format(service.price_max_cents)));
        tile.append(ui.make('small','muted','Valor orientativo; confirme o orçamento diretamente com o profissional.'));
      }
      serviceBox.append(tile);
    }
    const gallery=$('providerGallery');
    const portfolioFilter=$('sqfPublicPortfolioService');
    if(portfolioFilter){
      for(const service of services||[]){
        if(!(photos||[]).some(photo=>photo.service_id===service.id))continue;
        const option=ui.make('option','',service.service_title);option.value=service.id;portfolioFilter.append(option);
      }
    }
    const visiblePhotos=(photos||[]).filter(photo=>!photo.service_id||
      (services||[]).some(service=>service.id===photo.service_id));
    if(!visiblePhotos.length)ui.state(gallery,'Sem fotos publicadas','O prestador ainda não adicionou trabalhos visíveis.');
    for(const photo of visiblePhotos){
      const uri=ui.publicUrl(client,'sqf-portfolios',photo.storage_path);if(!uri)continue;
      const figure=ui.make('figure','portfolio-photo');
      const full=ui.make('a','portfolio-full-link');full.href=uri;full.target='_blank';full.rel='noopener noreferrer';
      full.setAttribute('aria-label',`Abrir foto: ${photo.caption || 'trabalho publicado'}`);
      full.append(ui.safeImg(uri,photo.caption || `Trabalho de ${profile.full_name}`));figure.append(full);
      if(photo.caption)figure.append(ui.make('figcaption','',photo.caption));
      if(photo.is_cover)figure.append(ui.make('span','sqf-portfolio-cover-badge','★ Foto de capa'));
      const linked=(services||[]).find(service=>service.id===photo.service_id);
      if(linked)figure.append(ui.make('small','sqf-portfolio-category',linked.service_title));
      figure.dataset.serviceId=photo.service_id||'';
      gallery.append(figure);
    }
    portfolioFilter?.addEventListener('change',()=>{
      for(const photo of gallery.querySelectorAll('.portfolio-photo'))
        photo.hidden=Boolean(portfolioFilter.value && photo.dataset.serviceId!==portfolioFilter.value);
    });
    const revBox=$('providerReviews');
    const breakdown=$('ratingBreakdown');
    const summary=$('ratingSummary');
    const total=publishedReviews.length;
    if(total){
      const avg=publishedReviews.reduce((acc,item)=>acc+Number(item.rating||0),0)/total;
      summary.append(ui.stars(avg),ui.make('strong','',`${avg.toFixed(1).replace('.',',')} de 5`),ui.make('span','muted',`${total} ${total===1?'avaliação publicada':'avaliações publicadas'}`));
    } else summary.append(ui.make('strong','','Ainda sem notas publicadas'),ui.make('span','muted','A nota é exibida somente quando há avaliações moderadas.'));
    if(!publishedReviews.length)ui.state(revBox,'Sem avaliações publicadas','Apenas avaliações de atendimentos confirmados e moderados são exibidas.');
    else {
      breakdown.append(ui.make('h3','','Distribuição das notas'));
      for(let score=5;score>=1;score--){
        const count=publishedReviews.filter(item=>Number(item.rating)===score).length;
        const line=ui.make('div','rating-distribution-row');
        const bar=ui.make('progress');bar.max=publishedReviews.length;bar.value=count;
        bar.setAttribute('aria-label',`${count} avaliações de ${score} estrelas`);
        line.append(ui.make('span','',`${score} ★`),bar,ui.make('span','',count));breakdown.append(line);
      }
      $('reviewFilters').hidden=false;
      function renderReviewCards(){
        revBox.replaceChildren();
        const chosen=Number($('reviewStarFilter').value);
        const order=$('reviewSort').value;
        const ordered=publishedReviews.filter(r=>!chosen || Number(r.rating)===chosen).slice().sort((a,b)=>{
          if(order==='high'||order==='low')return (Number(a.rating)-Number(b.rating))*(order==='high'?-1:1);
          const da=Date.parse(a.created_at||0)||0, db=Date.parse(b.created_at||0)||0;
          return (db-da)*(order==='old'?-1:1);
        });
        if(!ordered.length){ui.state(revBox,'Nenhuma avaliação com essa nota','Experimente selecionar todas as notas.');return;}
      for(const review of ordered){
        const article=ui.make('article','review-card'),top=ui.make('div','review-top');
        top.append(ui.stars(review.rating),ui.make('span','muted',new Date(review.created_at).toLocaleDateString('pt-BR')));
        article.append(top,ui.make('p','',review.comment));
        const confirmation=ui.make('small','review-confirmation','✓ Atendimento declarado por ambas as contas · Avaliação moderada');
        confirmation.title='A confirmação das contas não constitui prova independente da contratação.';
        article.append(confirmation);
        const response=publicResponses.find(entry=>String(entry.review_id)===String(review.id));
        if(response){
          const reply=ui.make('div','provider-response');
          reply.append(ui.make('strong','','Resposta pública do prestador (moderada)'),ui.make('p','',response.message));
          article.append(reply);
        }
        revBox.append(article);
      }
      }
      $('reviewStarFilter').addEventListener('change',renderReviewCards);
      $('reviewSort').addEventListener('change',renderReviewCards);
      renderReviewCards();
    }
    const eligibility=$('reviewEligibility');
    if(!authUser){
      eligibility.textContent='Entre na sua conta para solicitar confirmação de atendimento, avaliar ou denunciar.';
      const link=ui.make('a','text-link','Entrar');link.href='entrar.html';eligibility.append(' ',link);
    } else if(authUser.id === providerId){
      eligibility.textContent='Você não pode avaliar ou denunciar seu próprio perfil.';
    } else {
      const {data: me,error: em}=await client.from('profiles').select('account_type').eq('id',authUser.id).maybeSingle();
      if(em)throw em;
      $('reportForm').hidden=false;
      $('reportForm').addEventListener('submit',async(event)=>{
        event.preventDefault();const reason=$('reportReason').value,details=$('reportDetails').value.trim();
        if(!reason || details.length<20 || details.length>1200){feedback('reportMessage','Informe o motivo e descreva a situação com 20 a 1200 caracteres, sem dados sensíveis.');return;}
        const btn=$('reportSubmit');btn.disabled=true;
        try{
          const {error}=await client.from('safety_reports').insert({reporter_id:authUser.id,provider_id:providerId,reason,details});
          if(error)throw error;
          feedback('reportMessage','Denúncia enviada para análise da equipe. Não há suspensão automática.');
          $('reportForm').reset();
        }catch{feedback('reportMessage','Não foi possível registrar a denúncia. Verifique se já enviou uma deste tipo.');}
        finally{btn.disabled=false;}
      });
      if(me?.account_type!=='cliente')eligibility.textContent='Somente contas de cliente podem solicitar confirmação de atendimento e avaliar.';
      else {
        const favBox=$('providerFavoriteBox'),favButton=$('providerFavoriteButton'),favStatus=$('providerFavoriteStatus');
        favBox.hidden=false;
        let isFavorite=false;
        try{
          const {data:existing,error:favError}=await client.from('sqf_client_favorites')
            .select('provider_id').eq('client_id',authUser.id).eq('provider_id',providerId).maybeSingle();
          if(favError)throw favError;
          isFavorite=Boolean(existing);
          const updateLabel=()=>{
            favButton.textContent=isFavorite?'Remover dos favoritos':'Salvar favorito';
            favButton.setAttribute('aria-pressed',String(isFavorite));
          };
          updateLabel();
          favButton.addEventListener('click',async()=>{
            favButton.disabled=true;favStatus.textContent='Salvando preferência...';
            try{
              const result=isFavorite
                ? await client.from('sqf_client_favorites').delete().eq('client_id',authUser.id).eq('provider_id',providerId)
                : await client.from('sqf_client_favorites').insert({client_id:authUser.id,provider_id:providerId});
              if(result.error)throw result.error;
              isFavorite=!isFavorite;updateLabel();
              favStatus.textContent=isFavorite?'Profissional salvo em Minha Conta.':'Profissional removido dos favoritos.';
            }catch{
              favStatus.textContent='Não foi possível atualizar seus favoritos. Confira a configuração do Supabase.';
            }finally{favButton.disabled=false;}
          });
        }catch{
          favButton.hidden=true;
          favStatus.textContent='Favoritos indisponíveis: é necessário aplicar a migração v3.7.0.';
        }

        const {data:engagement,error:ee}=await client.rpc('sqf_my_engagement',{p_provider:providerId});
        if(ee)throw ee;
        if(!engagement){
          eligibility.textContent='Após receber um serviço, solicite ao prestador a confirmação do atendimento.';
          $('engagementRequest').hidden=false;
          $('engagementRequest').addEventListener('click',async()=>{
            const button=$('engagementRequest');button.disabled=true;
            try{
              const {error}=await client.from('service_engagements').insert({client_id:authUser.id,provider_id:providerId});
              if(error)throw error;
              button.hidden=true;eligibility.textContent='Solicitação registrada. Aguarde o prestador confirmar o atendimento na conta dele.';
            }catch{feedback('reviewMessage','Não foi possível solicitar a confirmação. Tente mais tarde.');}
            finally{button.disabled=false;}
          });
        } else if(engagement.status!=='confirmed'){
          eligibility.textContent='Atendimento solicitado. O prestador ainda precisa confirmar.';
        } else {
          const {data:mine,error:mineError}=await client.from('reviews')
            .select('id,moderation_status').eq('reviewer_id',authUser.id).eq('provider_id',providerId).maybeSingle();
          if(mineError)throw mineError;
          if(mine){
            eligibility.textContent=mine.moderation_status==='published'
              ? 'Você já avaliou este atendimento. A avaliação publicada é definitiva.'
              : 'Sua avaliação foi recebida e aguarda análise da equipe, ou foi retida pela moderação.';
          } else {
            eligibility.textContent='Atendimento confirmado por ambas as contas. Você pode enviar uma avaliação para moderação.';
            const form=$('reviewForm');form.hidden=false;
            form.addEventListener('submit',async(event)=>{
              event.preventDefault();
              const rating=Number($('reviewRating').value),comment=$('reviewComment').value.trim();
              if(!Number.isInteger(rating)||rating<1||rating>5||comment.length<15||comment.length>1500||!$('reviewDeclaration').checked){
                feedback('reviewMessage','Selecione 1 a 5 estrelas, escreva 15 a 1500 caracteres e confirme sua declaração. Não inclua informações pessoais.');return;
              }
              const button=$('reviewSubmit');button.disabled=true;
              try{
                const {error}=await client.from('reviews').insert({provider_id:providerId,reviewer_id:authUser.id,engagement_id:engagement.id,rating,comment});
                if(error)throw error;
                form.hidden=true;eligibility.textContent='Avaliação recebida. Após moderação, a nota e o comentário poderão aparecer publicamente.';
              }catch{feedback('reviewMessage','Não foi possível enviar a avaliação. Evite links, e-mails e dados pessoais; pode haver limite de três avaliações em 24 horas.');}
              finally{button.disabled=false;}
            });
          }
        }
      }
    }
    try{await window.SQFRequestProfile?.setup(client,authUser,providerId,services||[]);}catch(error){console.warn('Formulário de orçamento indisponível:',error?.message);}
    content.hidden=false;status.hidden=true;
  }catch(error){status.textContent=ui.message(error);}
})();
