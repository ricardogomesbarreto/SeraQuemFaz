const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const text = file => fs.readFileSync(path.join(root, file), 'utf8');
const image = file => fs.readFileSync(path.join(root, 'assets/brand', file));
test('logo da landing e versão do rodapé preservam margens transparentes', () => {
  for (const name of ['logo-horizontal.png','logo-horizontal-footer.png','simbolo.png','simbolo-dark.png']) {
    const data=image(name);
    assert.equal(data.subarray(1,4).toString('ascii'), 'PNG');
    assert.equal(data[25],6); // RGBA
  }
  assert.match(text('index.html'), /src="assets\/brand\/simbolo-dark\.png"/);
  assert.match(text('assets/site.css'), /\.professional-art\s*\{[^}]*padding:20px 16px/);
});
test('todos os rodapés usam a variante clara da logo', () => {
  const pages=['index','entrar','cadastro','categorias','categoria','prestador','painel','termos','privacidade'];
  for (const page of pages) assert.match(text(page+'.html'), /assets\/brand\/logo-horizontal-footer\.png/);
});
test('versão e workflows de publicação estão consistentes', () => {
  const p=JSON.parse(text('package.json'));
  assert.match(text('README.md').split('\n')[0], new RegExp(`v${p.version.replaceAll('.', '\\.')}\$`));
  assert.match(text('scripts/publicar-github.sh'), /require\('\.\/package\.json'\)\.version/);
  assert.match(text('README.md'), /docs\/versoes\//);
  assert.match(text('docs/operacao/PUBLICACAO-GITHUB.md'), /SeraQuemFaz/);
  assert.match(text('.github/workflows/ci.yml'), /node: \['22', '24'\]/);
  assert.match(text('.github/workflows/release.yml'), /gh release create/);
});
