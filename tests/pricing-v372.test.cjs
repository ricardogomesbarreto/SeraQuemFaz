const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('landing page apresenta proposta mensal e anual com valores transparentes', () => {
  const home = read('index.html');
  assert.match(home, /id="planos"/);
  assert.match(home, /href="index\.html#planos"/);
  assert.match(home, /R\$ 14,90/);
  assert.match(home, /R\$ 149,00/);
  assert.match(home, /R\$ 0,00/);
  assert.match(home, /data-pricing-cycle="monthly"/);
  assert.match(home, /data-pricing-cycle="yearly"/);
  assert.match(home, /aria-pressed="true"/);
  assert.match(home, /src="assets\/pricing\.js"/);
  assert.match(home, /integração do checkout e da confirmação de pagamentos está preparada, mas ainda não está habilitada/);
  assert.match(home, /cadastro\.html\?tipo=prestador/);
  assert.match(home, /cadastro\.html\?tipo=cliente/);
});

test('cálculo de economia anual e preço equivalente estão corretos', () => {
  const monthly = 14.90;
  const annual = 149.00;
  assert.equal(Math.round((monthly * 12 - annual) * 100), 2980);
  assert.equal((annual / 12).toFixed(2), '12.42');
  assert.equal(Math.round((1 - annual / (monthly * 12)) * 100), 17);
});

test('seletor de ciclo informa valores e estados sem disparar pagamento', () => {
  const buttons = ['monthly','yearly'].map(cycle => ({
    dataset: {pricingCycle: cycle}, attrs: {}, listener: null,
    classList: {toggle(name, state) {if(name==='is-selected') this.selected = state;}},
    setAttribute(key,val) {this.attrs[key] = val;},
    addEventListener(event, fn) { assert.equal(event,'click'); this.listener = fn; }
  }));
  const nodes = {
    '[data-pricing-switch]': {querySelectorAll() {return buttons;}},
    '[data-pricing-amount]': {textContent: ''},
    '[data-pricing-unit]': {textContent: ''},
    '[data-pricing-detail]': {textContent: ''},
    '[data-pricing-equivalent]': {hidden: true},
  };
  vm.runInNewContext(read('assets/pricing.js'), {document:{querySelector(selector) {return nodes[selector] || null;}}});
  assert.equal(nodes['[data-pricing-amount]'].textContent, 'R$ 14,90');
  assert.equal(buttons[0].attrs['aria-pressed'], 'true');
  assert.equal(buttons[1].attrs['aria-pressed'], 'false');
  buttons[1].listener();
  assert.equal(nodes['[data-pricing-amount]'].textContent, 'R$ 149,00');
  assert.equal(nodes['[data-pricing-unit]'].textContent, '/ ano');
  assert.equal(nodes['[data-pricing-equivalent]'].hidden, false);
  assert.equal(buttons[1].attrs['aria-pressed'], 'true');
  buttons[0].listener();
  assert.equal(nodes['[data-pricing-unit]'].textContent, '/ mês');
  assert.equal(nodes['[data-pricing-equivalent]'].hidden, true);
});

test('não implementa cobranças ou vantagens sem funcionalidade existente', () => {
  const content = read('index.html') + '\n' + read('assets/pricing.js');
  assert.doesNotMatch(content, /checkout\.stripe\.com|preapproval|createSubscription|paymentIntent|pagar agora|assinar agora/i);
  assert.match(read('docs/financeiro/PRECIFICACAO-v3.7.2.md'), /nenhum pagamento/);
  assert.match(read('docs/versoes/RELEASE-NOTES-v3.7.2.md'), /não processam pagamento/i);
});
