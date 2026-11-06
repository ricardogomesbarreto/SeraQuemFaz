'use strict';
/* Funções puras: nenhuma informação de origem remota é inserida como HTML. */
(function (scope) {
  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const matchesCategory = (category, query) => {
    const needle = normalize(query);
    return !needle || normalize(`${category.name ?? ''} ${category.description ?? ''}`).includes(needle);
  };
  const safeImageUrl = (value) => {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch { return null; }
  };
  // Fonte original do catálogo v3.0: image_url da categoria no Supabase.
  // Nunca associar uma foto a outra profissão por regex: o cadastro é a fonte da verdade.
  const categoryImage = (entity) => safeImageUrl(entity && typeof entity === 'object' ? entity.image_url : null);
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) && String(value).length <= 254;
  const requestIdFromSearch = (search) => {
    const id = new URLSearchParams(search).get('solicitacao');
    return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '') ? id.toLowerCase() : null;
  };
  scope.SQFUtils = Object.freeze({ normalize, matchesCategory, safeImageUrl, categoryImage, isValidEmail, requestIdFromSearch });
})(typeof window === 'undefined' ? globalThis : window);
