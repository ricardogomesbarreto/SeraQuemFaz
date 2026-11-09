'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('categorias ativas liberadas somente para leitura por usuários autenticados',()=>{
 const sql=read('supabase/migrations/20261109_15_authenticated_categories_rls.sql');
 assert.match(sql,/CREATE POLICY authenticated_read_active_categories/);
 assert.match(sql,/FOR SELECT TO authenticated/);
 assert.match(sql,/USING \(status = 'active'\)/);
 assert.match(sql,/IF NOT EXISTS/);
 assert.doesNotMatch(sql,/\bGRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\b/i);
 assert.doesNotMatch(sql,/\bDROP\s+(?:TABLE|POLICY)\b/i);
});

test('formulário de prestador recarrega categorias e não confunde falta de acesso com catálogo vazio',()=>{
 const js=read('assets/account.js'),html=read('painel.html');
 assert.match(js,/async function reloadActiveCategories\(\)/);
 assert.match(js,/\.from\('categories'\)/);
 assert.match(js,/\.eq\('status','active'\)/);
 assert.match(js,/if\(error\)throw error/);
 assert.match(js,/Falha ao consultar as categorias\. Clique em Recarregar categorias/);
 assert.match(js,/categories\.length\s*\?/);
 assert.match(js,/select\.disabled=!categories\.length/);
 assert.match(js,/save\.disabled=!categories\.length/);
 assert.match(js,/await reloadActiveCategories\(\)/);
 assert.doesNotMatch(js,/Ainda não há categorias ativas; entre em contato com a administração/);
 assert.match(html,/id="reloadCategories"/);
 assert.match(html,/id="newServiceCategory"/);
});
