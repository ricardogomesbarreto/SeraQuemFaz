'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('supabase/migrations/20261104_10_resiliencia_solicitacoes.sql');
const portal=read('assets/request-portal.js');
const profile=read('assets/request-profile.js');
const media=read('assets/request-media.js');

test('recibos de leitura privados com RLS, sem gravar diretamente pelo navegador',()=>{
 assert.match(sql,/create table if not exists public\.sqf_request_read_receipts/);
 assert.match(sql,/alter table public\.sqf_request_read_receipts enable row level security/);
 assert.match(sql,/revoke all on public\.sqf_request_read_receipts from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.sqf_request_read_receipts to authenticated/);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete) on public\.sqf_request_read_receipts to authenticated/);
 assert.match(sql,/user_id=\(select auth\.uid\(\)\) and public\.sqf_is_request_participant\(request_id\)/);
});
test('marcação de leitura verifica a participação antes de qualquer escrita',()=>{
 assert.match(sql,/create or replace function public\.sqf_mark_request_read\(p_request uuid\)/);
 assert.match(sql,/if v_uid is null or not public\.sqf_is_request_participant\(p_request\)/);
 assert.match(sql,/on conflict\(request_id,user_id\) do update/);
 assert.match(sql,/grant execute on function public\.sqf_mark_request_read\(uuid\) to authenticated/);
});
test('contagem de mensagens não lidas é restrita às próprias solicitações',()=>{
 assert.match(sql,/create or replace function public\.sqf_request_unread_counts\(\)/);
 assert.match(sql,/m\.sender_id<>\(select auth\.uid\(\)\)/);
 assert.match(sql,/where r\.client_id=\(select auth\.uid\(\)\) or r\.provider_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/grant execute on function public\.sqf_request_unread_counts\(\) to authenticated/);
});
test('cotas de mensagens e solicitações usam lock transacional por conta',()=>{
 assert.match(sql,/pg_advisory_xact_lock\(39101,pg_catalog\.hashtext\(v_client::text\)\)/);
 assert.match(sql,/pg_advisory_xact_lock\(39102,pg_catalog\.hashtext\(new\.sender_id::text\)\)/);
 assert.match(sql,/Limite diário de solicitações excedido/);
 assert.match(sql,/Limite horário de mensagens excedido/);
});
test('aceite de orçamento impede prestador suspenso após enviar a proposta',()=>{
 assert.match(sql,/if v_next='accepted' and not public\.sqf_provider_public\(v_req\.provider_id\)/);
 assert.match(sql,/v_actor not in \(v_req\.client_id,v_req\.provider_id\)/);
 assert.match(sql,/insert into public\.sqf_request_events/);
});
test('armazenamento só permite excluir anexos próprios não registrados',()=>{
 assert.match(sql,/sqf_request_orphan_cleanup_allowed/);
 assert.match(sql,/and not exists\(select 1 from public\.sqf_request_attachments a where a\.storage_path=p_path\)/);
 assert.match(sql,/split_part\(p_path,'\/',2\)=\(select auth\.uid\(\)\)::text/);
 assert.match(sql,/for delete to authenticated/);
 assert.match(media,/await storage\.remove\(\[storagePath\]\)/);
});
test('portal indica não lidas somente quando o servidor retorna a contagem',()=>{
 assert.match(portal,/sqf_request_unread_counts/);
 assert.match(portal,/if\(error\|\|!Array\.isArray\(data\)\)\{unread=null;return;\}/);
 assert.match(portal,/sqf_mark_request_read/);
 assert.match(portal,/if\(!messages\.error && current===selectionSequence\)/);
 assert.match(portal,/if\(current!==selectionSequence\)return/);
 assert.match(read('painel.html'),/id="sqfRequestSummary"/);
 assert.match(read('assets/site.css'),/\.sqf-unread-badge/);
});
test('pedido não é criado com foto inválida e data usa calendário local',()=>{
 assert.match(profile,/getTimezoneOffset\(\)/);
 assert.match(profile,/Nenhum pedido foi enviado/);
 assert.match(profile,/image\/jpeg','image\/png','image\/webp/);
 assert.match(profile,/file\.size>5\*1024\*1024/);
 assert.match(profile,/date\.value<date\.min\|\|date\.value>date\.max/);
});
test('recursos financeiros permanecem desabilitados por padrão',()=>{
 assert.match(read('assets/billing-config.js'),/enabled: false/);
 assert.match(read('.github/workflows/billing-reconciliation.yml'),/SQF_FINANCIAL_RECONCILIATION_ENABLED == 'true'/);
});

test('janela de data do servidor tolera diferença de fuso, mas o formulário exige dia local válido',()=>{
 assert.match(sql,/desired_date >= \(created_at::date - 1\)/);
 assert.match(sql,/p_desired_date < current_date - 1 or p_desired_date > current_date \+ 366/);
 assert.match(profile,/date.value<date.min\|\|date.value>date.max/);
});
