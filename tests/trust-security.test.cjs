const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const sql = read('supabase/migrations/20261103_03_confianca_seguranca.sql');

test('prestador só aparece publicamente com aprovação administrativa e is_public', () => {
  assert.match(sql, /create or replace function public\.sqf_provider_public/);
  assert.match(sql, /p\.is_public\s+and\s+v\.status\s*=\s*'approved'/);
  assert.match(sql, /drop policy if exists sqf_profiles_read/);
  assert.match(sql, /public\.sqf_provider_public\(id\)/);
  assert.match(sql, /public\.sqf_provider_public\(provider_id\)/);
  assert.match(sql, /revoke all on public\.provider_verifications from anon, authenticated/);
  assert.doesNotMatch(sql, /grant (?:update|insert).*provider_verifications.*authenticated/i);
});

test('atendimento depende das duas contas e exige e-mail confirmado antes de avaliar', () => {
  assert.match(sql, /create table if not exists public\.service_engagements/);
  assert.match(sql, /unique \(client_id, provider_id\)/);
  assert.match(sql, /sqf_engagement_insert/);
  assert.match(sql, /sqf_engagement_confirm/);
  assert.match(sql, /sqf_email_confirmed\(client_id\)/);
  assert.match(sql, /sqf_review_integrity/);
  assert.match(sql, /moderation_status='pending'/);
  assert.match(sql, /moderation_status='published'/);
  assert.match(sql, /sqf_reviews_engagement_unique/);
});

test('RLS impede cliente aprovar a própria avaliação e consulta pública não expõe reviewer_id', () => {
  assert.match(sql, /revoke all on public\.reviews from anon, authenticated/);
  assert.match(sql, /grant insert \(provider_id,reviewer_id,engagement_id,rating,comment\)/);
  assert.doesNotMatch(sql, /grant update .*public\.reviews to authenticated/);
  const fn = sql.match(/create or replace function public\.sqf_public_reviews[\s\S]*?\$\$;/)?.[0] || '';
  assert.ok(fn);
  assert.doesNotMatch(fn, /reviewer_id/);
  assert.match(fn, /moderation_status='published'/);
});

test('denúncias, pedidos LGPD e trilha de auditoria têm tabelas protegidas', () => {
  for (const t of ['safety_reports','privacy_requests','sqf_moderation_audit']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}`));
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on public\\.${t} from anon, authenticated`));
  }
  assert.match(sql, /sqf_audit_moderation/);
});

test('interface oferece avaliação moderada, confirmação, denúncia, solicitação LGPD e análise cadastral', () => {
  for (const id of ['engagementRequest','reviewForm','reportForm','reportReason','reportDetails'])
    assert.ok(read('prestador.html').includes(`id="${id}"`), id);
  for (const id of ['providerVerificationStatus','requestVerification','pendingEngagements','privacyRequestForm'])
    assert.ok(read('painel.html').includes(`id="${id}"`), id);
  for (const js of ['provider.js','account.js']) assert.doesNotMatch(read(`assets/${js}`),/\.innerHTML\s*=/);
  assert.match(read('assets/account.js'),/createImageBitmap/);
  assert.match(read('assets/account.js'),/toBlob/);
});

test('cabeçalhos de segurança configuráveis e documentação não afirma deploy no Supabase', () => {
  for (const f of ['.htaccess','_headers']) {
    const hdr=read(f);
    assert.match(hdr,/Content-Security-Policy/);
    assert.match(hdr,/X-Content-Type-Options/);
    assert.match(hdr,/frame-ancestors/);
  }
  assert.match(read('docs/seguranca/SEGURANCA-E-HOMOLOGACAO.md'),/não foram aplicadas no Supabase remoto/);
});
