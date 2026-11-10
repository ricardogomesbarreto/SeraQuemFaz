'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('migração de serviços só remove política duplicada se predicados forem iguais',()=>{
  const sql=read('supabase/migrations/20261110_19_single_provider_services_read_policy.sql');
  assert.match(sql,/current_policy IS NULL/);
  assert.match(sql,/current_policy IS DISTINCT FROM duplicate_policy/);
  assert.match(sql,/Políticas não equivalentes/);
  assert.match(sql,/roles @> ARRAY\['anon','authenticated'\]::name\[\]/);
  assert.match(sql,/DROP POLICY IF EXISTS sqf_services_approval_guard/);
  assert.doesNotMatch(sql,/DROP POLICY (?:IF EXISTS )?sqf_provider_services_read/);
  assert.doesNotMatch(sql,/DISABLE ROW LEVEL SECURITY|GRANT ALL|USING\s*\(\s*true\s*\)/i);
});
test('catálogo tolera falha de avaliações preservando consulta de profissionais',()=>{
  const js=read('assets/category-detail.js');
  assert.match(js,/if\(ep\)throw ep;/);
  assert.match(js,/if\(er\)\{/);
  assert.match(js,/reviewsAvailable=false;/);
  assert.match(js,/Avaliações temporariamente indisponíveis/);
  assert.match(js,/reviewControl\.disabled=true/);
  assert.match(js,/reviewsAvailable\?reviews\.filter/);
  assert.match(js,/\.eq\('is_active',true\)/);
  assert.match(js,/\.eq\('is_public',true\)\.eq\('city_ibge',city\.id\)/);
  assert.doesNotMatch(js,/if\s*\(ep\s*\|\|\s*er\)\s*throw/);
});
test('filtros de mensagens atualizam estado antes de marcar abas selecionadas',()=>{
  const js=read('assets/request-portal.js');
  const before=js.indexOf("if(!unread&&control.value==='unread')control.value='all';");
  const after=js.indexOf("button.setAttribute('aria-pressed'",before);
  assert.ok(before>=0&&after>before);
  assert.match(js,/button\.disabled=!unread/);
  assert.match(js,/String\(item\.description\|\|''\)/);
});
test('hash inválido não impede inicialização de painel autenticado',()=>{
  const js=read('assets/dashboard-router.js');
  assert.match(js,/try\{id=decodeURIComponent\(location\.hash\.slice\(1\)\|\|''\);\}/);
  assert.match(js,/catch\{return 'visao-geral';\}/);
  assert.match(js,/scrollIntoView\(\{block:'start',behavior:'auto'\}\)/);
});
test('versão 3.11.2 não altera checkout nem expõe chaves secretas',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'3.11.2');
  assert.equal(read('version.txt').trim(),'3.11.2');
  const jsFiles=['assets/category-detail.js','assets/dashboard-router.js','assets/request-portal.js'];
  for(const file of jsFiles){
    const js=read(file);
    assert.doesNotMatch(js,/service_role\s*[:=]|secret_[A-Za-z0-9_-]{30,}/);
  }
});
