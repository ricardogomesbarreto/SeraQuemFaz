'use strict';
/* Chave publicável, própria para uso no navegador. Nunca incluir service_role nem segredos aqui.
   O projeto Supabase precisa ter RLS e políticas de acesso configuradas no servidor. */
window.SQFSupabase = Object.freeze({
  url: 'https://ujrzbwoqcgygaizxnyhl.supabase.co',
  // Configure depois da publicação em domínio HTTPS. Nunca usar localhost para links enviados a celulares.
  publicSiteUrl: '',
  publishableKey: 'sb_publishable_b6gtNhRw2SvBUYdI7_hzyQ_XL0wXFn3'
});
window.getSQFClient = function getSQFClient() {
  if (!window.supabase || !window.supabase.createClient) throw new Error('Biblioteca de autenticação indisponível.');
  if (!window.__sqfClient) {
    const settings = window.SQFSupabase;
    window.__sqfClient = window.supabase.createClient(settings.url, settings.publishableKey);
  }
  return window.__sqfClient;
};
