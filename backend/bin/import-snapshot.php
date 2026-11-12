<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../src/Database.php';require __DIR__.'/../src/ImportSnapshot.php';
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
if(count($argv)<3||count($argv)>4||!is_file($argv[1])||filesize($argv[1])>52428800||isset($argv[3])&&$argv[3]!=='--commit-staging'){fwrite(STDERR,"Uso: import-snapshot.php snapshot.json diretorio-privado [--commit-staging]\n");exit(2);}
try{$data=json_decode(file_get_contents($argv[1]),true,64,JSON_THROW_ON_ERROR);echo json_encode(sqfImportSnapshot(sqfDatabase(),$data,$argv[2],isset($argv[3])),JSON_THROW_ON_ERROR).PHP_EOL;}
catch(Throwable $e){fwrite(STDERR,"Importação recusada; confira formato, contagens, vínculos e mídia. Nenhum lote parcial confirmado.\n");exit(1);}
