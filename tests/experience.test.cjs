'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');

test('logotipo fornecido é PNG transparente e reutilizado em todas as páginas', () => {
  const logo = fs.readFileSync(path.join(root,'assets/brand/logo-horizontal.png'));
  assert.deepEqual([...logo.subarray(0,8)], [137,80,78,71,13,10,26,10]);
  assert.equal(logo[25],6,'RGBA: PNG color type 6');
  for (const page of ['index.html','entrar.html','cadastro.html','categorias.html','categoria.html','prestador.html','painel.html','termos.html','privacidade.html']) {
    assert.match(read(page),/brand-logo[^>]+logo-horizontal\.png/);
    assert.match(read(page),/logo-horizontal-footer\.png/);
  }
});
test('landing page utiliza capa com dois profissionais em arquivo local otimizado', () => {
  assert.match(read('index.html'),/src="assets\/images\/profissionais-landing\.webp"/);
  assert.match(read('index.html'),/Dois profissionais de áreas diferentes/);
  assert.ok(fs.statSync(path.join(root,'assets/images/profissionais-landing.webp')).size > 30000);
  assert.match(read('assets/site.css'),/\.hero-visual>img\{display:block;height:595px/);
});
test('login e cadastro apresentam fotografias distintas e coerentes', () => {
  assert.match(read('cadastro.html'),/class="auth-page signup-page"/);
  const css=read('assets/site.css');
  assert.match(css,/profissional-oficina\.webp/);
  assert.match(css,/signup-page \.auth-brand\{background-image:url\('images\/profissional-cadastro\.webp'\)/);
  assert.ok(fs.statSync(path.join(root,'assets/images/profissional-cadastro.webp')).size > 30000);
});
test('catálogo resolve o evento antecipado de cidade e seleção via URL', () => {
  const city=read('assets/cities.js'),categories=read('assets/categories.js');
  assert.match(categories,/let selectedCity = cityPicker\?\.getSelected\(\) \|\| null/);
  assert.match(categories,/cityPicker\?\.ready\.then\(\(\) =>/);
  assert.match(categories,/selectedCity = cityPicker\.getSelected\(\) \|\| null/);
  assert.match(city,/browser history\/autofill/);
  assert.match(categories,/url\.searchParams\.set\('cidade', selectedCity\.id\)/);
});
test('catálogo oferece filtros de marketplace sem avaliações ou disponibilidade fictícias', () => {
  const html=read('categorias.html'),js=read('assets/categories.js');
  for(const id of ['sortSelect','withImage','withDescription','initialLetter','viewGrid','viewList','loadMore','popularSearches','filterToggle']) {
    assert.match(html,new RegExp(`id="${id}"`));
  }
  for(const val of ['relevance','az','za','recent','description']) assert.match(html,new RegExp(`value="${val}"`));
  assert.match(js,/\.filter\(item => !withDescription\.checked/);
  assert.match(js,/\.filter\(item => !letter/);
  assert.match(js,/visibleLimit \+= 12/);
  assert.match(js,/allCategories\.slice\(0,8\)/);
  assert.doesNotMatch(js,/\.innerHTML\s*=/);
});
test('não há referências ao antigo repositório colaborativo',()=>{
  for(const f of [...fs.readdirSync(root).filter(f=>f.endsWith('.html')||f.endsWith('.md'))]) {
    assert.doesNotMatch(read(f),/github\.com\/[^/\s]+\/API/i,`Remover repositório antigo em ${f}`);
  }
});
