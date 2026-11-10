<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Agenda.php';
$db = new PDO(getenv('SQF_DB_DSN') ?: 'mysql:host=127.0.0.1;port=3306;dbname=sqf_test;charset=utf8mb4', getenv('SQF_DB_USER') ?: 'root', getenv('SQF_DB_PASSWORD') ?: '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET time_zone='+00:00'");
function check(bool $v,string $m):void { if (!$v) throw new RuntimeException($m); echo "PASS: $m\n"; }
function reject(callable $f,string $m):void { try { $f(); } catch (DomainException $e) {check(true,$m);return;} throw new RuntimeException($m); }
function execq(PDO $db,string $s,array $a):void {$q=$db->prepare($s);$q->execute($a);}
$u=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
foreach($u as $i=>$id){execq($db,'INSERT INTO sqf_auth_users(id,email) VALUES (?,?)',[$id,"fixture$i@example.invalid"]);execq($db,'INSERT INTO profiles(id,full_name,account_type) VALUES (?,?,?)',[$id,"Fixture $i",$i===1?'prestador':'cliente']);}
execq($db,'INSERT INTO sqf_ibge_municipalities(code,name,uf,ibge_uf) VALUES (?,?,?,?)',['2111300','São Luís','MA',21]);
$service='00000000-0000-4000-8000-000000000010';
execq($db,'INSERT INTO provider_services(id,provider_id,category_id,service_title) VALUES (?,?,?,?)',[$service,$u[1],'fixture','Serviço de teste']);
$requests=['00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012'];
foreach($requests as $i=>$id)execq($db,'INSERT INTO sqf_service_requests(id,client_id,provider_id,service_id,city_ibge,description,status) VALUES (?,?,?,?,?,?,?)',[$id,$u[$i===0?0:2],$u[1],$service,'2111300','Solicitação fictícia para teste de agenda','accepted']);
$old=gmdate('Y-m-d\TH:i:s\Z',time()+86400);$new=gmdate('Y-m-d\TH:i:s\Z',time()+172800);
$first=$requests[0];$second=$requests[1];
check(sqfAgenda($db,$u[0],$first,'propose',$old,60)==='proposed','initial proposal');
reject(fn()=>sqfAgenda($db,$u[0],$first,'confirm'),'proposer cannot confirm own proposal');
reject(fn()=>sqfAgenda($db,$u[2],$first,'confirm'),'third party cannot access request');
check(sqfAgenda($db,$u[1],$first,'confirm')==='confirmed','recipient confirms');
check(sqfAgenda($db,$u[1],$first,'propose',$new,60)==='reschedule_proposed','reschedule pending');
$read=fn()=> $db->query("SELECT * FROM sqf_appointments WHERE request_id='$first'")->fetch(PDO::FETCH_ASSOC);
$a=$read();check($a['status']==='confirmed' && $a['pending_starts_at']!==null && str_starts_with($a['starts_at'],substr($old,0,10)),'old reservation preserved');
check(sqfAgenda($db,$u[0],$first,'decline')==='confirmed' && $read()['pending_starts_at']===null,'decline preserves reservation');
sqfAgenda($db,$u[2],$second,'propose',$new,60);sqfAgenda($db,$u[1],$second,'confirm');
sqfAgenda($db,$u[1],$first,'propose',$new,60);
reject(fn()=>sqfAgenda($db,$u[0],$first,'confirm'),'overlap rejected');
check($read()['status']==='confirmed' && $read()['pending_starts_at']!==null,'conflict rolls back and preserves proposal');
sqfAgenda($db,$u[1],$second,'cancel');
check(sqfAgenda($db,$u[0],$first,'confirm')==='confirmed' && $read()['pending_starts_at']===null,'reschedule accepted after conflict cleared');
check(str_starts_with($read()['starts_at'],substr($new,0,10)),'new reservation persisted');
try {execq($db,'UPDATE sqf_appointments SET duration_minutes=10 WHERE request_id=?',[$first]);throw new RuntimeException('invalid duration accepted');} catch(PDOException $e){check(true,'database check rejects invalid duration');}

require __DIR__.'/../../backend/src/Marketplace.php';
execq($db,'UPDATE sqf_auth_users SET email_confirmed_at=UTC_TIMESTAMP(6) WHERE id=?',[$u[0]]);
execq($db,'UPDATE profiles SET city_ibge=?,is_public=1 WHERE id=?',['2111300',$u[1]]);
execq($db,'INSERT INTO sqf_billing_settings(singleton,require_paid_subscription,checkout_enabled) VALUES (1,0,0)',[]);
execq($db,"INSERT INTO provider_verifications(provider_id,status) VALUES (?,'pending')",[$u[1]]);
check(count(sqfCatalog($db,'2111300'))===0,'unapproved provider hidden');
execq($db,"UPDATE provider_verifications SET status='approved' WHERE provider_id=?",[$u[1]]);
check(count(sqfCatalog($db,'2111300'))===1,'approved provider visible');
check(!sqfProviderPublic($db,$u[0]),'client never public');
$service2='00000000-0000-4000-8000-000000000020';
execq($db,'INSERT INTO provider_services(id,provider_id,category_id,service_title) VALUES (?,?,?,?)',[$service2,$u[1],'fixture','Segundo serviço']);
$id=sqfCreateRequest($db,$u[0],$u[1],$service2,'Solicitação fictícia para testar contratação completa');
check(strlen($id)===36,'create request with UUID');
check(strlen(sqfSendMessage($db,$u[0],$id,'Mensagem privada de teste'))===36,'participant sends message');
check(count(sqfMessages($db,$u[1],$id))===1,'recipient reads private message');
reject(fn()=>sqfMessages($db,$u[2],$id),'third party cannot read messages');
reject(fn()=>sqfSendMessage($db,$u[2],$id,'Mensagem não autorizada'),'third party cannot send message');
check((int)sqfQuery($db,"SELECT COUNT(*) FROM sqf_notifications WHERE request_id=? AND recipient_id=? AND kind='message'",[$id,$u[1]])->fetchColumn()===1,'recipient receives message notification');
reject(fn()=>sqfCreateRequest($db,$u[0],$u[1],$service2,'Solicitação duplicada para testar contratação'),'duplicate rejected');
reject(fn()=>sqfSendQuote($db,$u[0],$id,1500,'Condições de teste'),'client cannot quote');
check(sqfSendQuote($db,$u[1],$id,1500,'Condições de teste')==='quoted','provider sends quote');
reject(fn()=>sqfRequestAction($db,$u[2],$id,'accept'),'third party cannot accept');
check(sqfRequestAction($db,$u[0],$id,'accept')==='accepted','client accepts quote');
check(sqfRequestAction($db,$u[1],$id,'start')==='in_progress','provider starts');
check(sqfRequestAction($db,$u[1],$id,'finish')==='awaiting_confirmation','provider finishes');
check(sqfRequestAction($db,$u[0],$id,'confirm')==='completed','client completes');
check((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_request_events WHERE request_id=?',[$id])->fetchColumn()===6,'request audit history persists');
execq($db,"UPDATE provider_verifications SET status='suspended' WHERE provider_id=?",[$u[1]]);
check(count(sqfCatalog($db,'2111300'))===0,'suspended provider hidden');

require __DIR__.'/../../backend/src/Services.php';
$category=(string)sqfQuery($db,"SELECT id FROM categories WHERE status='active' LIMIT 1")->fetchColumn();
check($category!=='','seeded category available');
reject(fn()=>sqfSaveService($db,$u[0],null,$category,'Serviço proibido','',null,null),'client cannot create provider service');
$service3=sqfSaveService($db,$u[1],null,$category,'Serviço novo homologação','Descrição do serviço',5000,15000);
check(strlen($service3)===36,'provider can create own service');
reject(fn()=>sqfSaveService($db,$u[0],$service3,$category,'Alteração indevida','',null,null),'client cannot change provider service');
check(count(sqfOwnServices($db,$u[1]))>=1,'provider can list own services');
reject(fn()=>sqfOwnServices($db,$u[0]),'client cannot list provider management');
check(sqfPublicProvider($db,$u[1])===null,'suspended provider public detail hidden');
execq($db,"UPDATE provider_verifications SET status='approved' WHERE provider_id=?",[$u[1]]);
check(sqfPublicProvider($db,$u[1])!==null,'approved provider public detail available');
sqfToggleService($db,$u[1],$service3,false);
check(!in_array($service3,array_column(sqfPublicProvider($db,$u[1])['services'],'id'),true),'inactive service excluded from public profile');
reject(fn()=>sqfToggleService($db,$u[0],$service3,true),'client cannot toggle service');
