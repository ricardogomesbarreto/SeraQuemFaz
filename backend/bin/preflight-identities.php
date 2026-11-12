<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../src/Database.php';
require __DIR__.'/../src/MigrationPreflight.php';
if(count($argv)!==2||!is_file($argv[1])||filesize($argv[1])>52428800){fwrite(STDERR,"Informe snapshot JSON privado de até 50 MiB.\n");exit(2);}
try{$snapshot=json_decode(file_get_contents($argv[1]),true,32,JSON_THROW_ON_ERROR);echo json_encode(sqfPreflightIdentities(sqfDatabase(),$snapshot),JSON_THROW_ON_ERROR).PHP_EOL;}
catch(Throwable $e){fwrite(STDERR,"Pré-validação recusada; nenhum dado persistido. Revise formato e banco vazio.\n");exit(1);}
