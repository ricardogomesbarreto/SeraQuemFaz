<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Auth.php';
$db=sqfDatabase();
$id='00000000-0000-4000-8000-000000000002';
sqfQuery($db,'UPDATE sqf_auth_users SET password_hash=?,email_confirmed_at=UTC_TIMESTAMP(6) WHERE id=?',[sqfPassword('browser-provider-12345'),$id]);
echo "PASS: provider browser fixture ready\n";

// Disposable moderator fixture; never used by production.
$staff='00000000-0000-4000-8000-000000000003';
sqfQuery($db,'UPDATE sqf_auth_users SET password_hash=?,email_confirmed_at=UTC_TIMESTAMP(6) WHERE id=?',[sqfPassword('browser-staff-12345'),$staff]);
sqfQuery($db,"UPDATE sqf_admin_members SET active=1,role='moderator' WHERE user_id=?",[$staff]);
sqfQuery($db,'DELETE FROM sqf_staff_mfa_state WHERE user_id=?',[$staff]);
echo "PASS: moderator browser fixture ready\n";

$admin='00000000-0000-4000-8000-000000000099';
sqfQuery($db,'INSERT INTO sqf_auth_users(id,email,password_hash,email_confirmed_at) VALUES (?,?,?,UTC_TIMESTAMP(6))',[$admin,'browser-admin@example.invalid',sqfPassword('browser-admin-12345')]);
sqfQuery($db,"INSERT INTO profiles(id,full_name,account_type) VALUES (?,'CI Admin','cliente')",[$admin]);
sqfQuery($db,"INSERT INTO sqf_admin_members(user_id,role,active) VALUES (?,'admin',1)",[$admin]);

// Exercise administrator-only read paths against disposable database fixtures.
require_once __DIR__.'/../../backend/src/Moderation.php';
require_once __DIR__.'/../../backend/src/Billing.php';
require_once __DIR__.'/../../backend/src/AccountCases.php';
if(sqfRequireStaff($db,$admin)!=='admin')throw new RuntimeException('Admin fixture role mismatch');
$billing=sqfStaffBilling($db,$admin);
if(!array_key_exists('active_paid',$billing)||!isset($billing['invoices']))throw new RuntimeException('Invalid administrator billing summary');
$cases=sqfStaffCases($db,$admin);
if(!isset($cases['privacy'],$cases['support']))throw new RuntimeException('Invalid administrator case queues');
foreach([$staff,$id] as $actor){
    foreach(['sqfStaffBilling','sqfStaffCases'] as $read){
        try{$read($db,$actor);throw new LogicException('Unauthorized administrative read');}
        catch(DomainException $e){echo "PASS: administrative read denied for non-admin fixture\n";}
    }
}
echo "PASS: administrator billing and privacy queues available with role isolation\n";
