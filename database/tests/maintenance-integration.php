<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Maintenance.php';
$db=sqfDatabase();
function check(bool $ok,string $m):void{if(!$ok)throw new RuntimeException($m);echo "PASS: $m\n";}
$id='00000000-0000-4000-8000-000000000001';
$expired=hash('sha256','maintenance-expired-token');$active=hash('sha256','maintenance-active-token');
$old=hash('sha256','maintenance-expired-limit');$fresh=hash('sha256','maintenance-active-limit');
sqfQuery($db,"INSERT INTO sqf_auth_tokens(token_hash,user_id,purpose,expires_at) VALUES (?,?,'reset',DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY)),(?,?,'reset',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[$expired,$id,$active,$id]);
sqfQuery($db,"INSERT INTO sqf_auth_limits(bucket,attempts,expires_at) VALUES (?,1,DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY)),(?,1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[$old,$fresh]);
$result=sqfCleanupAuth($db);
check(!$result['busy']&&$result['tokens']>=1&&$result['limits']>=1,'maintenance removes expired auth metadata');
check(!sqfQuery($db,'SELECT 1 FROM sqf_auth_tokens WHERE token_hash=?',[$expired])->fetchColumn(),'expired token removed');
check((bool)sqfQuery($db,'SELECT 1 FROM sqf_auth_tokens WHERE token_hash=?',[$active])->fetchColumn(),'active token preserved');
check(!sqfQuery($db,'SELECT 1 FROM sqf_auth_limits WHERE bucket=?',[$old])->fetchColumn(),'expired limit removed');
check((bool)sqfQuery($db,'SELECT 1 FROM sqf_auth_limits WHERE bucket=?',[$fresh])->fetchColumn(),'active limit preserved');
sqfQuery($db,'DELETE FROM sqf_auth_tokens WHERE token_hash=?',[$active]);
sqfQuery($db,'DELETE FROM sqf_auth_limits WHERE bucket=?',[$fresh]);
