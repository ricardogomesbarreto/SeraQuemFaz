const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');

test('raiz contém páginas e arquivos de manutenção, sem prints históricos', () => {
  const rootItems=fs.readdirSync(root);
  assert.ok(!rootItems.some(x => /^PREVIA-|^previews-v/.test(x)));
  assert.ok(!rootItems.some(x => /^RELEASE-NOTES-v|^RELATORIO-VALIDACAO-v/.test(x)));
  for(const page of ['index','entrar','cadastro','painel','categorias','categoria','prestador','admin','privacidade','termos']) {
    assert.ok(fs.existsSync(path.join(root,page+'.html')));
  }
});

test('documentação foi agrupada e continua acessível', () => {
  for(const dir of ['contas','catalogo','financeiro','interface','seguranca','operacao','relatorios','versoes']){
    assert.ok(fs.statSync(path.join(root,'docs',dir)).isDirectory(),dir);
  }
  assert.ok(fs.existsSync(path.join(root,'docs/versoes/RELEASE-NOTES-v3.9.6.md')));
  assert.ok(fs.existsSync(path.join(root,'docs/operacao/PUBLICACAO-GITHUB.md')));
  assert.match(read('README.md'), /docs\/README\.md/);
});

test('páginas apontam para JS, CSS, logos e favicon existentes', () => {
  const pages=fs.readdirSync(root).filter(x=>x.endsWith('.html'));
  for(const page of pages){
    const html=read(page);
    for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      const v=m[1].split(/[?#]/)[0];
      if(!v || /^([a-z]+:|\/\/|#)/i.test(v)) continue;
      const full=path.resolve(root,decodeURIComponent(v));
      assert.ok(full.startsWith(root+path.sep),v);
      assert.ok(fs.existsSync(full),`${page}: ${v}`);
    }
  }
});

test('projeto conserva as rotas e módulos críticos de banco, catálogo e pagamento', () => {
  for(const name of ['assets/category-original-images.js','assets/categories.js','assets/category-detail.js','assets/account-compat.js','assets/auth.js','assets/site.css','supabase/migrations/20261104_12_conta_compatibilidade_legada.sql','supabase/functions/sqf-billing/index.ts']) {
    assert.ok(fs.existsSync(path.join(root,name)),name);
  }
});

test('script de distribuição publica apenas o site no pacote de hospedagem', () => {
  const script=read('scripts/build-distribution.sh');
  assert.match(script,/\*\.html/);
  assert.match(script,/\/assets/);
  assert.match(script,/SeraQuemFaz_site_v/);
  assert.match(script,/SeraQuemFaz_codigo_v/);
  assert.match(read('.gitignore'),/dist\//);
  assert.match(read('.github/workflows/release.yml'),/scripts\/build-distribution\.sh/);
});
