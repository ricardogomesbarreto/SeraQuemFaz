<?php
declare(strict_types=1);
require_once __DIR__.'/MailSettings.php';

/**
 * Hostinger's built-in PHP mail() relay is ONLY enabled after a real recipient
 * passes a CLI challenge sent through that relay. SMTP remains preferred.
 * This is intended for low-volume initial testing (Hostinger rate limits apply).
 */
function sqfPhpMailIsActive():bool {
    $path=sqfMailStorageDir().'/phpmail-verified.json';
    if(!is_file($path))return false;
    if(is_link($path)||filesize($path)>1024)throw new RuntimeException('Configuração de e-mail local inválida');
    $data=json_decode((string)file_get_contents($path),true,8,JSON_THROW_ON_ERROR);
    return is_array($data)&&($data['v']??null)===1&&($data['enabled']??false)===true
       &&is_string($data['validated_at']??null)&&function_exists('mail');
}
function sqfPhpMailEnableAfterProof(string $challenge,string $received):void {
    if(PHP_SAPI!=='cli')throw new RuntimeException('Configuração restrita ao SSH');
    if(!preg_match('/^[0-9a-f]{12}$/D',$challenge)||!hash_equals($challenge,trim($received)))throw new DomainException('Código recebido não confere');
    $dir=sqfMailStorageDir(true);
    $target=$dir.'/phpmail-verified.json';
    if(is_link($target))throw new RuntimeException('Configuração privada inválida');
    $temp=tempnam($dir,'.phpmail-');if($temp===false)throw new RuntimeException('Falha no armazenamento privado');
    try{
        @chmod($temp,0600);
        $data=json_encode(['v'=>1,'enabled'=>true,'validated_at'=>gmdate('c')],JSON_THROW_ON_ERROR);
        if(file_put_contents($temp,$data,LOCK_EX)!==strlen($data)||!rename($temp,$target))
           throw new RuntimeException('Falha ao salvar opção de e-mail');
    }finally{if(is_file($temp))@unlink($temp);}
    sqfMailAudit('settings_updated','server-owner-phpmail','ok');
}
function sqfPhpMailDisable():void {
    if(PHP_SAPI!=='cli')throw new RuntimeException('Configuração restrita ao SSH');
    $dir=sqfMailStorageDir();
    $path=$dir.'/phpmail-verified.json';
    if(is_file($path)&&!is_link($path))@unlink($path);
}
function sqfPhpMailSend(string $to,string $subject,string $body):bool {
    if(!function_exists('mail'))throw new RuntimeException('PHP mail indisponível');
    if(!filter_var($to,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$to.$subject)||
       strlen($subject)>180||strlen($body)>16000)throw new DomainException('Mensagem de e-mail inválida');
    $encodedSubject='=?UTF-8?B?'.base64_encode($subject).'?=';
    $encodedBody=chunk_split(base64_encode($body),76,"\r\n");
    $headers=['MIME-Version'=>'1.0','Content-Type'=>'text/plain; charset=UTF-8','Content-Transfer-Encoding'=>'base64'];
    // Let Hostinger apply its own server sender; never spoof a Hotmail/Outlook From.
    return mail($to,$encodedSubject,$encodedBody,$headers);
}
