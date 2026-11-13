<?php
declare(strict_types=1);
require_once __DIR__.'/../../backend/src/Database.php';
require_once __DIR__.'/../../backend/src/AdminBootstrap.php';
$db=sqfDatabase();
function assertBootstrap(bool $yes,string $label):void{if(!$yes)throw new RuntimeException($label);echo "PASS: ".$label."\n";}
function denyBootstrap(callable $fn,string $label):void {
 try{$fn();}catch(DomainException $e){assertBootstrap(true,$label);return;}
 throw new RuntimeException($label);
}
$dir=sys_get_temp_dir().'/sqf-bootstrap-'.bin2hex(random_bytes(7));
mkdir($dir,0700);
putenv('SQF_MAIL_SETTINGS_TEST_DIR='.$dir);
$email='initial-admin-'.bin2hex(random_bytes(6)).'@example.invalid';
$password='fixture-bootstrap-long-secret-2026';
$secret=str_repeat('a3',20);
try {
  $user=sqfBootstrapFirstAdmin($db,$email,$password,'Administrador Homologação',$secret);
  assertBootstrap(strlen($user)===36,'one-time server admin bootstrap creates UUID identity');
  assertBootstrap(sqfLogin($db,$email,$password)['id']===$user,'first admin can log in without SMTP');
  assertBootstrap(sqfStaffRole($db,$user)==='admin','bootstrapped user receives admin role');
  assertBootstrap(sqfStaffMfaSecret($user)===$secret,'admin TOTP seed is encrypted and recoverable only by backend');
  assertBootstrap((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_auth_tokens WHERE user_id=?',[$user])->fetchColumn()===0,'bootstrap does not expose verification tokens');
  denyBootstrap(fn()=>sqfBootstrapFirstAdmin($db,'another@example.invalid',$password,'Other admin',$secret),'second bootstrap denied after first admin exists');
  denyBootstrap(fn()=>sqfBootstrapFirstAdmin($db,'bad',$password,'Other admin',$secret),'invalid admin email rejected');
}finally{
 foreach(glob($dir.'/mail-settings/*')?:[] as $item)@unlink($item);
 @rmdir($dir.'/mail-settings');@rmdir($dir);putenv('SQF_MAIL_SETTINGS_TEST_DIR');
}
