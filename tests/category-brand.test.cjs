const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root,file),'utf8');
test('logo principal é PNG RGBA com transparência', () => {
 const png=fs.readFileSync(path.join(root,'assets/brand/logo-horizontal.png'));
 assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
 assert.equal(png[25],6,'PNG deve usar RGBA');
});
test('rodapé não aplica cartão branco à logomarca', () => {
 assert.match(read('assets/site.css'),/\.site-footer \.footer-brand\s*\{\s*background:\s*transparent/);
});
test('catálogo e detalhe usam a mesma imagem original da categoria', () => {
 assert.match(read('assets/categories.js'),/categoryImage\(entry\)/);
 assert.match(read('assets/category-detail.js'),/categoryImage\(category\)/);
 assert.match(read('assets/category-detail.js'),/imageBox\.replaceChildren/);
});
test('área mostra explicação e permanece disponível se consulta a prestadores falhar', () => {
 assert.match(read('categoria.html'),/id="categorySummary"/);
 assert.match(read('categoria.html'),/id="providersError"/);
 const js=read('assets/category-detail.js');
 assert.match(js,/state\.hidden = true; content\.hidden = false;\s*try/);
 assert.match(js,/providersError\.hidden = false/);
});
test('descrições de áreas incluem climatização e opção neutra', () => {
 const src=read('assets/category-summary.js');
 const sandbox={};
 require('node:vm').runInNewContext(src,sandbox);
 assert.match(sandbox.SQFCategorySummary.forCategory({name:'Ar-Condicionado'}), /higienização/);
 assert.equal(sandbox.SQFCategorySummary.forCategory({name:'Serviços diversos',description:'Área de serviços diversos'}),'Área de serviços diversos');
});
