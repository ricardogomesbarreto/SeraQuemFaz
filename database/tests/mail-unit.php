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
