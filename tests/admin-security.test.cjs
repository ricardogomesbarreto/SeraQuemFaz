const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(base,file),'utf8');
const sql=read('supabase/migrations/20261103_04_painel_admin_mfa.sql');
const html=read('admin.html');
const js=read('assets/admin.js');

test('painel administrativo existe, com HTML e JavaScript locais',()=>{
 assert.match(html,/<html lang="pt-BR">/);
 assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive"/);
 assert.match(html,/assets\/admin\.js/);
 assert.match(html,/id="adminContent" hidden/);
 assert.match(html,/id="mfaSection"/);
 assert.match(read('painel.html'),/id="adminAccessLink"[^>]*hidden/);
});

test('tabela de membros não concede acesso direto a anon ou authenticated',()=>{
 assert.match(sql,/create table if not exists public\.sqf_admin_members/);
 assert.match(sql,/alter table public\.sqf_admin_members enable row level security/);
 assert.match(sql,/revoke all on public\.sqf_admin_members from public, anon, authenticated/);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete) on public\.sqf_admin_members to authenticated/i);
});

test('cada RPC de decisão aplica papel no servidor e exige MFA AAL2',()=>{
 assert.match(sql,/auth\.jwt\(\)->>'aal'/);
 assert.match(sql,/<> 'aal2'/);
 assert.match(sql,/sqf_require_staff\(p_queue in \('providers','privacy'\)\)/);
 assert.match(sql,/sqf_require_staff\(p_queue in \('providers','privacy','audit'\)\)/);
 assert.match(sql,/grant execute on function public\.sqf_staff_decide\(text,uuid,text,text\) to authenticated/);
 assert.match(sql,/revoke all on function public\.sqf_staff_decide\(text,uuid,text,text\) from public, anon, authenticated/);
});

test('funções de privilégio usam SECURITY DEFINER com search_path fixado',()=>{
 for(const fname of ['sqf_require_staff','sqf_staff_whoami','sqf_staff_overview','sqf_staff_queue','sqf_staff_decide']){
   assert.match(sql,new RegExp(`function public\\.${fname}\\(`));
 }
 assert.equal((sql.match(/security definer set search_path = ''/g)||[]).length,5);
 assert.doesNotMatch(sql,/execute\s+format\s*\(/i);
 assert.doesNotMatch(sql,/execute\s+\$\$.*?\|/is);
});

test('decisões administrativas possuem justificativa, status e trilha de auditoria',()=>{
 assert.match(sql,/char_length\(v_note\) < 20/);
 assert.match(sql,/for update/);
 assert.match(sql,/insert into public\.sqf_staff_decision_log\(/);
 assert.match(sql,/new_status text not null/);
 assert.match(sql,/p_action='suspend'/);
 assert.match(sql,/p_action='publish'/);
 assert.match(sql,/p_action='resolve'/);
});

test('políticas restritivas limitam acesso a dados mesmo se houver policies permissivas',()=>{
 for(const name of ['profiles','provider_services','portfolio_photos','reviews','provider_verifications','safety_reports','privacy_requests']){
   assert.match(sql,new RegExp(`create policy sqf_\\w+_limit on public\\.${name} as restrictive`));
 }
});

test('frontend só usa RPCs; dados externos são inseridos como textContent',()=>{
 for(const fn of ['sqf_staff_whoami','sqf_staff_overview','sqf_staff_queue','sqf_staff_decide'])assert.ok(js.includes(fn));
 assert.match(js,/textContent=String\(value\)/);
 assert.doesNotMatch(js,/innerHTML\s*=/);
 assert.doesNotMatch(js,/service_role|SUPABASE_SERVICE_ROLE|sb_secret_/i);
 assert.match(js,/auth\.mfa\.challengeAndVerify/);
 assert.match(js,/auth\.mfa\.enroll/);
 assert.match(js,/role!=='admin'/);
});

test('plano de segurança não afirma execução remota nem validação de identidade',()=>{
 const documentation=read('docs/seguranca/PAINEL-ADMINISTRATIVO-SEGURANCA.md');
 assert.match(documentation,/homologação/i);
 assert.match(documentation,/SQL Editor/);
 assert.match(documentation,/não comprovam a identidade/i);
 assert.match(read('docs/versoes/RELEASE-NOTES-v3.5.0.md'),/Não foi executada nenhuma migração/);
});
