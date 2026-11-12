<?php
declare(strict_types=1);
// One-time first-admin provisioner. Accessible only through authenticated SSH CLI.
// Requires a previously registered AND email-verified account.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(!defined('STDIN')||!stream_isatty(STDIN)){
    fwrite(STDERR,"Execute apenas no terminal SSH interativo.\n");exit(2);
}
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/Moderation.php';
require_once __DIR__.'/../src/StaffSecrets.php';

function ask(string $label):string {fwrite(STDOUT,$label.': ');$r=fgets(STDIN);if($r===false)throw new RuntimeException('Entrada encerrada');return trim($r);}
function base32(string $bytes):string {
    $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';$bits='';
    foreach(str_split($bytes) as $byte)$bits.=str_pad(decbin(ord($byte)),8,'0',STR_PAD_LEFT);
    $out='';
    for($i=0;$i<strlen($bits);$i+=5)$out.=$alphabet[bindec(str_pad(substr($bits,$i,5),5,'0',STR_PAD_RIGHT))];
    return $out;
}
try{
    $db=sqfDatabase();
    $current=(int)sqfQuery($db,"SELECT COUNT(*) FROM sqf_admin_members WHERE role='admin' AND active=1")->fetchColumn();
    if($current!==0)throw new RuntimeException('Primeiro administrador já existente; não é possível reprovisionar.');
    fwrite(STDOUT,"Somente uma conta com e-mail confirmado poderá receber o papel de primeiro administrador.\n");
    $email=sqfEmail(ask('E-mail da conta já cadastrada e confirmada'));
    $row=sqfQuery($db,'SELECT id,email_confirmed_at FROM sqf_auth_users WHERE email=?',[$email])->fetch(PDO::FETCH_ASSOC);
    if(!$row||$row['email_confirmed_at']===null)throw new RuntimeException('Conta inexistente ou não confirmada.');
    if(ask('Digite PROVISIONAR para confirmar a atribuição única de administrador')!=='PROVISIONAR'){
        fwrite(STDOUT,"Cancelado; nenhuma alteração realizada.\n");exit(0);
    }
    $secret=random_bytes(20);$secretHex=bin2hex($secret);$seed=base32($secret);
    fwrite(STDOUT,"\nConfigure no aplicativo autenticador uma conta TOTP de 6 dígitos:\n");
    fwrite(STDOUT,"Emissor: Será Quem Faz?\nConta: ".$email."\nSegredo Base32: ".$seed."\n");
    fwrite(STDOUT,"Não compartilhe, grave ou envie o segredo ao GitHub. Ele é exibido somente nesta etapa.\n");
    $code=ask('Código de 6 dígitos exibido agora pelo autenticador');
    $counter=intdiv(time(),30);
    $valid=preg_match('/^[0-9]{6}$/D',$code)===1&&(
      hash_equals(sqfTotp($secret,$counter),$code)||
      hash_equals(sqfTotp($secret,$counter-1),$code)||
      hash_equals(sqfTotp($secret,$counter+1),$code)
    );
    if(!$valid)throw new RuntimeException('Código TOTP inválido. Nenhum administrador foi alterado.');
    $db->beginTransaction();
    try{
        if((int)sqfQuery($db,"SELECT COUNT(*) FROM sqf_admin_members WHERE role='admin' AND active=1")->fetchColumn()!==0)throw new RuntimeException('Já existe administrador ativo.');
        sqfQuery($db,"INSERT INTO sqf_admin_members(user_id,role,active) VALUES (?,'admin',1) ON DUPLICATE KEY UPDATE role='admin',active=1",[$row['id']]);
        sqfStaffMfaProvision((string)$row['id'],$secretHex);
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    sodium_memzero($secretHex);
    fwrite(STDOUT,"Primeiro administrador provisionado com MFA. Acesse admin.html e confirme um código do autenticador.\n");
}catch(Throwable $e){
    fwrite(STDERR,"Provisionamento não concluído. Verifique conta confirmada, TOTP e permissões.\n");
    exit(1);
}
