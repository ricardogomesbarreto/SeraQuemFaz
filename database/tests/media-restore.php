<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';require __DIR__.'/../../backend/src/ImportSnapshot.php';
$source=getenv('SQF_PRIVATE_MEDIA_ROOT');$copy=getenv('SQF_RESTORE_MEDIA_ROOT');
if(!$source||!$copy)throw new RuntimeException('Missing isolated media paths');
$db=sqfDatabase();$a=sqfMediaInventory($db,$source);$b=sqfMediaInventory($db,$copy);
if(!$a||$a!==$b)throw new RuntimeException('Media restore mismatch');
echo 'PASS: '.count($a).' referenced media SHA256 hashes restored'.PHP_EOL;
