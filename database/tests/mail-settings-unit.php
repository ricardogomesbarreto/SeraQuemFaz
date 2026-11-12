<?php
declare(strict_types=1);
// Isolated, synthetic credentials only. This never sends a message.
require_once __DIR__.'/../../backend/src/Mail.php';
function check(bool $ok,string $description):void {
    if(!$ok)throw new RuntimeException($description);
    echo "PASS: ".$description."\n";
}
if(!function_exists('sodium_crypto_secretbox')){fwrite(STDERR,"Sodium PHP extension missing\n");exit(2);}
$dir=sys_get_temp_dir().'/sqf-mail-test-'.bin2hex(random_bytes(9));
mkdir($dir,0700);
putenv('SQF_MAIL_SETTINGS_TEST_DIR='.$dir);
putenv('SQF_SMTP_ENABLED=0');
try {
    check(sqfMailSettingsRead()===null,'no private SMTP configuration initially');
    $settings=['enabled'=>true,'host'=>'smtp.hostinger.com','port'=>465,'security'=>'tls',
        'from'=>'teste@example.invalid','username'=>'teste@example.invalid',
        'password'=>'fake_secret_for_unit_testing_123'];
    sqfMailSettingsSave($settings,'test-admin');
    $stored=(string)file_get_contents($dir.'/mail-settings/settings.json');
    check(!str_contains($stored,'fake_secret_for_unit_testing_123'),'password encrypted at rest');
    check(!str_contains($stored,'"password"'),'settings document contains no plaintext password field');
    check((fileperms($dir.'/mail-settings/mail.key')&0777)===0600,'encryption key permissions 0600');
    check((fileperms($dir.'/mail-settings/settings.json')&0777)===0600,'settings permissions 0600');
    $status=sqfMailSettingsStatus();
    check($status['enabled']&&$status['configured'],'private settings override disabled legacy env');
    check(!array_key_exists('password',$status)&&!array_key_exists('password_box',$status),'HTTP status excludes secret');
    check(sqfMailConfig()[1]==='fake_secret_for_unit_testing_123','backend decrypts credential');
    $settings['password']='';
    $settings['port']=587;$settings['security']='starttls';
    sqfMailSettingsSave($settings,'test-admin');
    $runtime=sqfMailConfig();
    check($runtime[1]==='fake_secret_for_unit_testing_123'&&$runtime[4]===587&&$runtime[5]==='starttls','blank password preserves existing credential');
    try{
        $settings['host']='127.0.0.1';
        sqfMailSettingsSave($settings,'test-admin');
        throw new LogicException('IP destination accepted');
    }catch(DomainException $e){check(true,'SMTP private/IP destination rejected');}
    try{
        $settings['host']='smtp.hostinger.com';$settings['from']='other@example.invalid';
        sqfMailSettingsSave($settings,'test-admin');
        throw new LogicException('spoofed from accepted');
    }catch(DomainException $e){check(true,'SMTP sender mismatch rejected');}
    sqfMailAudit('delivery_test','test-admin','failed');
    $status=sqfMailSettingsStatus();
    check(count($status['events'])===3,'sanitized audit events are visible');
    $log=(string)file_get_contents($dir.'/mail-settings/mail-audit.log');
    check(!str_contains($log,'fake_secret')&&!str_contains($log,'teste@example.invalid'),'audit excludes credentials and recipients');
} finally {
    foreach(glob($dir.'/mail-settings/*')?:[] as $file)@unlink($file);
    @rmdir($dir.'/mail-settings');@rmdir($dir);
    putenv('SQF_MAIL_SETTINGS_TEST_DIR');
}
