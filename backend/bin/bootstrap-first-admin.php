<?php
declare(strict_types=1);
// Run with "php sqf-private/backend/bin/bootstrap-first-admin.php" in an interactive SSH session.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(!defined('STDIN')||!stream_isatty(STDIN)){
 fwrite(STDERR,"Execute apenas via SSH com terminal interativo (TTY).\n");exit(2);
}
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/AdminBootstrap.php';
function sqfOwnerAsk(string $label):string {
 fwrite(STDOUT,$label.': ');$input=fgets(STDIN);
 if($input===false)throw new RuntimeException('Entrada encerrada');
 return trim($input);
}
function sqfOwnerSecret(string $label):string {
 if(!function_exists('exec'))throw new RuntimeException('Ocultação de senha indisponível no PHP CLI');
 $result=1;@exec('stty -echo 2>/dev/null',$unused,$result);
 if($result!==0)throw new RuntimeException('Não foi possível ocultar a entrada da senha');
 try{return sqfOwnerAsk($label);}
 finally{@exec('stty echo 2>/dev/null');fwrite(STDOUT,"\n");}
}
function sqfOwnerBase32(string $input):string {
 $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';$bits='';
 foreach(str_split($input) as $char)$bits.=str_pad(decbin(ord($char)),8,'0',STR_PAD_LEFT);
 $out='';
 for($i=0;$i<strlen($bits);$i+=5)$out.=$alphabet[bindec(str_pad(substr($bits,$i,5),5,'0',STR_PAD_RIGHT))];
 return $out;
}
try{
 $db=sqfDatabase();
 if((int)sqfQuery($db,"SELECT COUNT(*) FROM sqf_admin_members WHERE role='admin'")->fetchColumn()>0)
   throw new RuntimeException('Já existe administrador. Este assistente não concede acesso novamente.');
 fwrite(STDOUT,"\nSERÁ QUEM FAZ? — Primeiro administrador via SSH\n");
 fwrite(STDOUT,"Este processo NÃO envia e-mail: a autoridade para configurar a primeira conta é o acesso SSH do proprietário.\n");
 fwrite(STDOUT,"Informe somente um e-mail sob seu controle. O endereço deve ser confirmado por canal próprio na operação regular.\n");
 $name=sqfOwnerAsk('Nome do administrador');
 $email=sqfEmail(sqfOwnerAsk('E-mail que você controla (Hotmail/Outlook permitido)'));
 $password=sqfOwnerSecret('Nova senha forte (mínimo de 12 caracteres)');
 $confirm=sqfOwnerSecret('Repetir senha');
 if(!hash_equals($password,$confirm))throw new DomainException('As senhas não coincidem');
 sqfPassword($password); // validation before generating TOTP
 if(sqfOwnerAsk('Digite CRIAR ADMINISTRADOR para confirmar a criação de conta inédita')!=='CRIAR ADMINISTRADOR'){
   fwrite(STDOUT,"Cancelado. Nenhuma conta foi criada.\n");exit(0);
 }
 $secret=random_bytes(20);
 $hex=bin2hex($secret);
 fwrite(STDOUT,"\nAdicione manualmente a conta ao aplicativo autenticador (TOTP):\n");
 fwrite(STDOUT,"Emissor: Será Quem Faz?\nConta: ".$email."\nChave Base32: ".sqfOwnerBase32($secret)."\n");
 fwrite(STDOUT,"Não fotografe, copie em arquivos públicos, compartilhe nem envie esta chave pelo chat.\n");
 $code=sqfOwnerAsk('Informe o código TOTP de 6 dígitos mostrado no aplicativo');
 $counter=intdiv(time(),30);
 $valid=preg_match('/^[0-9]{6}$/D',$code)===1;
 if($valid){
   $valid=false;
   foreach([$counter-1,$counter,$counter+1] as $slot)if($slot>=0&&hash_equals(sqfTotp($secret,$slot),$code)){$valid=true;break;}
 }
 if(!$valid)throw new DomainException('Código TOTP inválido. Conta não foi criada.');
 sqfBootstrapFirstAdmin($db,$email,$password,$name,$hex);
 sodium_memzero($password);sodium_memzero($hex);
 fwrite(STDOUT,"\nAdministrador criado e TOTP configurado. Entre diretamente em /admin.html.\n");
 fwrite(STDOUT,"Depois, configure e teste a entrega de e-mails, pois o bootstrap não prova que a caixa postal recebe mensagens.\n");
}catch(Throwable $e){
 fwrite(STDERR,"Não foi possível concluir o primeiro acesso: ".$e->getMessage()."\n");exit(1);
}
