
'use strict';
// Seção comercial: somente escolha do ciclo. A cobrança depende do backend e da homologação.
(() => {
  const switcher = document.querySelector('[data-pricing-switch]');
  const price = document.querySelector('[data-pricing-amount]');
  const unit = document.querySelector('[data-pricing-unit]');
  const detail = document.querySelector('[data-pricing-detail]');
  const equivalent = document.querySelector('[data-pricing-equivalent]');
  if (!switcher || !price || !unit || !detail || !equivalent) return;
  const render = (cycle) => {
    const yearly = cycle === 'yearly';
    price.textContent = yearly ? 'R$ 149,00' : 'R$ 14,90';
    unit.textContent = yearly ? '/ ano' : '/ mês';
    detail.textContent = yearly
      ? 'Valor anual proposto, cobrado de uma vez quando assinaturas estiverem disponíveis.'
      : 'Valor mensal proposto; sem cobrança no cadastro atual.';
    equivalent.hidden = !yearly;
    const manageLink=document.querySelector('[data-billing-plan-link]');
    if(manageLink)manageLink.href=`painel.html?ciclo=${yearly?'yearly':'monthly'}#assinatura`;
    switcher.querySelectorAll('[data-pricing-cycle]').forEach((button) => {
      const selected = button.dataset.pricingCycle === cycle;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };
  switcher.querySelectorAll('[data-pricing-cycle]').forEach((button) => {
    button.addEventListener('click', () => render(button.dataset.pricingCycle));
  });
  render('monthly');
})();
