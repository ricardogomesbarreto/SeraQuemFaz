'use strict';
(async () => {
  const ui = window.SQFProfiles;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const referenceCategory = window.SQFCatalogPreview?.get(params.get('ref')); 
  const cityId = params.get('cidade');
  const state = document.getElementById('categoryStatus');
  const content = document.getElementById('categoryContent');
  const providersError = document.getElementById('providersError');
  const results = document.getElementById('providersList');
  if (!/^\d{7}$/.test(cityId || '')) { state.textContent = 'Selecione uma cidade no catálogo antes de consultar prestadores desta categoria.'; return; }
  if (!referenceCategory && !ui.validId(id)) { state.textContent = 'Categoria inválida. Volte ao catálogo e selecione uma área de serviço.'; return; }
  try {
    const places = await window.SQFCities.load();
    const city = window.SQFCities.byId(cityId);
    if (!city) { state.textContent = 'Cidade não encontrada na base do IBGE. Volte ao catálogo e escolha uma cidade válida.'; return; }
    const context = document.getElementById('categoryCityContext');
    const label = document.createElement('strong'); label.textContent = `Prestadores em ${window.SQFCities.format(city)}`;
    const link = document.createElement('a'); link.href = `categorias.html?cidade=${encodeURIComponent(city.id)}`; link.textContent = 'Trocar cidade →';
    context.replaceChildren(label, link);
    if (referenceCategory) {
      document.title = `${referenceCategory.name} — Área de referência | SERÁ QUEM FAZ?`;
      document.getElementById('categoryName').textContent = referenceCategory.name;
      document.getElementById('categoryDescription').textContent = referenceCategory.description;
      document.getElementById('categorySummary').textContent = window.SQFCategorySummary.forCategory(referenceCategory);
      const imageBox=document.getElementById('categoryImage');
      const missing=() => {
        const box=ui.make('div','detail-image-placeholder');
        box.append(ui.make('span','detail-placeholder-mark',String(referenceCategory.name).charAt(0)),
          ui.make('span','','Foto de referência temporariamente indisponível'));
        imageBox.replaceChildren(box);
      };
      const recovered=window.SQFUtils.categoryImage(referenceCategory);
      if(recovered){
        const photo=ui.safeImg(recovered,`Imagem original registrada para ${referenceCategory.name}`);
        photo.addEventListener('error',missing,{once:true});imageBox.replaceChildren(photo);
      } else missing();
      document.getElementById('categoryProviderCount').textContent = 'Prévia editorial';
      document.getElementById('sqfProviderFilters').hidden = true;
      ui.state(results, 'Área de referência', 'Esta apresentação é ilustrativa. Não há profissionais cadastrados ou avaliações associados a esta prévia. O administrador precisa configurar as categorias públicas no Supabase para disponibilizar a busca real.');
      state.hidden = true; content.hidden = false;
      return;
    }
    const client = window.getSQFClient();
    const { data: category, error: e1 } = await client.from('categories')
      .select('id,name,description,image_url,status').eq('id', id).eq('status','active').maybeSingle();
    if (e1) throw e1;
    if (!category) { state.textContent = 'Categoria não encontrada ou indisponível.'; return; }
    document.title = `${category.name} | SERÁ QUEM FAZ?`;
    document.getElementById('categoryName').textContent = category.name || 'Área de serviço';
    const description = String(category.description || '').trim();
    document.getElementById('categoryDescription').textContent = description || 'Conheça os serviços e profissionais disponíveis nesta área.';
    document.getElementById('categorySummary').textContent = window.SQFCategorySummary.forCategory(category);
    const imageBox = document.getElementById('categoryImage');
    // A mesma URL original de image_url que o catálogo utiliza.
    const cover = window.SQFUtils.categoryImage(category) || window.SQFUtils.safeImageUrl(window.SQFOriginalCategoryImages?.get(category.name));
    const missing = () => {
      const box = ui.make('div', 'detail-image-placeholder');
      const symbol = ui.make('span', 'detail-placeholder-mark', String(category.name || 'S').charAt(0).toLocaleUpperCase('pt-BR'));
      symbol.setAttribute('aria-hidden', 'true');
      box.append(symbol, ui.make('span', '', 'Imagem não cadastrada para esta área'));
      imageBox.replaceChildren(box);
    };
    if (cover) {
      const img = ui.safeImg(cover, `Imagem original da categoria ${category.name}`);
      img.addEventListener('error', missing, { once: true });
      imageBox.replaceChildren(img);
    } else missing();
    state.hidden = true; content.hidden = false;
    try {
    const { data: services, error: e2 } = await client.from('provider_services')
      .select('provider_id,service_title,description').eq('category_id', String(category.id));
    if (e2) throw e2;
    const ids = [...new Set((services || []).map(item => item.provider_id))];
    results.replaceChildren();
    let profiles = [], reviews = [];
    if (ids.length) {
      const [{ data: pro, error: ep }, { data: rev, error: er }] = await Promise.all([
        client.from('profiles').select('id,full_name,city,city_ibge,bio,avatar_path').in('id',ids).eq('account_type','prestador').eq('is_public',true).eq('city_ibge',city.id),
        client.rpc('sqf_public_reviews', { p_provider_ids: ids })
      ]);
      if (ep || er) throw ep || er;
      profiles = pro || []; reviews = rev || [];
    }
    const details = new Map();
    if(ids.length){
      try{
        const {data:professional,error:e}=await client.from('provider_professional_details')
          .select('provider_id,specialties,service_mode').in('provider_id',ids);
        if(!e)for(const detail of professional||[])details.set(detail.provider_id,detail);
      }catch{console.warn('Filtro profissional adicional indisponível');}
    }
    const photoOwners=new Set();
    if(ids.length){
      const {data:photoRows,error:photoError}=await client.from('portfolio_photos')
        .select('provider_id').in('provider_id',ids).limit(1000);
      const control=document.getElementById('sqfOnlyPortfolio');
      if(photoError){if(control)control.disabled=true;}
      else for(const photo of photoRows||[])photoOwners.add(photo.provider_id);
    }
    const cards=[];
    const filterBox=document.getElementById('sqfProviderFilters');
    const specialtyFilter=document.getElementById('sqfSpecialtyFilter');
    const modeFilter=document.getElementById('sqfModeFilter');
    const countFilter=document.getElementById('sqfProviderFilteredCount');
    const sortControl=document.getElementById('sqfProviderSort');
    const photoControl=document.getElementById('sqfOnlyPortfolio');
    const applyFilter=()=>{
      const query=window.SQFUtils.normalize(specialtyFilter.value);
      const mode=modeFilter.value;
      let found=0;
      for(const entry of cards){
        const text=window.SQFUtils.normalize([entry.profile.full_name,entry.profile.bio,
          details.get(entry.profile.id)?.specialties||'',...entry.services].join(' '));
        const serviceMode=details.get(entry.profile.id)?.service_mode||'nao_informado';
        const fitsMode=!mode || serviceMode===mode || (serviceMode==='hibrido'&&['presencial','remoto'].includes(mode));
        const visible=(!query||text.includes(query))&&fitsMode&&
          (!photoControl?.checked||entry.hasPortfolio);
        entry.card.hidden=!visible;if(visible)found++;
      }
      const order=sortControl?.value||'name';
      const ordered=[...cards].sort((a,b)=>{
        const byName=a.profile.full_name.localeCompare(b.profile.full_name,'pt-BR');
        if(order==='rating')return b.rating-a.rating||b.reviewCount-a.reviewCount||byName;
        if(order==='reviews')return b.reviewCount-a.reviewCount||byName;
        if(order==='services')return b.serviceCount-a.serviceCount||byName;
        return byName;
      });
      for(const entry of ordered)results.append(entry.card);
      countFilter.textContent=`${found} de ${cards.length} profissionais encontrados`;
      if(cards.length && !found)countFilter.textContent+=' · Tente ampliar os filtros.';
    };
    if(profiles.length){
      filterBox.hidden=false;
      specialtyFilter.addEventListener('input',applyFilter);
      modeFilter.addEventListener('change',applyFilter);
      sortControl?.addEventListener('change',applyFilter);
      photoControl?.addEventListener('change',applyFilter);
      document.getElementById('sqfProviderFilterClear').addEventListener('click',()=>{
        specialtyFilter.value='';modeFilter.value='';
        if(sortControl)sortControl.value='name';
        if(photoControl)photoControl.checked=false;
        applyFilter();
      });
    }
    document.getElementById('categoryProviderCount').textContent = `${profiles.length} ${profiles.length === 1 ? 'prestador' : 'prestadores'}`;
    if (!profiles.length) ui.state(results,'Nenhum profissional nesta cidade','Ainda não há prestadores com perfil público e esta categoria de serviço em '+ window.SQFCities.format(city) +'.');
    for (const pro of profiles) {
      const card = ui.make('article','provider-card');
      const link = ui.make('a','provider-card-link');
      link.href = `prestador.html?id=${encodeURIComponent(pro.id)}&cidade=${encodeURIComponent(city.id)}`;
      const top = ui.make('div','provider-card-top');
      top.append(ui.avatar(client,pro.avatar_path,pro.full_name));
      const name = ui.make('div');
      const local=pro.city || window.SQFCities.format(city);
      name.append(ui.make('h3','',pro.full_name || 'Profissional'),ui.make('p','provider-card-local',`⌖ ${local}`));
      top.append(name);
      link.append(top);
      const verificationNote=ui.make('span','provider-verification-note','Perfil público · identidade não certificada');
      verificationNote.title='Um perfil público não comprova identidade civil, idoneidade ou qualificação profissional.';
      link.append(verificationNote);
      link.append(ui.ratingLine(reviews.filter(r => r.provider_id === pro.id)));
      link.append(ui.make('p','provider-card-bio', pro.bio || 'Este profissional ainda não incluiu uma apresentação.'));
      const servicesForPro = services.filter(s => s.provider_id === pro.id).map(s => s.service_title).slice(0,3);
      const tags = ui.make('div','service-tags');
      const speciality=ui.make('p','provider-card-speciality',`${servicesForPro.length} ${servicesForPro.length===1?'serviço listado':'serviços listados'} nesta área`);
      link.append(speciality);
      servicesForPro.forEach(title => tags.append(ui.make('span','service-tag',title)));
      link.append(tags,ui.make('span','profile-link-label','Ver perfil, fotos e feedback →'));
      const publicReviews=reviews.filter(r=>r.provider_id===pro.id);
      const rating=publicReviews.length
        ?publicReviews.reduce((total,r)=>total+Number(r.rating||0),0)/publicReviews.length:0;
      const serviceCount=services.filter(s=>s.provider_id===pro.id).length;
      if(photoOwners.has(pro.id))link.append(ui.make('span','sqf-has-portfolio','Portfólio com fotos'));
      card.append(link);results.append(card);
      cards.push({card,profile:pro,services:servicesForPro,rating,
        reviewCount:publicReviews.length,serviceCount,hasPortfolio:photoOwners.has(pro.id)});
    }
    if(cards.length)applyFilter();
    } catch (providerError) {
      providersError.hidden = false;
      document.getElementById('categoryProviderCount').textContent = 'Prestadores indisponíveis';
      console.warn('Não foi possível carregar os prestadores:', providerError?.message || providerError);
    }
  } catch (error) { state.textContent = error?.message?.includes('municíp') || error?.message?.includes('IBGE') ? 'Não foi possível carregar o cadastro de cidades do IBGE. Confira sua conexão e tente novamente.' : ui.message(error); }
})();
