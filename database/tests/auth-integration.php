<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Auth.php';
$db=sqfDatabase();
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);echo "PASS: $message\n";}
function deny(callable $action,string $message):void{try{$action();}catch(DomainException $e){check(true,$message);return;}throw new RuntimeException($message);}
$email='auth-fixture@example.invalid';$password='fixture-password-12345';
$u=sqfRegister($db,$email,$password,'Teste de autenticação','cliente');
check(strlen($u['id'])===36,'identity created');
check(password_verify($password,sqfQuery($db,'SELECT password_hash FROM sqf_auth_users WHERE id=?',[$u['id']])->fetchColumn()),'password hashed');
check(!sqfQuery($db,'SELECT 1 FROM sqf_auth_tokens WHERE token_hash=?',[$u['token']])->fetchColumn(),'raw token not persisted');
deny(fn()=>sqfLogin($db,$email,$password),'unverified email cannot login');
sqfConsumeToken($db,$u['token'],'verify');
deny(fn()=>sqfConsumeToken($db,$u['token'],'verify'),'verification token single use');
deny(fn()=>sqfLogin($db,$email,'incorrect-password'),'wrong password rejected');
$s=sqfLogin($db,$email,$password);
check(sqfSessionUser($db,$s)===$u['id'],'valid session');
$token=sqfRequestAuthToken($db,$email,'reset');
check(is_string($token),'reset token issued');
deny(fn()=>sqfConsumeToken($db,$token,'verify'),'reset token cannot be used for email verification');
sqfQuery($db,'UPDATE sqf_auth_tokens SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE token_hash=?',[hash('sha256',$token)]);
deny(fn()=>sqfConsumeToken($db,$token,'reset','new-fixture-password-5678'),'expired reset token rejected');
$token=sqfRequestAuthToken($db,$email,'reset');
check(is_string($token),'new reset token replaces the expired one');
$replacement='new-fixture-password-5678';
sqfConsumeToken($db,$token,'reset',$replacement);
deny(fn()=>sqfConsumeToken($db,$token,'reset',$replacement),'reset token single use');
check(sqfSessionUser($db,$s)===null,'password reset revokes old session');
deny(fn()=>sqfLogin($db,$email,$password),'old password rejected');
check(sqfLogin($db,$email,$replacement)['id']===$u['id'],'new password works');
check(sqfRequestAuthToken($db,'unknown@example.invalid','reset')===null,'unknown email no token');
sqfAuthLimit($db,'fixture-test-limit',2,900);sqfAuthLimit($db,'fixture-test-limit',2,900);
deny(fn()=>sqfAuthLimit($db,'fixture-test-limit',2,900),'rate limit enforced');
deny(fn()=>sqfRegister($db,'other@example.invalid','short','Fixture','cliente'),'weak password rejected');


require_once __DIR__.'/../../backend/src/AccountSecurity.php';
$before=sqfLogin($db,$email,$replacement);
deny(fn()=>sqfChangePassword($db,$u['id'],'incorrect-password',$password),'wrong current password rejected');
sqfChangePassword($db,$u['id'],$replacement,$password);
check(sqfSessionUser($db,$before)===null,'password change revokes prior sessions');
$rotated=sqfLogin($db,$email,$password);
sqfRevokeSessions($db,$u['id'],$password);
check(sqfSessionUser($db,$rotated)===null,'revoke all invalidates existing sessions');
sqfChangePassword($db,$u['id'],$password,$replacement);
sqfNotificationPreference($db,$u['id'],true);
check(sqfAccountSecurity($db,$u['id'])['email_enabled']===true,'email preference stored');
sqfNotificationPreference($db,$u['id'],false);
check(sqfAccountSecurity($db,$u['id'])['email_enabled']===false,'email preference opt-out stored');

require_once __DIR__.'/../../backend/src/PrivacyExport.php';
$exportId=(string)sqfQuery($db,'SELECT id FROM sqf_auth_users WHERE email=?',['auth-fixture@example.invalid'])->fetchColumn();
$export=sqfOwnPrivacyExport($db,$exportId);
if($export['identity']['id']!==$exportId||$export['identity']['email']!=='auth-fixture@example.invalid')throw new RuntimeException('Privacy export owner mismatch');
if(isset($export['identity']['password_hash'])||isset($export['identity']['auth_version']))throw new RuntimeException('Privacy export contains credentials');
echo "PASS: self-service export excludes password hashes and auth version\n";
