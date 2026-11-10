<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';require __DIR__.'/../../backend/src/ImportSnapshot.php';
$db=sqfDatabase();$root=sys_get_temp_dir().'/sqf-import-'.bin2hex(random_bytes(8));mkdir($root,0700);
function check(bool $x,string $m):void{if(!$x)throw new RuntimeException($m);echo "PASS: $m\n";}
try{
    $tables=array_fill_keys(sqfImportTables(),[]);$id='00000000-0000-4000-8000-000000000090';
    $tables['sqf_auth_users']=[['id'=>$id,'email'=>'snapshot@example.invalid']];
    $tables['profiles']=[['id'=>$id,'full_name'=>'Conta de teste','account_type'=>'cliente']];
    $snap=['tables'=>$tables,'media'=>[]];
    $r=sqfImportSnapshot($db,$snap,$root);
    check(!$r['committed']&&$r['tables']['profiles']===1,'complete normalized snapshot dry-run');
    check((int)$db->query('SELECT COUNT(*) FROM profiles')->fetchColumn()===0,'snapshot rollback preserves empty destination');
    $bad=$snap;$bad['media']=['avatars/missing.webp'=>str_repeat('a',64)];
    try{sqfImportSnapshot($db,$bad,$root);throw new RuntimeException('manifest accepted');}catch(DomainException $e){check(true,'mismatched media manifest rejected');}
    check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'failed import rolls back');
}finally{rmdir($root);}
