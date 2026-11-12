<?php
declare(strict_types=1);
// Synthetic MFA test; no database, user or production secret is touched.
require_once __DIR__.'/../../backend/src/StaffSecrets.php';
function check(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);echo "PASS: ".$label."\n";}
$path=sys_get_temp_dir().'/sqf-staff-test-'.bin2hex(random_bytes(9));
mkdir($path,0700);
putenv('SQF_MAIL_SETTINGS_TEST_DIR='.$path);
$actor='00000000-0000-4000-8000-000000000001';
$hex=str_repeat('a',40);
putenv('SQF_STAFF_TOTP_SECRETS='.json_encode([$actor=>$hex],JSON_THROW_ON_ERROR));
try{
  check(sqfStaffMfaSecret($actor)===$hex,'legacy MFA compatibility retained');
  sqfStaffMfaProvision($actor,str_repeat('b',40));
  $file=$path.'/mail-settings/staff-totp.json';
  $text=(string)file_get_contents($file);
  check(!str_contains($text,str_repeat('b',40)),'new TOTP seed encrypted at rest');
  check(sqfStaffMfaSecret($actor)===str_repeat('b',40),'private TOTP seed overrides legacy env');
  check((fileperms($file)&0777)===0600,'TOTP file permissions 0600');
  try{sqfStaffMfaProvision($actor,str_repeat('c',40));throw new LogicException('seed overwritten');}
  catch(RuntimeException $e){check(true,'existing TOTP seed not overwritten');}
  check(sqfStaffMfaSecret('00000000-0000-4000-8000-000000000002')==='','unprovisioned actor has no MFA secret');
}finally{
 foreach(glob($path.'/mail-settings/*')?:[] as $f)@unlink($f);
 @rmdir($path.'/mail-settings');@rmdir($path);
 putenv('SQF_MAIL_SETTINGS_TEST_DIR');putenv('SQF_STAFF_TOTP_SECRETS');
}
