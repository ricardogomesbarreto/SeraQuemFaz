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
