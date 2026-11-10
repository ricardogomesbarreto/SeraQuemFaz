'use strict';
(() => {
  const list = document.querySelector('#categorias');
  if (!list) return;

  const input = document.querySelector('#categoryQuery');
  const form = document.querySelector('#categorySearch');
  const description = document.querySelector('#resultsDescription');
  const reset = document.querySelector('#clearSearch');
  const resetAll = document.querySelector('#resetFilters');
  const count = document.querySelector('#catalogCount');
  const status = document.querySelector('#sidebarStatus');
  const sortSelect = document.querySelector('#sortSelect');
  const withImage = document.querySelector('#withImage');
  const withDescription = document.querySelector('#withDescription');
  const initialLetter = document.querySelector('#initialLetter');
  const viewGrid = document.querySelector('#viewGrid');
  const viewList = document.querySelector('#viewList');
  const pagination = document.querySelector('#paginationControls');
  const loadMore = document.querySelector('#loadMore');
  const paginationSummary = document.querySelector('#paginationSummary');
  const popularSearches = document.querySelector('#popularSearches');
  const activeFilters = document.querySelector('#activeFilters');
  const cityHighlight = document.querySelector('#catalogCityHighlight');
  const visibleCount = document.querySelector('#catalogVisibleCount');
  const sidebar = document.querySelector('#catalogSidebar');
  const filterToggle = document.querySelector('#filterToggle');
  const filterClose = document.querySelector('#filterClose');
  const backdrop = document.querySelector('#filterBackdrop');
  const utils = window.SQFUtils;
  const assistedSearch = window.SQFCategorySearch;
  const searchAssistance=document.getElementById('searchAssistance');
  const searchOptions=document.getElementById('searchAssistanceOptions');
  const cityBox = document.getElementById('catalogCity')?.closest('[data-city-picker]');
  const cityPicker = cityBox?.__cityPicker;
  let selectedCity = cityPicker?.getSelected() || null;
  let viewMode = 'grid';
  let visibleLimit = 12;
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  let allCategories = [];
  let loading = false;
  let failure = false;
  let referenceMode = null; // null: dados reais; 'empty' ou 'error': somente prévia editorial.
  const referenceCatalog = window.SQFCatalogPreview?.categories || [];
  const catalogNotice = document.getElementById('catalogReferenceNotice');

  // URLs image_url públicas originais da categoria; no erro usa fonte recuperada de referência.
  const safeImage = (entry) => utils.categoryImage(entry) || utils.safeImageUrl(window.SQFOriginalCategoryImages?.get(entry?.name));
  const palette = ['azul', 'laranja', 'marinho', 'areia', 'ciano', 'grafite'];
  const artworkFor = (name) => {
    const n=utils.normalize(name);
    const mapping={
      'advogado':'advogado','ar-condicionado':'ar-condicionado','arquitetura':'arquitetura',
      'automacao residencial':'automacao-residencial','eletricista':'eletricista',
      'mecanico':'mecanica','construcao':'construcao','pintor':'pintura',
      'jardineiro':'jardinagem','limpeza':'limpeza','encanador':'hidraulica',
      'tecnico de informatica':'informatica'
    };
    return mapping[n] ? `assets/category-fallbacks/${mapping[n]}.webp` : null;
  };
  function placeholderFor(category) {
    const title = String(category.name || 'Área de serviço').trim();
    const text = utils.normalize(title);
    let hash = 0;
    for (const character of text) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    const wrap = document.createElement('div');
    wrap.className = `category-image-placeholder is-${palette[hash % palette.length]}`;
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `Imagem não cadastrada para a categoria ${title}`);
    const glyph = document.createElement('span'); glyph.className = 'category-image-glyph';
    glyph.textContent = title.charAt(0).toLocaleUpperCase('pt-BR') || 'S';
    glyph.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('strong'); heading.textContent = title;
    const caption = document.createElement('small'); caption.textContent = 'Imagem ainda não cadastrada';
    wrap.append(glyph, heading, caption);
    return wrap;
  }

  function showFilters(open) {
    if (!sidebar || !filterToggle || !backdrop) return;
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    document.body.classList.toggle('catalog-filters-open', open);
    filterToggle.setAttribute('aria-expanded', String(open));
    if (open) (selectedCity ? input : document.getElementById('catalogCity')).focus();
    else if (document.activeElement && sidebar.contains(document.activeElement)) filterToggle.focus();
  }
  filterToggle?.addEventListener('click', () => showFilters(!sidebar.classList.contains('is-open')));
  filterClose?.addEventListener('click', () => showFilters(false));
  backdrop?.addEventListener('click', () => showFilters(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && sidebar?.classList.contains('is-open')) {
      const items=[...sidebar.querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled && el.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
    if (event.key === 'Escape' && sidebar?.classList.contains('is-open')) showFilters(false);
  });
  const desktopMedia = window.matchMedia?.('(min-width: 901px)');
  desktopMedia?.addEventListener?.('change', ({ matches }) => { if (matches) showFilters(false); });

  function panel(title, body, type) {
    const div = document.createElement('div');
    div.className = 'status-panel';
    div.dataset.state = type || 'info';
    const symbol = document.createElement('span'); symbol.className = 'status-panel-icon'; symbol.setAttribute('aria-hidden', 'true'); symbol.textContent = type === 'error' ? '!' : '⌕';
    const strong = document.createElement('strong'); strong.textContent = title;
    const p = document.createElement('p'); p.textContent = body;
    div.append(symbol, strong, p);
    return div;
  }

  function card(category) {
    const article = document.createElement('article'); article.className = 'category-card';
    const cover = document.createElement('div'); cover.className = 'category-cover';
    const imageUrl = safeImage(category);
    const fallback = () => {
      // URLs de miniaturas externas podem expirar: nunca reutilizar a foto de outra categoria.
      const artwork=artworkFor(category.name);
      if(!artwork){cover.replaceChildren(placeholderFor(category));return;}
      const local=document.createElement('img'); local.src=artwork;
      local.alt=`Ilustração da categoria ${String(category.name||'serviço')}`;
      local.loading='lazy';local.decoding='async';
      local.addEventListener('error',()=>cover.replaceChildren(placeholderFor(category)),{once:true});
      cover.replaceChildren(local);
    };
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = `Imagem original da categoria ${String(category.name || 'serviço')}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.sizes = '(max-width: 900px) 100vw, (max-width: 1250px) 50vw, 460px';
      image.addEventListener('error', fallback, { once: true });
      cover.appendChild(image);
    } else fallback();
    const info = document.createElement('div'); info.className = 'category-info';
    const eyebrow = document.createElement('span'); eyebrow.className = 'category-eyebrow'; eyebrow.textContent = referenceMode ? 'ÁREA DE REFERÊNCIA · NÃO PUBLICADA' : 'ÁREA DE SERVIÇO';
    const heading = document.createElement('h3'); heading.textContent = String(category.name || 'Serviço sem nome');
    const body = document.createElement('p'); body.textContent = String(category.description || 'Explore essa área de serviço.');
    const cardFoot = document.createElement('div'); cardFoot.className = 'category-card-foot';
    const text = document.createElement('a'); text.href = referenceMode ? `categoria.html?ref=${encodeURIComponent(String(category.id))}&cidade=${encodeURIComponent(selectedCity.id)}` : `categoria.html?id=${encodeURIComponent(String(category.id))}&cidade=${encodeURIComponent(selectedCity.id)}`; text.className = 'category-open-link'; text.textContent = referenceMode ? 'Conhecer área de referência' : 'Ver área e profissionais';
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
    cardFoot.append(text, arrow);
    info.append(eyebrow, heading, body, cardFoot);
    article.append(cover, info);
    return article;
  }

  function syncUrl() {
    const query = input.value.trim().slice(0, 100);
    const url = new URL(window.location.href);
    if (selectedCity) url.searchParams.set('cidade', selectedCity.id);
    else url.searchParams.delete('cidade');
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }

  function resetFilters() {
    input.value = '';
    sortSelect.value = 'relevance';
    withImage.checked = false;
    withDescription.checked = false;
    initialLetter.value = '';
    visibleLimit = 12;
    syncUrl();
    render();
    showFilters(false);
  }

  function normalize(value) {
    return window.SQFCities.normalize(value);
  }

  function rank(item, query) {
    if(assistedSearch)return assistedSearch.rank(item,query);
    const q = normalize(query);
    if (!q) return 0;
    const name = normalize(item.name);
    const description = normalize(item.description);
    if (name === q) return 10;
    if (name.startsWith(q)) return 7;
    if (name.includes(q)) return 5;
    return description.includes(q) ? 2 : 0;
  }

  function suggestWhenEmpty(query,found){
    if(!searchAssistance||!searchOptions)return;
    searchAssistance.hidden=true;
    searchOptions.replaceChildren();
    if(!selectedCity||referenceMode||loading||failure||!query||found>0||!assistedSearch)return;
    const candidates=assistedSearch.suggest(allCategories,query,3);
    for(const entry of candidates){
      const button=document.createElement('button');
      button.type='button';button.className='button button-outline button-small';
      button.textContent=String(entry.name||'');
      button.addEventListener('click',()=>{
        input.value=String(entry.name||'').slice(0,100);
        visibleLimit=12;syncUrl();render();
      });
      searchOptions.append(button);
    }
    searchAssistance.hidden=!candidates.length;
  }
  function render() {
    const query = input.value.trim();
    const mode = sortSelect.value;
    const letter = initialLetter.value;
    const filtered = (assistedSearch
      ?assistedSearch.find(allCategories,query)
      :allCategories.filter(item => utils.matchesCategory(item, query)))
      .filter(item => !withImage.checked || Boolean(safeImage(item)))
      .filter(item => !withDescription.checked || Boolean(String(item.description || '').trim()))
      .filter(item => !letter || normalize(item.name).toUpperCase().startsWith(letter))
      .sort((a, b) => {
        if (mode === 'relevance' && query) {
          const delta = rank(b,query) - rank(a,query);
          if (delta) return delta;
        }
        if (mode === 'recent') {
          const delta = Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
          if (Number.isFinite(delta) && delta !== 0) return delta;
        }
        if (mode === 'description') {
          const delta = String(b.description || '').length - String(a.description || '').length;
          if (delta) return delta;
        }
        return (mode === 'za' ? -1 : 1) * collator.compare(String(a.name || ''), String(b.name || ''));
      });

    list.replaceChildren();
    list.classList.toggle('is-list-view',viewMode === 'list');
    viewGrid?.classList.toggle('is-selected',viewMode === 'grid');
    viewList?.classList.toggle('is-selected',viewMode === 'list');
    viewGrid?.setAttribute('aria-pressed',String(viewMode === 'grid'));
    viewList?.setAttribute('aria-pressed',String(viewMode === 'list'));
    list.setAttribute('aria-busy', String(loading));
    pagination.hidden = true;
    if(searchAssistance)searchAssistance.hidden=true;
    if (cityHighlight) {
      cityHighlight.hidden=!selectedCity;
      cityHighlight.textContent=selectedCity ? `⌖ Buscando em ${window.SQFCities.format(selectedCity)}` : '';
    }
    if(visibleCount)visibleCount.textContent='';
    if (catalogNotice) {
      catalogNotice.hidden = !referenceMode || !selectedCity;
      if (referenceMode && selectedCity) {
        const content = catalogNotice.querySelector('[data-reference-message]');
        if (content) content.textContent = referenceMode === 'empty'
          ? 'A consulta ao banco retornou vazia. Mostramos os nomes e endereços de imagem previamente recuperados do catálogo público, sem confirmar a situação atual. Tente sincronizar novamente.'
          : 'A conexão com o catálogo falhou. Estas fotos e categorias vêm de uma cópia pública de referência; profissionais e avaliações não são mostrados sem validação no banco. Tente sincronizar novamente.';
      }
    }
    if (!selectedCity) {
      count.textContent = '—';
      reset.hidden = true;
      activeFilters.hidden = true;
      popularSearches.hidden = true;
      list.append(panel('Escolha primeiro uma cidade', 'Digite o município e selecione a opção com UF. Depois, explore as áreas de serviço disponíveis.'));
      description.textContent = 'A seleção do município é obrigatória antes da pesquisa por serviços.';
      status.textContent = 'Aguardando seleção de cidade';
      return;
    }
    popularSearches.hidden = loading || !allCategories.length;
    reset.hidden = !(query || withImage.checked || withDescription.checked || letter || mode !== 'relevance');
    count.textContent = loading ? '—' : String(filtered.length);
    activeFilters.replaceChildren();
    const label = document.createElement('span'); label.className = 'active-filter-label'; label.textContent = 'Filtros ativos:'; activeFilters.appendChild(label);
    const cityTag = document.createElement('span'); cityTag.className = 'filter-tag'; cityTag.textContent = `Cidade: ${window.SQFCities.format(selectedCity)}`; activeFilters.appendChild(cityTag);
    for (const [value,prefix] of [[query,'Busca'],[withImage.checked?'Sim':'','Com imagem'],[withDescription.checked?'Sim':'','Com descrição'],[letter,'Inicial']]) {
      if (!value) continue;
      const tag = document.createElement('button'); tag.type='button'; tag.className = 'filter-tag filter-tag-removable';
      tag.textContent = (prefix === 'Busca' || prefix === 'Inicial') ? `${prefix}: ${value} ×` : `${prefix} ×`;
      tag.setAttribute('aria-label',`Remover filtro ${prefix}`);
      tag.addEventListener('click',()=>{
        if(prefix==='Busca')input.value='';
        else if(prefix==='Com imagem')withImage.checked=false;
        else if(prefix==='Com descrição')withDescription.checked=false;
        else if(prefix==='Inicial')initialLetter.value='';
        visibleLimit=12;syncUrl();render();
      });
      activeFilters.appendChild(tag);
    }
    activeFilters.hidden = false;
    if (loading) {
      list.append(panel('Carregando categorias', 'Estamos consultando as áreas de serviço disponíveis no momento.'));
      description.textContent = 'Consultando a base de categorias...';
      status.textContent = 'Consultando o catálogo...';
      return;
    }
    if (failure) {
      const errorPanel = panel('Não foi possível carregar o catálogo', 'Verifique sua conexão e tente novamente em alguns instantes.', 'error');
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'button button-outline button-small'; retry.textContent = 'Tentar novamente'; retry.addEventListener('click', init);
      errorPanel.appendChild(retry); list.appendChild(errorPanel);
      count.textContent = '—'; description.textContent = 'Catálogo temporariamente indisponível'; status.textContent = 'Não foi possível sincronizar';
      return;
    }
    status.textContent = referenceMode ? `${allCategories.length} áreas ilustrativas · banco de dados pendente` : `${allCategories.length} ${allCategories.length === 1 ? 'categoria pública' : 'categorias públicas'} no catálogo`;
    description.textContent = `${filtered.length} ${referenceMode ? 'áreas de referência' : (filtered.length === 1 ? 'categoria encontrada' : 'categorias encontradas')} · ${window.SQFCities.format(selectedCity)}` + (query ? ` · “${query}”` : '');
    suggestWhenEmpty(query,filtered.length);
    if (!filtered.length) {
      const emptyPanel = panel('Nenhuma categoria encontrada', query || withImage.checked || withDescription.checked || letter ? 'Experimente outro termo ou limpe os filtros para visualizar todas as categorias.' : 'Ainda não há categorias públicas disponíveis.');
      const clear = document.createElement('button'); clear.type='button'; clear.className='button button-outline'; clear.textContent='Limpar filtros e explorar serviços'; clear.addEventListener('click',resetFilters); emptyPanel.append(clear); list.append(emptyPanel);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const category of filtered.slice(0,visibleLimit)) fragment.appendChild(card(category));
    list.appendChild(fragment);
    if (filtered.length > visibleLimit) pagination.hidden = false;
    paginationSummary.textContent = `Exibindo ${Math.min(filtered.length,visibleLimit)} de ${filtered.length} categorias`;
    if(visibleCount)visibleCount.textContent=paginationSummary.textContent;
  }

  function updateFacets() {
    initialLetter.replaceChildren();
    const all = document.createElement('option'); all.value = ''; all.textContent = 'Todas as letras'; initialLetter.appendChild(all);
    const letters = new Set(allCategories.map(c => normalize(c.name).charAt(0).toUpperCase()).filter(c => /[A-Z]/.test(c)));
    for (const letter of [...letters].sort()) {
      const option = document.createElement('option'); option.value = letter; option.textContent = `${letter} · Categorias com ${letter}`; initialLetter.appendChild(option);
    }
    popularSearches.replaceChildren();
    if (!allCategories.length) return;
    const title = document.createElement('strong'); title.textContent = 'Explore categorias disponíveis:'; popularSearches.appendChild(title);
    const wrap = document.createElement('div'); wrap.className = 'quick-pick-list';
    // Sugestões são geradas SOMENTE a partir de categorias realmente cadastradas.
    for (const entry of allCategories.slice(0,8)) {
      const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'quick-pick'; chip.textContent = String(entry.name || 'Área de serviço');
      chip.addEventListener('click', () => { input.value = String(entry.name || '').slice(0,100); visibleLimit = 12; syncUrl(); render(); });
      wrap.append(chip);
    }
    popularSearches.append(wrap);
  }

  const params = new URLSearchParams(window.location.search);
  input.value = (params.get('q') || '').slice(0, 100);
  form.addEventListener('submit', event => { event.preventDefault(); if (!selectedCity) { cityPicker?.validate(); return; } syncUrl(); render(); showFilters(false); });
  cityBox?.addEventListener('sqf:city-change', event => {
    selectedCity = event.detail || null;
    visibleLimit = 12; syncUrl(); render();
    if (selectedCity && !loading && !failure && !allCategories.length) init();
  });
  input.addEventListener('input', () => {visibleLimit=12;render();});
  sortSelect.addEventListener('change', () => {visibleLimit=12;render();});
  withImage.addEventListener('change', () => {visibleLimit=12;render();});
  withDescription.addEventListener('change', () => {visibleLimit=12;render();});
  initialLetter.addEventListener('change', () => {visibleLimit=12;render();});
  viewGrid.addEventListener('click', () => {viewMode='grid';render();});
  viewList.addEventListener('click', () => {viewMode='list';render();});
  loadMore.addEventListener('click', () => {visibleLimit += 12;render();});
  reset.addEventListener('click', resetFilters);
  resetAll.addEventListener('click', resetFilters);
  document.querySelector('#applyFilters')?.addEventListener('click',()=>{syncUrl();render();showFilters(false);document.querySelector('#results-title')?.focus?.();});
  document.querySelectorAll('[data-search-suggestion]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.searchSuggestion || '';
      syncUrl(); render(); showFilters(false);
    });
  });
  window.addEventListener('popstate', () => {
    const next = new URLSearchParams(location.search);
    input.value = (next.get('q') || '').slice(0, 100);
    cityPicker?.setId(next.get('cidade') || '').then(() => {
      selectedCity = cityPicker?.getSelected() || null;
      render();
      if (selectedCity && !loading && !failure && !allCategories.length) init();
    });
  });

  async function queryLiveCategories() {
    if(window.SQFDataMode==='mysql'){
      const result=await window.SQFMySQL.categories();
      if(!Array.isArray(result.data))throw new Error('Resposta inválida da API MySQL');
      return result.data;
    }
    let clientError;
    try {
      const client=window.getSQFClient();
      const {data,error}=await client.from('categories')
        .select('id,name,description,image_url,status,created_at')
        .eq('status', 'active').order('name',{ascending:true});
      if(error)throw error;
      if(Array.isArray(data))return data;
    } catch(error){clientError=error;}
    // Recuperação sem biblioteca CDN: acesso GET somente à coleção pública com RLS.
    const cfg=window.SQFSupabase;
    if(!cfg?.url||!cfg?.publishableKey||typeof fetch!=='function')throw clientError||new Error('API pública indisponível');
    const api=new URL('/rest/v1/categories',cfg.url);
    api.searchParams.set('select','id,name,description,image_url,status,created_at');
    api.searchParams.set('status','eq.active');
    api.searchParams.set('order','name.asc');
    const response=await fetch(api.href,{
      method:'GET',mode:'cors',cache:'no-store',credentials:'omit',
      headers:{apikey:cfg.publishableKey,accept:'application/json'}
    });
    if(!response.ok)throw new Error(`Catálogo público indisponível (HTTP ${response.status})`);
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('Resposta inválida da API pública');
    return data;
  }

  async function init() {
    if (loading) return;
    loading = true; failure = false; render();
    try {
      const remote=await queryLiveCategories();
      referenceMode = remote.length ? null : 'empty';
      allCategories = remote.length ? remote : referenceCatalog.slice();
      updateFacets();
    } catch (error) {
      // Falhas de rede e RLS não são 'zero profissionais': sinalizar a indisponibilidade.
      referenceMode = 'error';
      allCategories = referenceCatalog.slice();
      failure = !allCategories.length;
      updateFacets();
      console.warn('Falha na leitura pública de categorias:', error?.code || error?.message || error);
    } finally { loading = false; render(); }
  }
  catalogNotice?.querySelector('[data-retry-catalog]')?.addEventListener('click', init);
  render();
  // O catálogo só consulta o banco após a escolha explícita de município.
  cityPicker?.ready.then(() => {
    // Resolve a corrida: a cidade pode ter sido selecionada antes de categories.js observar o evento.
    selectedCity = cityPicker.getSelected() || null;
    render();
    if (selectedCity && params.get('cidade') !== selectedCity.id) syncUrl();
    if (selectedCity && !loading && !allCategories.length) init();
  });
})();
