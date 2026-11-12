<?php
declare(strict_types=1);

/**
 * SMTP settings are stored outside public_html. Only the authenticated administrator
 * may call the HTTP API; this module never emits a password to an HTTP response.
 * The decryption key and encrypted settings are owner-only files (0600).
 */
function sqfMailPrivateDir():string {
    $root=dirname(__DIR__,2);
    $override=PHP_SAPI==='cli'?(getenv('SQF_MAIL_SETTINGS_TEST_DIR')?:''):'';
    if($override!=='')$root=$override;
    $documentRoot=trim((string)($_SERVER['DOCUMENT_ROOT']??''));
    $doc=$documentRoot!==''?realpath($documentRoot):false;
    $real=realpath($root);
    if(!$real||($doc!==false&&($real===$doc||str_starts_with($real,$doc.DIRECTORY_SEPARATOR))))throw new RuntimeException('Diretório privado indisponível');
    return $real.'/mail-settings';
}
function sqfMailStorageDir(bool $create=false):string {
    $dir=sqfMailPrivateDir();
    if($create&&!is_dir($dir)&&!@mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('Armazenamento privado indisponível');
    if(is_dir($dir)){
        if(is_link($dir))throw new RuntimeException('Diretório privado inválido');
        @chmod($dir,0700);
    }
    return $dir;
}
function sqfMailPrivateKey(bool $create=false):string {
    if(!function_exists('sodium_crypto_secretbox'))throw new RuntimeException('Extensão Sodium obrigatória para configuração SMTP');
    $path=sqfMailStorageDir($create).'/mail.key';
    if(!is_file($path)&&$create){
        $handle=@fopen($path,'x');
        if($handle!==false){
            try{
                @chmod($path,0600);
                $contents=base64_encode(random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES));
                if(fwrite($handle,$contents)!==strlen($contents))throw new RuntimeException('Chave privada indisponível');
                fflush($handle);
            }finally{fclose($handle);}
        }
    }
    if(!is_file($path)||is_link($path))throw new RuntimeException('Chave privada indisponível');
    $key=base64_decode((string)file_get_contents($path),true);
    if($key===false||strlen($key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES)throw new RuntimeException('Chave privada inválida');
    return $key;
}
function sqfMailSealed(string $secret):string {
    $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    return base64_encode($nonce.sodium_crypto_secretbox($secret,$nonce,sqfMailPrivateKey(true)));
}
function sqfMailUnseal(string $box):string {
    $data=base64_decode($box,true);
    if($data===false||strlen($data)<SODIUM_CRYPTO_SECRETBOX_NONCEBYTES+SODIUM_CRYPTO_SECRETBOX_MACBYTES)throw new RuntimeException('Credencial SMTP inválida');
    $nonce=substr($data,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $password=sodium_crypto_secretbox_open(substr($data,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES),$nonce,sqfMailPrivateKey(false));
    if($password===false)throw new RuntimeException('Credencial SMTP indisponível');
    return $password;
}
function sqfMailSettingsRead():?array {
    $path=sqfMailStorageDir().'/settings.json';
    if(!is_file($path))return null;
    if(is_link($path)||filesize($path)>8192)throw new RuntimeException('Configuração SMTP privada inválida');
    $saved=json_decode((string)file_get_contents($path),true,16,JSON_THROW_ON_ERROR);
    if(!is_array($saved)||($saved['v']??null)!==1||!is_string($saved['password_box']??null))throw new RuntimeException('Configuração SMTP privada inválida');
    return $saved;
}
function sqfMailValidateSettings(array $data):array {
    $enabled=$data['enabled']??null;
    $host=strtolower(trim((string)($data['host']??'')));
    $port=$data['port']??null;
    $security=$data['security']??null;
    $from=strtolower(trim((string)($data['from']??'')));
    $username=strtolower(trim((string)($data['username']??'')));
    $password=$data['password']??null;
    // Restrict network destinations to known authenticated SMTP endpoint.
    // Additional servers require an explicit, audited backend allowlist update.
    if(!is_bool($enabled)||$host!=='smtp.hostinger.com'||!in_array($port,[465,587],true)||
       !in_array($security,['tls','starttls'],true)||
       ($port===465&&$security!=='tls')||($port===587&&$security!=='starttls')||
       !filter_var($from,FILTER_VALIDATE_EMAIL)||!filter_var($username,FILTER_VALIDATE_EMAIL)||
       $username!==$from||!is_string($password)||strlen($password)<1||strlen($password)>1024||
       preg_match('/[\r\n]/',$password)){
        throw new DomainException('Configuração SMTP inválida: use smtp.hostinger.com, TLS 465 ou STARTTLS 587 e a mesma caixa autenticada como remetente.');
    }
    return compact('enabled','host','port','security','from','username','password');
}
function sqfMailSettingsSave(array $input,string $actor):void {
    $dir=sqfMailStorageDir(true);
    $lock=@fopen($dir.'/settings.lock','c');
    if($lock===false)throw new RuntimeException('Bloqueio privado indisponível');
    @chmod($dir.'/settings.lock',0600);
    try {
        if(!flock($lock,LOCK_EX))throw new RuntimeException('Bloqueio privado indisponível');
        $existing=sqfMailSettingsRead();
        $password=$input['password']??null;
        if($password===''||$password===null){
            $password=$existing!==null?sqfMailUnseal((string)$existing['password_box']):'';
        }
        $valid=sqfMailValidateSettings(array_merge($input,['password'=>$password]));
        $document=['v'=>1,'enabled'=>$valid['enabled'],'host'=>$valid['host'],'port'=>$valid['port'],
            'security'=>$valid['security'],'from'=>$valid['from'],'username'=>$valid['username'],
            'password_box'=>sqfMailSealed($valid['password']),'updated_at'=>gmdate('c')];
        $tmp=@tempnam($dir,'.mail-');
        if($tmp===false)throw new RuntimeException('Armazenamento privado indisponível');
        try{
            @chmod($tmp,0600);
            $json=json_encode($document,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
            if(file_put_contents($tmp,$json,LOCK_EX)!==strlen($json))throw new RuntimeException('Falha ao salvar configuração');
            if(!@rename($tmp,$dir.'/settings.json'))throw new RuntimeException('Falha ao ativar configuração');
        }finally{if(is_file($tmp))@unlink($tmp);}
    }finally{flock($lock,LOCK_UN);fclose($lock);}
    sqfMailAudit('settings_updated',$actor,'ok');
}
function sqfMailRuntimeConfig():array {
    $saved=sqfMailSettingsRead();
    if($saved!==null){
        // A private admin-approved setting overrides legacy config.php SMTP flags,
        // so deployments and routine changes do not require editing PHP again.
        return [
            'enabled'=>($saved['enabled']??false)===true,
            'host'=>$saved['host'],'port'=>$saved['port'],'security'=>$saved['security'],
            'from'=>$saved['from'],'username'=>$saved['username'],
            'password'=>sqfMailUnseal($saved['password_box'])
        ];
    }
    return [
        'enabled'=>getenv('SQF_SMTP_ENABLED')==='1',
        'host'=>'smtp.hostinger.com','port'=>465,'security'=>'tls',
        'from'=>getenv('SQF_MAIL_FROM')?:'','username'=>getenv('SQF_SMTP_USER')?:'',
        'password'=>getenv('SQF_SMTP_PASSWORD')?:''
    ];
}
function sqfMailAudit(string $event,string $actor,string $result):void {
    if(!in_array($event,['settings_updated','delivery_test'],true)||!in_array($result,['ok','failed'],true))throw new DomainException('Auditoria inválida');
    $dir=sqfMailStorageDir(true);
    $path=$dir.'/mail-audit.log';
    $entry=json_encode(['at'=>gmdate('c'),'event'=>$event,'actor'=>substr(hash('sha256',$actor),0,20),'result'=>$result],JSON_THROW_ON_ERROR)."\n";
    // No email address, SMTP password, token, recipient or server error is logged.
    if(file_put_contents($path,$entry,FILE_APPEND|LOCK_EX)===false)throw new RuntimeException('Falha na auditoria SMTP');
    @chmod($path,0600);
}
function sqfMailSettingsStatus():array {
    $config=sqfMailRuntimeConfig();
    $saved=sqfMailSettingsRead();
    $events=[];
    $log=sqfMailStorageDir().'/mail-audit.log';
    if(is_file($log)&&!is_link($log)&&filesize($log)<262144){
        $lines=array_slice(file($log,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES)?:[],-10);
        foreach($lines as $line){$event=json_decode($line,true);if(is_array($event)&&isset($event['event'],$event['result'],$event['at']))$events[]=['at'=>$event['at'],'event'=>$event['event'],'result'=>$event['result']];}
    }
    return [
        'enabled'=>(bool)$config['enabled'],
        'configured'=>function_exists('curl_init')&&$config['password']!==''&&filter_var($config['from'],FILTER_VALIDATE_EMAIL)!==false,
        'host'=>$config['host'],'port'=>$config['port'],'security'=>$config['security'],
        'from'=>$config['from'],'username'=>$config['username'],
        'password_configured'=>$config['password']!=='',
        'source'=>$saved===null?'legacy':'private',
        'updated_at'=>$saved['updated_at']??null,
        'events'=>$events,
        'notifications_worker_enabled'=>getenv('SQF_NOTIFICATIONS_ENABLED')==='1'
    ];
}
