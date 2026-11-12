<?php
declare(strict_types=1);
// Read-only full inventory for fictional staging and its independent restore.
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/ImportSnapshot.php';

$scope=(string)(getenv('SQF_LOCAL_ENGINE')?:'');
if($scope!==''&&!in_array($scope,['mysql80','mariadb1011'],true))throw new RuntimeException('Unsupported local fixture engine');
$rootPrefix=sys_get_temp_dir().'/sqf-import'.($scope!==''?'-'.$scope:'');
$expectedRoots=[
    'source'=>[getenv('SQF_PRIVATE_MEDIA_ROOT'),$rootPrefix.'-stage-media'],
    'restore'=>[getenv('SQF_RESTORE_MEDIA_ROOT'),$rootPrefix.'-restore-media'],
];
function physicalInventory(string $configured,string $expected):array {
    if($configured!==$expected||!is_dir($configured)||is_link($configured))throw new RuntimeException('Unapproved or missing isolated media root');
    $base=realpath($configured);
    if($base===false)throw new RuntimeException('Invalid isolated media path');
    $result=[];
    $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base,FilesystemIterator::SKIP_DOTS));
    foreach($it as $file){
        if($file->isLink()||!$file->isFile())throw new RuntimeException('Unexpected media filesystem entry');
        $full=$file->getPathname();
        if(!str_starts_with($full,$base.DIRECTORY_SEPARATOR))throw new RuntimeException('Media escaped isolated root');
        $relative=substr($full,strlen($base)+1);
        if(!preg_match('#\\.webp$#i',$relative))throw new RuntimeException('Unexpected file in isolated media root');
        $digest=hash_file('sha256',$full);
        if($digest===false)throw new RuntimeException('Could not hash isolated media');
        $result[$relative]=$digest;
    }
    ksort($result);
    return $result;
}
$db=sqfDatabase();
if((string)$db->query('SELECT DATABASE()')->fetchColumn()!=='sqf_import_stage')throw new RuntimeException('Wrong source database');
$expected=sqfMediaInventory($db,(string)$expectedRoots['source'][0]);
if(count($expected)<1)throw new RuntimeException('No persisted fictional media to compare');
foreach($expectedRoots as $label=>[$configured,$root]){
    $actual=physicalInventory((string)$configured,$root);
    if($actual!==$expected)throw new RuntimeException('Missing, altered or orphan media in '.$label);
    echo 'PASS: '.$label.' contains exactly '.count($actual).' referenced WebP files (SHA-256)'.PHP_EOL;
}
