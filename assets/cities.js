'use strict';
/* Municípios obtidos diretamente do cadastro oficial do IBGE. A cidade é sempre
   identificada pelo código de sete dígitos, nunca por nome isolado. */
(function (scope) {
  const ENDPOINT = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
  const LOCAL_SNAPSHOT = 'assets/municipios-br.json';
  const CACHE_KEY = 'sqf_municipios_ibge_v1';
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
  async function load() {
    if (cities.length) return cities;
    if (promise) return promise;
    promise = (async () => {
      let data;
      try {
        const saved = sessionStorage.getItem(CACHE_KEY);
        if (saved) data = JSON.parse(saved);
      } catch { /* Navegação privada ou sessão sem armazenamento */ }
      if (!Array.isArray(data) || data.length < 5500) {
        let local;
        try {
          const snapshot = await fetch(LOCAL_SNAPSHOT, { cache: 'force-cache' });
          if (snapshot.ok) local = await snapshot.json();
        } catch { /* Snapshot opcional: usar a API oficial */ }
        if (Array.isArray(local) && local.length >= 5500) data = local;
        else {
          const response = await fetch(ENDPOINT, { cache: 'force-cache' });
          if (!response.ok) throw new Error(`IBGE indisponível (HTTP ${response.status})`);
          const raw = await response.json();
          data = Array.isArray(raw) ? raw.map(toCity).filter(Boolean) : [];
        }
        if (data.length < 5500) throw new Error('Lista de municípios incompleta.');
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
    const ready = load().then(() => {
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
      input.disabled = true;
      announce('Não foi possível carregar os municípios do IBGE. Confira a conexão e recarregue a página.',true);
    });
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
  const api = { ENDPOINT,normalize,toCity,format,load,byId,search,picker };
  scope.SQFCities = Object.freeze(api);
  if (typeof document !== 'undefined') document.querySelectorAll('[data-city-picker]').forEach(picker);
})(typeof window !== 'undefined' ? window : globalThis);
