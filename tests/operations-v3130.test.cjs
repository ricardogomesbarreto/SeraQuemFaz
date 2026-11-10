'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const context=vm.createContext({});vm.runInContext(read('assets/operations-view.js'),context);
const ops=context.SQFOps;
const rows=[
 {id:'a',starts_at:'2026-11-10T12:00:00Z',duration_minutes:60,status:'confirmed'},
 {id:'b',starts_at:'2026-11-10T12:30:00Z',duration_minutes:60,status:'proposed'},
 {id:'c',starts_at:'2026-11-10T13:30:00Z',duration_minutes:30,status:'confirmed'},
 {id:'d',starts_at:'2026-11-09T12:00:00Z',duration_minutes:60,status:'confirmed'},
 {id:'e',starts_at:'2026-11-10T12:15:00Z',duration_minutes:30,status:'canceled'},
 {id:'f',starts_at:'invalid',duration_minutes:60,status:'confirmed'}
];
const ids=x=>Array.from(x,r=>r.id);
const now=Date.parse('2026-11-10T12:15:00Z');
test('agenda separa próximos, histórico, situação e dia local',()=>{
 assert.deepEqual(ids(ops.agenda(rows,{now})),['a','b','c']);
 assert.deepEqual(ids(ops.agenda(rows,{now,period:'history'})),['e','d']);
 assert.deepEqual(ids(ops.agenda(rows,{now,status:'proposed'})),['b']);
 assert.deepEqual(ids(ops.agenda(rows,{now,period:'all',day:ops.dayKey(Date.parse(rows[0].starts_at))})),['a','e','b','c']);
});
test('alerta de conflito não inclui cancelados nem horários adjacentes',()=>{
 assert.deepEqual(Array.from(ops.conflicts(rows)).sort(),['a','b']);
});
test('portfólio agrupa por serviço, prioriza capas e permite filtrar',()=>{
 const photos=[{id:'1',service_id:'b',is_cover:false},{id:'2',service_id:'a',is_cover:false},{id:'3',service_id:'a',is_cover:true},{id:'4',service_id:'b',is_cover:true}];
 assert.deepEqual(ids(ops.portfolio(photos)),['3','2','4','1']);
 assert.deepEqual(ids(ops.portfolio(photos,{service:'b',coverOnly:true})),['4']);
});
test('contadores ausentes nunca viram zero; percentual somente com denominador válido',()=>{
 assert.equal(ops.count(null),null);assert.equal(ops.count(''),null);assert.equal(ops.count(-1),null);
 assert.equal(ops.count(0),0);assert.equal(ops.count('2'),2);
 assert.equal(ops.percentage(0,0),null);assert.equal(ops.percentage(2,1),null);
 assert.equal(ops.percentage(1,3),33.3);assert.equal(ops.percentage(0,3),0);
});
test('integração de agenda, portfólio e indicadores mantém consultas autorizadas',()=>{
 const panel=read('painel.html'),hub=read('assets/marketplace-hub.js'),account=read('assets/account.js'),admin=read('assets/admin-reports.js');
 for(const id of ['sqfAgendaPeriod','sqfAgendaStatus','sqfAgendaDay','sqfAgendaClear','portfolioCoverOnly','portfolioPhotoCount'])assert.ok(panel.includes('id="'+id+'"'));
 assert.ok(panel.includes('assets/operations-view.js'));
 assert.ok(hub.includes("client.from('sqf_appointments')"));
 assert.ok(hub.includes('ops.conflicts(agendaCache)'));
 assert.ok(account.includes(".eq('provider_id',user.id)"));
 assert.ok(account.includes('SQFOps.portfolio(data'));
 assert.ok(admin.includes("rpc('sqf_staff_dashboard_metrics')"));
 assert.ok(admin.includes("count(num)??'Indisponível'"));
 assert.ok(admin.includes('percentual histórico')||admin.includes('Percentual histórico'));
});
