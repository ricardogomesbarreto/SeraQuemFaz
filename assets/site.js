'use strict';
(() => {
  const button = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-menu');
  if (button && nav) {
    const close = () => { nav.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', 'Abrir menu'); };
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      nav.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    document.addEventListener('click', (event) => { if (!nav.contains(event.target) && !button.contains(event.target)) close(); });
  }
  const homeCityForm = document.getElementById('homeCitySearch');
  homeCityForm?.addEventListener('submit', event => {
    const picker = document.getElementById('homeCity')?.closest('[data-city-picker]')?.__cityPicker;
    if (!picker?.validate()) event.preventDefault();
  });
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  // PWA opcional: instalar somente em contexto seguro. Service Worker não
  // armazena páginas autenticadas nem respostas privadas da API.
  if(window.SQFDataMode!=='mysql'&&typeof navigator!=='undefined'&&typeof window!=='undefined'&&
    'serviceWorker' in navigator &&
    (location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register(new URL('service-worker.js',document.baseURI))
        .catch(()=>{/* A versão web continua operacional sem PWA. */});
    },{once:true});
  }
  let installPrompt=null;
  const install=document.getElementById('sqfInstallApp');
  if(typeof window==='undefined')return;
  window.addEventListener('beforeinstallprompt',event=>{
    if(!install)return;
    event.preventDefault();
    installPrompt=event;install.hidden=false;
  });
  install?.addEventListener('click',async()=>{
    if(!installPrompt)return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt=null;install.hidden=true;
  });
})();
