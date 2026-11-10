<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Auth.php';
$db=sqfDatabase();
$id='00000000-0000-4000-8000-000000000002';
sqfQuery($db,'UPDATE sqf_auth_users SET password_hash=?,email_confirmed_at=UTC_TIMESTAMP(6) WHERE id=?',[sqfPassword('browser-provider-12345'),$id]);
echo "PASS: provider browser fixture ready\n";
