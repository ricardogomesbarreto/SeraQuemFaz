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
})();
