'use strict';
/* Municípios obtidos diretamente do cadastro oficial do IBGE. A cidade é sempre
   identificada pelo código de sete dígitos, nunca por nome isolado. */
(function (scope) {
  const ENDPOINT = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
  const LOCAL_SNAPSHOT = 'assets/municipios-br.json';
  const CACHE_KEY = 'sqf_municipios_ibge_v2';
  const normalize = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const format = (city) => city ? `${city.name} — ${city.uf}` : '';
  let promise;
  let cities = [];
  function toCity(raw) {
    const uf = raw?.microrregiao?.mesorregiao?.UF?.sigla ?? raw?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla;
    const id = String(raw?.id ?? '');
    const name = String(raw?.nome ?? '').trim();
    return /^\d{7}$/.test(id) && /^[A-Z]{2}$/.test(String(uf ?? '')) && name ? { id, name, uf } : null;
  }
  const UF_CODES = Object.freeze({11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'});
  function validateList(data) {
    if (!Array.isArray(data) || data.length < 5500) return false;
    const ids = new Set();
    for (const c of data) {
      if (!c || !/^\d{7}$/.test(String(c.id)) || UF_CODES[String(c.id).slice(0,2)] !== c.uf || typeof c.name !== 'string' || !c.name.trim() || ids.has(String(c.id))) return false;
      ids.add(String(c.id));
    }
    return true;
  }
  async function fetchJson(url) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
      const response = await fetch(url, {cache:'no-cache', ...(controller ? {signal:controller.signal} : {})});
      if (!response.ok) throw new Error('Municípios indisponíveis');
      return await response.json();
    } finally { if (timer) clearTimeout(timer); }
  }
  async function load() {
    if (cities.length) return cities;
    if (promise) return promise;
    promise = (async () => {
      let data;
      try {
        const saved = sessionStorage.getItem(CACHE_KEY);
        if (saved) data = JSON.parse(saved);
      } catch { /* Navegação privada ou sessão sem armazenamento */ }
      if (!validateList(data)) {
        let local;
        try { local = await fetchJson(LOCAL_SNAPSHOT); } catch { /* API oficial como alternativa */ }
        if (validateList(local)) data = local;
        else {
          const raw = await fetchJson(ENDPOINT);
          data = Array.isArray(raw) ? raw.map(toCity) : [];
        }
        if (!validateList(data)) throw new Error('Lista de municípios inválida ou incompleta.');
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* Cache opcional */ }
      }
      cities = data.map(item => ({ id:String(item.id),name:String(item.name),uf:String(item.uf) }));
      return cities;
    })().catch(error => { promise = null; throw error; });
    return promise;
  }
  const byId = (id) => cities.find(item => item.id === String(id)) || null;
  function search(term, limit = 20) {
    const q = normalize(term);
    if (q.length < 2) return [];
    return cities.filter(c => normalize(format(c)).includes(q) || normalize(c.name).includes(q))
      .slice(0,limit);
  }
  function picker(box) {
    const input = box.querySelector('[data-city-input]');
    const hidden = box.querySelector('[data-city-id]');
    const status = box.querySelector('[data-city-status]');
    const datalist = box.querySelector('datalist');
    if (!input || !hidden || !datalist) return null;
    const oldValue = hidden.value || '';
    let selected = null;
    function announce(message, error = false) {
      if (!status) return;
      status.textContent = message;
      status.dataset.error = String(error);
    }
    const emit = () => box.dispatchEvent(new CustomEvent('sqf:city-change', { bubbles:true, detail:selected }));
    const select = city => {
      selected = city || null;
      hidden.value = city?.id || '';
      if (city) input.value = format(city);
      input.setCustomValidity('');
      if (city) announce(`${format(city)} selecionada.`);
      emit();
    };
    function sync() {
      const value = normalize(input.value);
      const exact = cities.find(c => normalize(format(c)) === value);
      select(exact || null);
      if (!exact && input.value.trim()) announce('Selecione uma cidade com UF na lista de sugestões.',true);
    }
    function suggest() {
      selected = null; hidden.value = '';
      datalist.replaceChildren();
      for (const city of search(input.value)) {
        const option = document.createElement('option');
        option.value = format(city); datalist.append(option);
      }
      emit();
      if (input.value.trim().length < 2) announce('Digite pelo menos duas letras para encontrar sua cidade.');
      else announce('Escolha uma cidade e seu estado entre as sugestões.');
    }
    input.addEventListener('input', () => { suggest(); const exact=cities.find(c=>normalize(format(c))===normalize(input.value));if(exact)select(exact); });
    input.addEventListener('change', sync);
    input.addEventListener('blur', () => { if (input.value && !hidden.value) sync(); });
    input.addEventListener('focus',() => { if (input.value && !hidden.value) suggest(); });
    const retry = document.createElement('button');
    retry.type='button'; retry.className='button button-outline city-retry'; retry.textContent='Tentar carregar cidades novamente'; retry.hidden=true; box.append(retry);
    function initialize() {
    input.disabled=true; retry.hidden=true; announce('Carregando cidades...');
    return load().then(() => {
      input.disabled = false;
      announce('Digite o nome da cidade e selecione a opção com UF.');
      const initial = oldValue || (box.hasAttribute('data-city-from-url') ? new URLSearchParams(location.search).get('cidade') : null);
      if (initial && byId(initial)) select(byId(initial));
      else if (input.value.trim()) {
        // Form fields may be restored from browser history/autofill without a fresh input event.
        const restored = cities.find(c => normalize(format(c)) === normalize(input.value));
        if (restored) select(restored);
      }
      return cities;
    }).catch(() => {
      input.disabled = true; retry.hidden=false;
      announce('Não foi possível carregar os municípios do IBGE. Confira a conexão e tente novamente.',true);
    });
    }
    let ready = initialize();
    retry.addEventListener('click', () => { ready=initialize(); api.ready=ready; });
    input.disabled = true;
    const api = {
      ready,
      getSelected: () => selected,
      setId: async (id) => { await ready; select(byId(id)); },
      validate: () => { if (selected) return true; announce('Selecione uma cidade válida na lista do IBGE.',true);input.focus();return false; }
    };
    box.__cityPicker = api;
    return api;
  }
  const api = { ENDPOINT,normalize,toCity,format,validateList,load,byId,search,picker };
  scope.SQFCities = Object.freeze(api);
  if (typeof document !== 'undefined') document.querySelectorAll('[data-city-picker]').forEach(picker);
})(typeof window !== 'undefined' ? window : globalThis);
