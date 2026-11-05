const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file),'utf8');

test('catálogo de referência possui 51 áreas distintas, identificadas como não cadastradas', () => {
 const ctx = { window: {} }; vm.createContext(ctx);
 vm.runInContext(read('assets/category-original-images.js'),ctx);
 vm.runInContext(read('assets/catalog-preview.js'),ctx);
 const list = ctx.window.SQFCatalogPreview.categories;
 assert.equal(list.length,51);
 assert.equal(new Set(list.map(item=>item.id)).size,51);
 assert.ok(list.every(item => item.id.startsWith('ref-') && item.source==='reference' && item.status==='preview'));
 for(const word of ['Advogado','Barbeiro','Cabeleireiro','Contador','Costureiro','Ar-Condicionado'])
   assert.ok(list.some(c=>c.name===word),`${word} ausente`);
 assert.equal(ctx.window.SQFCatalogPreview.get('ref-barbearia'),null);
});

test('catálogo mantém categorias reais como prioridade e diferencia ausência de backend', () => {
 const script=read('assets/categories.js');
 assert.match(script,/referenceMode = remote\.length \? null : 'empty'/);
 assert.match(script,/referenceMode = 'error'/);
 assert.match(script,/allCategories = remote\.length \? remote : referenceCatalog\.slice\(\)/);
 assert.match(script,/categoria\.html\?ref=/);
 assert.match(script,/\.eq\('status', 'active'\)/);
 assert.match(read('categorias.html'),/data-reference-message/);
 const detail=read('assets/category-detail.js');
 assert.match(detail,/referenceCategory/);
 assert.match(detail,/Área de referência/);
 assert.match(detail,/Não há profissionais cadastrados/);
});

test('erros de e-mail do Supabase são reconhecidos sem contornar limite 429', () => {
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('assets/auth-feedback.js'),ctx);
 const api=ctx.window.SQFAuthFeedback;
 assert.equal(api.classify({status:429,code:'over_email_send_rate_limit',message:'email rate limit exceeded'}),'email-limit');
 assert.equal(api.classify({status:429,code:'too_many_requests'}),'rate-limit');
 assert.equal(api.classify({code:'email_address_not_authorized'}),'email-unauthorized');
 assert.match(api.message({status:429,code:'over_email_send_rate_limit'},'signup'),/Supabase.*limite/);
 assert.match(api.message({code:'email_address_not_authorized'},'signup'),/SMTP/);
 assert.match(read('assets/auth.js'),/signupInFlight/);
 assert.match(read('assets/auth.js'),/SQFAuthFeedback\.message\(error, 'signup'\)/);
});

test('preparação SQL do catálogo não sobrescreve registros existentes',()=>{
 const sql=read('supabase/bootstrap/00_categorias_publicas.sql');
 assert.match(sql,/create table if not exists public\.categories/i);
 assert.match(sql,/alter table public\.categories enable row level security/i);
 assert.match(sql,/using \(status='active'\)/i);
 assert.match(sql,/not exists\(select 1 from public\.categories\)/i);
 assert.doesNotMatch(sql,/delete from public\.categories|truncate table public\.categories/i);
});
