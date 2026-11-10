<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
$source=sqfDatabase();
$dsn=getenv('SQF_RESTORE_DSN');
if(!$dsn)throw new RuntimeException('Restore DSN required');
$restored=new PDO($dsn,getenv('SQF_DB_USER'),getenv('SQF_DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$tables=static fn(PDO $db):array=>$db->query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE' ORDER BY table_name")->fetchAll(PDO::FETCH_COLUMN);
$names=$tables($source);
if($names!==$tables($restored))throw new RuntimeException('Restored table inventory differs');
$digest=static function(PDO $db,string $table):array{
    $rows=$db->query('SELECT * FROM `'.str_replace('`','``',$table).'`');
    $hashes=[];
    while($row=$rows->fetch(PDO::FETCH_ASSOC))$hashes[]=hash('sha256',json_encode($row,JSON_THROW_ON_ERROR|JSON_INVALID_UTF8_SUBSTITUTE));
    sort($hashes,SORT_STRING);
    return [count($hashes),hash('sha256',implode("\n",$hashes))];
};
foreach($names as $name){
    if($digest($source,$name)!==$digest($restored,$name))throw new RuntimeException('Restored content differs: '.$name);
    echo 'PASS: restored '.$name.PHP_EOL;
}
echo 'PASS: all '.count($names).' table contents preserved in disposable restore'.PHP_EOL;
