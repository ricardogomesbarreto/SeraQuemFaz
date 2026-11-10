<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/MigrationPreflight.php';
$db=sqfDatabase();
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);echo "PASS: $m\n";}
function reject(callable $f,string $m):void{try{$f();}catch(DomainException $e){check(true,$m);return;}throw new RuntimeException($m);}
$id='00000000-0000-4000-8000-000000000090';
$fixture=['identities'=>[['id'=>$id,'email'=>'migration-fixture@example.invalid','email_confirmed_at'=>'2026-01-01T12:00:00Z','created_at'=>'2025-12-01T12:00:00Z']],'profiles'=>[['id'=>$id,'full_name'=>'Prestador de teste','account_type'=>'prestador','city_ibge'=>'2111300','bio'=>'Teste']]];
$result=sqfPreflightIdentities($db,$fixture);
check($result['identities']===1&&$result['profiles']===1&&$result['providers_pending']===1&&!$result['committed'],'identity/profile dry run validates original UUID');
check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'dry run leaves no identities');
check((int)$db->query('SELECT COUNT(*) FROM profiles')->fetchColumn()===0,'dry run leaves no profiles');
$bad=$fixture;$bad['profiles'][0]['city_ibge']='0000000';
reject(fn()=>sqfPreflightIdentities($db,$bad),'unknown city rejected and rolled back');
$bad=$fixture;$bad['identities'][0]['password_hash']='not-importable';
reject(fn()=>sqfPreflightIdentities($db,$bad),'credentials not accepted in snapshot');
$bad=$fixture;$bad['profiles'][0]['id']='00000000-0000-4000-8000-000000000091';
reject(fn()=>sqfPreflightIdentities($db,$bad),'orphan profile rejected');
$bad=$fixture;$bad['identities'][]=$bad['identities'][0];$bad['profiles'][]=$bad['profiles'][0];
reject(fn()=>sqfPreflightIdentities($db,$bad),'duplicate identity rejected');
check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'failed preflight leaves database empty');
