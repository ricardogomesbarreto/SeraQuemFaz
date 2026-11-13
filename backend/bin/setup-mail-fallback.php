<?php
declare(strict_types=1);
// ONE-TIME interactive SSH mail() check. SMTP remains recommended for production.
// Usage: php sqf-private/backend/bin/setup-mail-fallback.php [--disable]
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(!defined('STDIN')||!stream_isatty(STDIN)){fwrite(STDERR,"Execute via SSH com terminal interativo.\n");exit(2);}
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
require_once __DIR__.'/../src/Mail.php';
require_once __DIR__.'/../src/Auth.php';
function sqfAskMail(string $label):string {
 fwrite(STDOUT,$label.': ');
 $value=fgets(STDIN);if($value===false)throw new RuntimeException('Entrada encerrada');
 return trim($value);
}
try{
 if(($argv[1]??'')==='--disable'){
   sqfPhpMailDisable();fwrite(STDOUT,"Envio PHP mail de homologação desativado.\n");exit(0);
 }
 if(isset($argv[1]))throw new DomainException('Opção não reconhecida');
 if(!function_exists('mail'))throw new RuntimeException('A função PHP mail() não está disponível na hospedagem.');
 fwrite(STDOUT,"\nSERÁ QUEM FAZ? — Teste de envio pelo serviço básico da Hostinger\n");
 fwrite(STDOUT,"Não exige SMTP nem senha Outlook. O remetente aparecerá com endereço gerado pelo servidor.\n");
 fwrite(STDOUT,"Transporte restrito a homologação de baixo volume; é necessário confirmar o código recebido.\n");
 $to=sqfEmail(sqfAskMail('Digite um Hotmail/Outlook seu para receber o teste'));
 if(sqfAskMail('Digite TESTAR para enviar um único código')!=='TESTAR'){fwrite(STDOUT,"Cancelado.\n");exit(0);}
 $code=bin2hex(random_bytes(6));
 $sent=sqfPhpMailSend($to,'Teste de entrega — Será Quem Faz?',
   "Esta mensagem verifica o envio básico da hospedagem.\nCódigo de validação: ".$code."\nNão compartilhe o código.");
 if(!$sent)throw new RuntimeException('O serviço básico recusou a mensagem. Verifique a configuração Sendmail no hPanel.');
 fwrite(STDOUT,"Mensagem aceita pelo servidor. Confira sua caixa, spam e lixo eletrônico. Aceitação não significa entrega.\n");
 for($attempt=1;$attempt<=3;$attempt++){
   $received=strtolower(sqfAskMail('Código de 12 caracteres recebido por e-mail (tentativa '.$attempt.'/3)'));
   if(hash_equals($code,$received)){
      sqfPhpMailEnableAfterProof($code,$received);
      fwrite(STDOUT,"Recebimento verificado. Envio básico ativado para homologação do cadastro e recuperação.\n");
      fwrite(STDOUT,"Para operação real, configure SMTP autenticado no painel. Para desativar: execute este script com --disable.\n");
      exit(0);
   }
 }
 throw new DomainException('Código não conferiu; a opção de envio permanece desativada.');
}catch(Throwable $e){fwrite(STDERR,"Não foi possível ativar o envio de homologação: ".$e->getMessage()."\n");exit(1);}
