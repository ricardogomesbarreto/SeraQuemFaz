const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('reschedule candidate preserves confirmed reservation until acceptance',()=>{
 const sql=read('supabase/homologation/reschedule_candidate.sql');
 assert.match(sql,/IF a\.status='confirmed' THEN\s+UPDATE public\.sqf_appointments SET pending_starts_at=p_starts_at/);
 assert.match(sql,/SET starts_at=pending_starts_at,duration_minutes=pending_duration_minutes/);
 assert.match(sql,/EXCEPTION WHEN exclusion_violation/);
 assert.match(sql,/pending_proposed_by IN \(client_id,provider_id\)/);
});
test('agenda exposes pending proposal to recipient',()=>{
 const ui=read('assets/appointment-ui.js');
 assert.match(ui,/pending_proposed_by!==user\.id/);
 assert.match(ui,/Confirmar reagendamento/);
 assert.match(ui,/Recusar reagendamento/);
});
