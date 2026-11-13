<?php
declare(strict_types=1);
require_once __DIR__.'/../../backend/src/Mail.php';
function checkTransport(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);echo "PASS: ".$label."\n";}
$root=sys_get_temp_dir().'/sqf-phpmail-unit-'.bin2hex(random_bytes(8));
mkdir($root,0700);
putenv('SQF_MAIL_SETTINGS_TEST_DIR='.$root);
putenv('SQF_SMTP_ENABLED=0');
try{
  checkTransport(!sqfPhpMailIsActive(),'host relay disabled without a proven recipient');
  try{sqfMailReady();throw new RuntimeException('mail enabled without verification');}
  catch(RuntimeException $e){checkTransport($e->getMessage()==='Envio de e-mail não configurado','signup rejects unverified email transport');}
  try{sqfPhpMailEnableAfterProof('abcdef123456','111111111111');throw new RuntimeException('wrong code accepted');}
  catch(DomainException $e){checkTransport(true,'wrong delivery code cannot activate mail');}
  checkTransport(!sqfPhpMailIsActive(),'failed challenge does not create transport config');
  sqfPhpMailEnableAfterProof('abcdef123456','abcdef123456');
  checkTransport(sqfPhpMailIsActive(),'successful recipient proof activates host relay');
  checkTransport((fileperms($root.'/mail-settings/phpmail-verified.json')&0777)===0600,'mail transport proof stored with private 0600 permissions');
  sqfMailReady();
  checkTransport(sqfMailSettingsStatus()['transport']==='phpmail','admin sees low-volume transport explicitly');
  try{sqfPhpMailSend("recipient@example.invalid\r\nBcc: injected@example.invalid",'hello','x');throw new RuntimeException('invalid recipient accepted');}
  catch(DomainException $e){checkTransport(true,'mail header injection rejected before sending');}
  sqfPhpMailDisable();
  checkTransport(!sqfPhpMailIsActive(),'mail fallback can be revoked');
  try{sqfMailReady();throw new RuntimeException('disabled mail accepted');}
  catch(RuntimeException $e){checkTransport($e->getMessage()==='Envio de e-mail não configurado','disabled relay blocks signup again');}
}finally{
  foreach(glob($root.'/mail-settings/*')?:[] as $file)@unlink($file);
  @rmdir($root.'/mail-settings');@rmdir($root);
  putenv('SQF_MAIL_SETTINGS_TEST_DIR');putenv('SQF_SMTP_ENABLED');
}
