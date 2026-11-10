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

