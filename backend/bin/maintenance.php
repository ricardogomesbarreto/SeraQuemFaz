<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../src/Database.php';
require __DIR__.'/../src/Maintenance.php';
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
if(getenv('SQF_MAINTENANCE_ENABLED')!=='1'){fwrite(STDERR,"Manutenção desativada\n");exit(2);}
try{echo json_encode(sqfCleanupAuth(sqfDatabase()),JSON_THROW_ON_ERROR).PHP_EOL;}
catch(Throwable $e){fwrite(STDERR,"Falha na manutenção\n");exit(1);}
