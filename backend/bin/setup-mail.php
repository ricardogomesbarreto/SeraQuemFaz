<?php
declare(strict_types=1);
// Execute once via SSH from sqf-private/backend/bin. Never expose this script via HTTP.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(!defined('STDIN')||!stream_isatty(STDIN)){
    fwrite(STDERR,"Execute interativamente pelo SSH (TTY), nunca pelo navegador.\n");exit(2);
}
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
require_once __DIR__.'/../src/Mail.php';

function sqfPrompt(string $label,bool $hidden=false):string {
    fwrite(STDOUT,$label.': ');
    if($hidden){exec('stty -echo 2>/dev/null');}
    try {$value=fgets(STDIN);if($value===false)throw new RuntimeException('Entrada encerrada');}
    finally {if($hidden){exec('stty echo 2>/dev/null');fwrite(STDOUT,"\n");}}
    return trim($value);
}

try {
    $old=sqfMailSettingsRead();
    if($old!==null&&strtolower(sqfPrompt('SMTP já configurado. Substituir? (sim/não)'))!=='sim'){
        fwrite(STDOUT,"Sem alterações.\n");exit(0);
    }
    fwrite(STDOUT,"Configuração SMTP segura do Será Quem Faz? (fora de public_html)\n");
    $host=sqfPrompt('Servidor (smtp.hostinger.com ou smtp.titan.email; padrão smtp.hostinger.com)')?:'smtp.hostinger.com';
    $user=sqfPrompt('E-mail completo da caixa autenticada');
    $port=(int)(sqfPrompt('Porta (465 ou 587, padrão 465)')?:'465');
    $password=sqfPrompt('Senha da caixa de e-mail (entrada oculta)',true);
    if($password==='')throw new DomainException('Senha obrigatória nesta primeira configuração');
    sqfMailSettingsSave([
       'enabled'=>true,'host'=>$host,'port'=>$port,
       'security'=>$port===587?'starttls':'tls','from'=>$user,
       'username'=>$user,'password'=>$password
    ],'server-bootstrap');
    sodium_memzero($password);
    fwrite(STDOUT,"SMTP salvo em arquivos privados cifrados. Nenhuma senha foi exibida.\n");
    fwrite(STDOUT,"Agora teste o cadastro de uma conta cliente e, depois, use Administração > E-mails e notificações.\n");
} catch(Throwable $e){
    fwrite(STDERR,"Configuração não concluída. Verifique os dados e as permissões.\n");
    exit(1);
}
