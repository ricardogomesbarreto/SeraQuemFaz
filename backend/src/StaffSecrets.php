<?php
declare(strict_types=1);
require_once __DIR__.'/MailSettings.php';

/** First-admin MFA seeds live in encrypted private storage; legacy env remains supported. */
function sqfStaffMfaSecret(string $actor):string {
    if(!preg_match('/^[0-9a-f-]{36}$/iD',$actor))return '';
    $path=sqfMailStorageDir().'/staff-totp.json';
    if(is_file($path)){
        if(is_link($path)||filesize($path)>65536)throw new RuntimeException('Chaves administrativas inválidas');
        $saved=json_decode((string)file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
        if(!is_array($saved)||($saved['v']??null)!==1||!is_array($saved['seeds']??null))throw new RuntimeException('Chaves administrativas inválidas');
        if(isset($saved['seeds'][$actor]))return sqfMailUnseal((string)$saved['seeds'][$actor]);
    }
    $legacy=json_decode(getenv('SQF_STAFF_TOTP_SECRETS')?:'{}',true,16,JSON_THROW_ON_ERROR);
    return is_array($legacy)&&is_string($legacy[$actor]??null)?$legacy[$actor]:'';
}
function sqfStaffMfaProvision(string $actor,string $secretHex):void {
    if(!preg_match('/^[0-9a-f-]{36}$/iD',$actor)||!preg_match('/^[a-f0-9]{40}$/iD',$secretHex))throw new DomainException('Chave administrativa inválida');
    $dir=sqfMailStorageDir(true);
    $lock=@fopen($dir.'/staff.lock','c');
    if($lock===false)throw new RuntimeException('Armazenamento MFA indisponível');
    @chmod($dir.'/staff.lock',0600);
    try{
        if(!flock($lock,LOCK_EX))throw new RuntimeException('Armazenamento MFA indisponível');
        $path=$dir.'/staff-totp.json';$seeds=[];
        if(is_file($path)){
            if(is_link($path)||filesize($path)>65536)throw new RuntimeException('Arquivo MFA inválido');
            $old=json_decode((string)file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
            if(!is_array($old)||($old['v']??null)!==1||!is_array($old['seeds']??null))throw new RuntimeException('Arquivo MFA inválido');
            $seeds=$old['seeds'];
        }
        if(isset($seeds[$actor]))throw new RuntimeException('MFA já provisionado para essa conta');
        $seeds[$actor]=sqfMailSealed($secretHex);
        $temp=tempnam($dir,'.staff-');if($temp===false)throw new RuntimeException('Armazenamento MFA indisponível');
        try{
            @chmod($temp,0600);
            $json=json_encode(['v'=>1,'seeds'=>$seeds],JSON_THROW_ON_ERROR);
            if(file_put_contents($temp,$json,LOCK_EX)!==strlen($json)||!rename($temp,$path))throw new RuntimeException('Falha ao salvar MFA');
        }finally{if(is_file($temp))@unlink($temp);}
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
