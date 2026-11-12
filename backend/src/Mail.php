<?php
declare(strict_types=1);

/** Authenticated SMTP over implicit TLS; no fallback to unauthenticated mail. */
require_once __DIR__.'/MailSettings.php';
function sqfMailConfig():array {
    $c=sqfMailRuntimeConfig();
    $user=(string)$c['username'];$pass=(string)$c['password'];$from=(string)$c['from'];
    $host=(string)$c['host'];$port=(int)$c['port'];$security=(string)$c['security'];
    if(!$c['enabled']||!function_exists('curl_init')||!$user||!$pass||!$from||
        !filter_var($user,FILTER_VALIDATE_EMAIL)||!filter_var($from,FILTER_VALIDATE_EMAIL)||
        strcasecmp($user,$from)!==0||!in_array($host,['smtp.hostinger.com','smtp.titan.email'],true)||
        !in_array([$port,$security],[[465,'tls'],[587,'starttls']],true)){
        throw new RuntimeException('Envio de e-mail não configurado');
    }
    return [$user,$pass,$from,$host,$port,$security];
}
function sqfMailMessage(string $from,string $to,string $subject,string $body):string {
    if(!filter_var($from,FILTER_VALIDATE_EMAIL)||!filter_var($to,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$subject)||strlen($subject)>180||strlen($body)>16000)throw new DomainException('Mensagem inválida');
    $encoded=chunk_split(base64_encode($body),76,"\r\n");
    return 'Date: '.gmdate('D, d M Y H:i:s').' +0000'."\r\nFrom: ".$from."\r\nTo: ".$to."\r\nSubject: =?UTF-8?B?".base64_encode($subject)."?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".$encoded;
}
function sqfSmtpSend(string $to,string $subject,string $body):bool {
    [$user,$pass,$from,$host,$port,$security]=sqfMailConfig();
    $payload=sqfMailMessage($from,$to,$subject,$body);$offset=0;
    $scheme=$security==='tls'?'smtps':'smtp';
    $ch=curl_init($scheme.'://'.$host.':'.$port);
    try{
        curl_setopt_array($ch,[CURLOPT_USERNAME=>$user,CURLOPT_PASSWORD=>$pass,CURLOPT_MAIL_FROM=>'<'.$from.'>',CURLOPT_MAIL_RCPT=>['<'.$to.'>'],CURLOPT_UPLOAD=>true,CURLOPT_READFUNCTION=>static function($handle,$stream,int $length)use(&$offset,$payload):string{$part=substr($payload,$offset,$length);$offset+=strlen($part);return $part;},CURLOPT_INFILESIZE=>strlen($payload),CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USE_SSL=>CURLUSESSL_ALL,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_RETURNTRANSFER=>true]);
        return curl_exec($ch)!==false;
    }finally{curl_close($ch);}
}
function sqfAuthMail(string $email,string $token,string $purpose):void {
    if(!in_array($purpose,['verify','reset'],true)||!preg_match('/^[0-9a-f]{64}$/D',$token))throw new DomainException('Código inválido');
    if(!sqfSmtpSend($email,'Código de segurança — Será Quem Faz?', 'Código de '.($purpose==='verify'?'confirmação':'recuperação').': '.$token."\nVálido por 30 minutos."))throw new RuntimeException('Envio indisponível');
}
