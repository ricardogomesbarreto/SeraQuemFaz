<?php
declare(strict_types=1);
// CLI-only; never place in public_html.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../src/Database.php';
require __DIR__.'/../src/Notifications.php';
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
if(getenv('SQF_NOTIFICATIONS_ENABLED')!=='1'){fwrite(STDERR,"Entrega desativada\n");exit(2);}
try{echo json_encode(sqfDeliverNotifications(sqfDatabase(),'sqfNotificationMail'),JSON_THROW_ON_ERROR).PHP_EOL;}
catch(Throwable $e){fwrite(STDERR,"Falha no processamento de avisos\n");exit(1);}
