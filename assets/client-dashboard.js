'use strict';
/* Painel do cliente. Nenhum dado de terceiros é inserido via innerHTML.
   A autorização sobre linhas e favoritos é aplicada pelo Supabase/Postgres, não neste arquivo. */
(() => {
  const ui = window.SQFProfiles;
  const $ = id => document.getElementById(id);
  const MAX_ITEMS = 50;
  const statuses = Object.freeze({
    requested: 'Aguardando confirmação do prestador',
    confirmed: 'Atendimento confirmado',
    pending: 'Aguardando moderação',
    published: 'Avaliação publicada',
    rejected: 'Avaliação não publicada',
    hidden: 'Avaliação oculta pela moderação'
  });
  const humanDate = value => {
    const parsed=Date.parse(value || '');
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString('pt-BR') : 'Data indisponível';
  };
  const label = key => statuses[key] || 'Situação em análise';
  const providerHref = id => ui.validId(id) ? `prestador.html?id=${encodeURIComponent(id)}` : null;
  const short = (value, maximum=450) => String(value ?? '').slice(0,maximum);
  function entry(title, detail, link, linkLabel='Ver perfil') {
    const row=ui.make('article','client-activity-row');
    row.append(ui.make('strong','',title));
    if(detail)row.append(ui.make('p','muted',detail));
    if(link){const a=ui.make('a','text-link',linkLabel);a.href=link;row.append(a);}
    return row;
  }
  const isUnreviewed = (engagement, reviewedIds) => engagement.status === 'confirmed' && !reviewedIds.has(engagement.id);
  const summary = (engagements, reviews, favorites) => {
    const reviewedIds = new Set(reviews.map(r => r.engagement_id).filter(Boolean));
    return {
      requested: engagements.filter(e=>e.status==='requested').length,
      confirmed: engagements.filter(e=>e.status==='confirmed').length,
      toReview: engagements.filter(e=>isUnreviewed(e,reviewedIds)).length,
      favorites: favorites.length
    };
  };
  async function fetchSafe(client) {
    // RLS restringe os atendimentos e as avaliações ao próprio usuário.
    // Sem filtro por client_id/reviewer_id: essa coluna não possui SELECT público.
    const [engagementsResult,reviewsResult,favoritesResult,privacyResult] = await Promise.all([
      client.from('service_engagements').select('id,provider_id,status,requested_at,confirmed_at').order('requested_at',{ascending:false}).limit(MAX_ITEMS),
      client.from('reviews').select('id,provider_id,engagement_id,rating,comment,created_at,moderation_status').order('created_at',{ascending:false}).limit(MAX_ITEMS),
      client.from('sqf_client_favorites').select('provider_id,created_at').order('created_at',{ascending:false}).limit(MAX_ITEMS),
      client.from('privacy_requests').select('id,request_type,status,created_at').order('created_at',{ascending:false}).limit(12)
    ]);
    for(const result of [engagementsResult,reviewsResult])if(result.error)throw result.error;
    const unavailable={favorites:Boolean(favoritesResult.error),privacy:Boolean(privacyResult.error)};
    const engagements=engagementsResult.data||[];
    const reviews=reviewsResult.data||[];
    const favorites=favoritesResult.data||[];
    const privacy=privacyResult.data||[];
    const ids=[...new Set([...engagements,...reviews,...favorites].map(item=>item.provider_id).filter(ui.validId))].slice(0,100);
    let profiles=[];
    if(ids.length){
      const {data,error}=await client.from('profiles').select('id,full_name,city').in('id',ids).eq('account_type','prestador').eq('is_public',true);
      if(error)throw error;
      profiles=data||[];
    }
    return {engagements,reviews,favorites,privacy,profiles,unavailable};
  }
  function display(model, client, user) {
    const names=new Map(model.profiles.map(item=>[item.id,item]));
    const reviewedIds=new Set(model.reviews.map(r=>r.engagement_id).filter(Boolean));
    const stats=summary(model.engagements,model.reviews,model.favorites);
    for(const [id,count] of [['clientStatRequested',stats.requested],['clientStatConfirmed',stats.confirmed],['clientStatToReview',stats.toReview],['clientStatFavorites',model.unavailable?.favorites?'—':stats.favorites]])$(id).textContent=String(count);
    const engagementsBox=$('clientEngagements');engagementsBox.replaceChildren();
    if(!model.engagements.length)ui.state(engagementsBox,'Nenhum atendimento registrado','Após receber um serviço, solicite a confirmação no perfil público do prestador.');
    for(const e of model.engagements){
      const provider=names.get(e.provider_id),title=provider?.full_name||'Profissional indisponível';
      const detail=`${label(e.status)} · Solicitado em ${humanDate(e.requested_at)}${e.status==='confirmed'&&e.confirmed_at?` · Confirmado em ${humanDate(e.confirmed_at)}`:''}`;
      const href=provider?providerHref(e.provider_id):null;
      const row=entry(title,detail,href,e.status==='confirmed'&&!reviewedIds.has(e.id)?'Abrir perfil para avaliar':'Ver perfil');
      engagementsBox.append(row);
    }
    const todoBox=$('clientReviewTodo');todoBox.replaceChildren();
    const todo=model.engagements.filter(item=>isUnreviewed(item,reviewedIds));
    if(!todo.length)ui.state(todoBox,'Nenhuma avaliação pendente','Quando um atendimento for confirmado, a opção de avaliar aparecerá aqui.');
    for(const e of todo){
      const provider=names.get(e.provider_id);
      todoBox.append(entry(provider?.full_name||'Prestador indisponível','Atendimento confirmado · Avaliação ainda não enviada',provider?providerHref(e.provider_id):null,'Avaliar atendimento'));
    }
    const reviewsBox=$('clientReviews');reviewsBox.replaceChildren();
    if(!model.reviews.length)ui.state(reviewsBox,'Você ainda não enviou avaliações','Comentários somente ficam públicos após análise da equipe.');
    for(const review of model.reviews){
      const provider=names.get(review.provider_id);
      const row=entry(provider?.full_name||'Prestador indisponível', `${label(review.moderation_status)} · ${humanDate(review.created_at)}`,provider?providerHref(review.provider_id):null);
      row.append(ui.stars(review.rating),ui.make('p','client-comment',short(review.comment)));
      reviewsBox.append(row);
    }
    const favoritesBox=$('clientFavorites');favoritesBox.replaceChildren();
    if(model.unavailable?.favorites)ui.state(favoritesBox,'Favoritos ainda indisponíveis','É necessário aplicar a migração v3.7.0 no Supabase de homologação.');
    else if(!model.favorites.length)ui.state(favoritesBox,'Nenhum profissional salvo','Abra o perfil de um profissional e selecione “Salvar favorito”.');
    for(const favorite of model.favorites){
      const professional=names.get(favorite.provider_id);
      const row=entry(professional?.full_name||'Profissional indisponível',professional?.city||'Perfil atualmente indisponível',professional?providerHref(favorite.provider_id):null);
      const remove=ui.make('button','button button-outline button-small','Remover dos favoritos');remove.type='button';
      remove.setAttribute('aria-label',`Remover ${professional?.full_name||'profissional'} dos favoritos`);
      remove.addEventListener('click',async()=>{
        remove.disabled=true;
        const {error}=await client.from('sqf_client_favorites').delete().eq('client_id',user.id).eq('provider_id',favorite.provider_id);
        if(error){remove.disabled=false;$('clientDashboardMessage').textContent='Não foi possível remover o favorito.';return;}
        await refresh(client,user);
      });
      row.append(remove);favoritesBox.append(row);
    }
    const privacyBox=$('clientPrivacyRequests');privacyBox.replaceChildren();
    const types={access:'Acesso aos dados',correction:'Correção de dados',deletion:'Exclusão de dados',portability:'Portabilidade'};
    if(model.unavailable?.privacy)ui.state(privacyBox,'Histórico de privacidade indisponível','Verifique a migração de segurança de dados no Supabase.');
    else if(!model.privacy.length)ui.state(privacyBox,'Nenhuma solicitação registrada','Se precisar, você pode fazer um pedido de privacidade abaixo.');
    for(const request of model.privacy) privacyBox.append(entry(types[request.request_type]||'Solicitação de privacidade',`${label(request.status)} · ${humanDate(request.created_at)}`));
    const updates=$('clientUpdates');updates.replaceChildren();
    const pendingReview=model.reviews.filter(r=>r.moderation_status==='pending').length;
    const pendingPrivacy=model.privacy.filter(r=>r.status==='pending'||r.status==='reviewing').length;
    const notes=[];
    if(stats.requested)notes.push(`${stats.requested} confirmação(ões) de atendimento aguardando resposta.`);
    if(stats.toReview)notes.push(`${stats.toReview} atendimento(s) confirmado(s) aguardando sua avaliação.`);
    if(pendingReview)notes.push(`${pendingReview} avaliação(ões) em moderação.`);
    if(pendingPrivacy)notes.push(`${pendingPrivacy} solicitação(ões) de privacidade em análise.`);
    if(!notes.length)ui.state(updates,'Nenhuma pendência identificada','Os registros serão consultados novamente quando você atualizar o painel.');
    else for(const note of notes)updates.append(entry('Acompanhamento',note));
  }
  async function refresh(client,user) {
    const button=$('clientRefresh');if(button)button.disabled=true;
    $('clientDashboardMessage').textContent='Atualizando os dados da sua conta...';
    try{
      const model=await fetchSafe(client);
      display(model,client,user);
      $('clientDashboardMessage').textContent='Informações atualizadas. As mudanças não chegam por notificação automática.';
    }catch(error){
      console.warn('Painel do cliente:',error?.message);
      $('clientDashboardMessage').textContent='Não foi possível consultar os dados. Verifique a conexão e aplique a migração v3.7.0 no Supabase de homologação.';
      for(const id of ['clientEngagements','clientReviewTodo','clientReviews','clientFavorites','clientUpdates','clientPrivacyRequests']){
        ui.state($(id),'Dados indisponíveis','Não exibimos informações simuladas como se fossem reais.');
      }
    }finally{if(button)button.disabled=false;}
  }
  function init(client,user){
    $('clientDashboard').hidden=false;
    $('clientRefresh').addEventListener('click',()=>refresh(client,user));
    return refresh(client,user);
  }
  window.SQFClientDashboard=Object.freeze({init,refresh,summary,isUnreviewed,label});
})();
