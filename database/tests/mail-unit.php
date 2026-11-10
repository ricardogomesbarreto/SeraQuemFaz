<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Mail.php';
function check(bool $ok,string $m):void{if(!$ok)throw new RuntimeException($m);echo "PASS: $m\n";}
$m=sqfMailMessage('sender@example.invalid','recipient@example.invalid','Código de segurança','mensagem de teste');
check(str_contains($m,"To: recipient@example.invalid\r\n"),'recipient envelope message');
check(str_contains($m,base64_encode('mensagem de teste')),'body encoded');
try{sqfMailMessage('sender@example.invalid','recipient@example.invalid',"Subject\r\nBcc: other@example.invalid",'x');throw new RuntimeException('invalid header accepted');}catch(DomainException $e){check(true,'header injection rejected');}
putenv('SQF_SMTP_ENABLED=0');
try{sqfMailConfig();throw new RuntimeException('disabled SMTP accepted');}catch(RuntimeException $e){check($e->getMessage()==='Envio de e-mail não configurado','disabled transport fails closed');}

// Configuration validation only: no network connection or email delivery.
putenv('SQF_SMTP_ENABLED=1');
putenv('SQF_SMTP_USER=sender@example.invalid');
putenv('SQF_SMTP_PASSWORD=fixture-only');
putenv('SQF_MAIL_FROM=other@example.invalid');
try{sqfMailConfig();throw new LogicException('mismatched sender accepted');}catch(RuntimeException $e){check($e->getMessage()==='Envio de e-mail não configurado','SMTP rejects mismatched authenticated sender');}
putenv('SQF_MAIL_FROM=sender@example.invalid');
check(sqfMailConfig()[2]==='sender@example.invalid','SMTP accepts matching fixture sender configuration');
foreach(['invalid-address',"recipient@example.invalid\r\nBcc: other@example.invalid"] as $recipient){
    try{sqfMailMessage('sender@example.invalid',$recipient,'Teste','x');throw new LogicException('invalid recipient accepted');}catch(DomainException $e){check(true,'invalid recipient rejected');}
}
putenv('SQF_SMTP_ENABLED=0');
putenv('SQF_SMTP_PASSWORD');
