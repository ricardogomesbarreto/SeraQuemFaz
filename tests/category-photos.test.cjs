const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = { window: {}, URL };
vm.createContext(context);
vm.runInContext(read('assets/utils.js'), context);
const { categoryImage, safeImageUrl } = context.window.SQFUtils;

test('preserva URLs HTTPS originais do campo image_url nas categorias', () => {
  const examples = [
    { name: 'Barbeiro', image_url: 'https://cdn.example.org/barbeiro-original.jpg' },
    { name: 'Cabeleireiro', image_url: 'https://cdn.example.org/cabeleireiro-original.jpg' },
    { name: 'Contador', image_url: 'https://cdn.example.org/contador-original.webp' },
    { name: 'Costureiro', image_url: 'https://cdn.example.org/costureiro-original.png' }
  ];
  for (const category of examples) {
    assert.equal(categoryImage(category), category.image_url);
  }
  assert.equal(categoryImage(examples[0]) !== categoryImage(examples[1]), true);
});

test('não atribui fotografia de outra profissão quando image_url estiver vazio', () => {
  for (const name of ['Barbeiro', 'Cabeleireiro', 'Contador', 'Costureiro', 'Buffet', 'Decoração']) {
    assert.equal(categoryImage({ name, image_url: null }), null);
    assert.equal(categoryImage({ name, image_url: '' }), null);
  }
  assert.equal(categoryImage({ name: 'Advogado', image_url: undefined }), null);
});

test('imagens inseguras, arquivos locais e URLs HTTP são rejeitados', () => {
  for (const uri of [
    'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'file:///etc/passwd',
    'http://example.com/photo.jpg', '/assets/brand/simbolo.png'
  ]) {
    assert.equal(safeImageUrl(uri), null);
    assert.equal(categoryImage({ name: 'Teste', image_url: uri }), null);
  }
});

test('catálogo e página da área usam o mesmo image_url e possuem substituto seguro em caso de erro', () => {
  const cat = read('assets/categories.js');
  const detail = read('assets/category-detail.js');
  assert.match(cat, /utils\.categoryImage\(entry\)/);
  assert.match(detail, /window\.SQFUtils\.categoryImage\(category\)/);
  assert.match(cat, /addEventListener\('error', fallback, \{ once: true \}\)/);
  assert.match(detail, /addEventListener\('error', missing, \{ once: true \}\)/);
  assert.match(cat, /Imagem ainda não cadastrada/);
  assert.match(detail, /Imagem não cadastrada para esta área/);
  assert.doesNotMatch(cat, /\.innerHTML\s*=/);
  assert.doesNotMatch(detail, /\.innerHTML\s*=/);
});

test('versão não inclui fotografias artificiais que substituem o acervo original', () => {
  assert.ok(!fs.existsSync(path.join(root, 'assets/category-photos')));
  assert.ok(!fs.existsSync(path.join(root, 'assets/category-illustrations')));
  assert.match(read('assets/site.css'), /aspect-ratio:\s*16\s*\/\s*9/);
});
