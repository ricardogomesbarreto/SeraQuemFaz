<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';require __DIR__.'/../../backend/src/ImportSnapshot.php';
$db=sqfDatabase();
$keepMedia=getenv('SQF_TEST_ISOLATED_IMPORT_STAGE')==='1';
$root=$keepMedia?(string)getenv('SQF_PRIVATE_MEDIA_ROOT'):sys_get_temp_dir().'/sqf-import-'.bin2hex(random_bytes(8));
if($keepMedia&&$root!==sys_get_temp_dir().'/sqf-import-stage-media')throw new RuntimeException('Staging fixture must use its dedicated temporary media root');
if($root===''||file_exists($root)||is_link($root)||!mkdir($root,0700))throw new RuntimeException('Fixture media root must not exist before the test');
function check(bool $x,string $m):void{if(!$x)throw new RuntimeException($m);echo "PASS: $m\n";}
try{
    $tables=array_fill_keys(sqfImportTables(),[]);$id='00000000-0000-4000-8000-000000000090';
    $tables['sqf_auth_users']=[['id'=>$id,'email'=>'snapshot@example.invalid']];
    $tables['profiles']=[['id'=>$id,'full_name'=>'Conta de teste','account_type'=>'cliente']];
    $provider='00000000-0000-4000-8000-000000000091';
    $service='00000000-0000-4000-8000-000000000092';
    $request='00000000-0000-4000-8000-000000000093';
    $photo='00000000-0000-4000-8000-000000000094';
    $message='00000000-0000-4000-8000-000000000095';
    $category=(string)$db->query("SELECT id FROM categories WHERE status='active' ORDER BY id LIMIT 1")->fetchColumn();
    $tables['sqf_auth_users'][]=['id'=>$provider,'email'=>'snapshot-provider@example.invalid'];
    $tables['profiles'][]=['id'=>$provider,'full_name'=>'Prestador de teste','account_type'=>'prestador','city_ibge'=>'2111300','is_public'=>1];
    $tables['provider_services'][]=['id'=>$service,'provider_id'=>$provider,'category_id'=>$category,'service_title'=>'Serviço fictício'];
    $tables['sqf_service_requests'][]=['id'=>$request,'client_id'=>$id,'provider_id'=>$provider,'service_id'=>$service,'city_ibge'=>'2111300','description'=>'Solicitação fictícia de migração para teste'];
    $tables['sqf_request_messages'][]=['id'=>$message,'request_id'=>$request,'sender_id'=>$id,'body'=>'Mensagem fictícia'];
    $relative='portfolio/'.$provider.'/'.$photo.'.webp';
    mkdir($root.'/portfolio/'.$provider,0700,true);
    $image=imagecreatetruecolor(16,16);imagewebp($image,$root.'/'.$relative);imagedestroy($image);
    $tables['portfolio_photos'][]=['id'=>$photo,'provider_id'=>$provider,'storage_path'=>$provider.'/'.$photo.'.webp','service_id'=>$service];
    $snap=['tables'=>$tables,'media'=>[$relative=>hash_file('sha256',$root.'/'.$relative)]];
    $r=sqfImportSnapshot($db,$snap,$root);
    check(!$r['committed']&&$r['tables']['profiles']===2&&$r['tables']['sqf_request_messages']===1&&$r['media_count']===1,'complete normalized snapshot dry-run');
    check((int)$db->query('SELECT COUNT(*) FROM profiles')->fetchColumn()===0,'snapshot rollback preserves empty destination');
    $bad=$snap;$bad['media'][$relative]=str_repeat('a',64);
    try{sqfImportSnapshot($db,$bad,$root);throw new RuntimeException('manifest accepted');}catch(DomainException $e){check(true,'mismatched media manifest rejected');}
    check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'failed import rolls back');
    $relationalFailure=$snap;
    $relationalFailure['sqf_request_messages'][0]['sender_id']='00000000-0000-4000-8000-000000000999';
    try{sqfImportSnapshot($db,$relationalFailure,$root);throw new RuntimeException('Broken relation accepted');}
    catch(PDOException|DomainException $e){check(true,'orphaned sender triggers transactional rollback');}
    check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'relational failure leaves no partially imported identities');
    check((int)$db->query('SELECT COUNT(*) FROM sqf_service_requests')->fetchColumn()===0,'relational failure leaves no partially imported requests');
    $priorEnabled=getenv('SQF_IMPORT_STAGING_ENABLED');
    $priorDestination=getenv('SQF_IMPORT_STAGING_DATABASE');
    putenv('SQF_IMPORT_STAGING_ENABLED=1');
    putenv('SQF_IMPORT_STAGING_DATABASE=sqf_unexpected_stage');
    try{
        try{sqfImportSnapshot($db,$snap,$root,true);throw new RuntimeException('Unapproved persistent destination accepted');}
        catch(DomainException $e){check(true,'persistent import rejects mismatched staging database');}
    }finally{
        if($priorEnabled===false)putenv('SQF_IMPORT_STAGING_ENABLED');
        else putenv('SQF_IMPORT_STAGING_ENABLED='.$priorEnabled);
        if($priorDestination===false)putenv('SQF_IMPORT_STAGING_DATABASE');
        else putenv('SQF_IMPORT_STAGING_DATABASE='.$priorDestination);
    }
    check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'unapproved staging attempt does not persist records');
    // Default tests roll back. Persist only in an explicitly named disposable schema.
    if(getenv('SQF_TEST_ISOLATED_IMPORT_STAGE')==='1'){
        check((string)$db->query('SELECT DATABASE()')->fetchColumn()==='sqf_import_stage','commit limited to disposable import staging schema');
        check(getenv('SQF_IMPORT_STAGING_ENABLED')==='1','staging persistence explicitly enabled');
        check(getenv('SQF_IMPORT_STAGING_DATABASE')==='sqf_import_stage','isolated destination explicitly confirmed');
        // In commit mode, reject invalid media or broken foreign keys without persisting any rows.
        try{sqfImportSnapshot($db,$bad,$root,true);throw new RuntimeException('Bad media persisted');}
        catch(DomainException $e){check(true,'persistent import rejects tampered WebP manifest');}
        check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===0,'media failure leaves staging identities empty');
        try{sqfImportSnapshot($db,$relationalFailure,$root,true);throw new RuntimeException('Orphan message persisted');}
        catch(PDOException|DomainException $e){check(true,'persistent import rejects orphaned message sender');}
        check((int)$db->query('SELECT COUNT(*) FROM sqf_service_requests')->fetchColumn()===0,'relation failure leaves staging requests empty');
        $committed=sqfImportSnapshot($db,$snap,$root,true);
        check($committed['committed']===true&&$committed['publication_enabled']===false,'synthetic snapshot committed without automatic publication');
        // Compare every migrated table, not only the principal user journeys.
        foreach(sqfImportTables() as $name){
            $expected=count($snap['tables'][$name]);
            $actual=(int)$db->query('SELECT COUNT(*) FROM `'.$name.'`')->fetchColumn();
            check($actual===$expected,'staging row count reconciled: '.$name);
        }
        check((int)$db->query('SELECT COUNT(*) FROM profiles WHERE is_public<>0')->fetchColumn()===0,'imported profiles remain unpublished');
        check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users WHERE password_hash IS NOT NULL')->fetchColumn()===0,'imported accounts require new credentials');
        check((int)$db->query('SELECT COUNT(*) FROM sqf_request_messages m JOIN sqf_service_requests r ON r.id=m.request_id')->fetchColumn()===1,'migrated messages preserve request relationships');
        $inventory=sqfMediaInventory($db,$root);
        check($inventory===$snap['media'],'staging WebP media SHA256 reconciled');
        try{sqfImportSnapshot($db,$snap,$root,true);throw new RuntimeException('nonempty staging accepted');}
        catch(DomainException $e){check(true,'repeat import refused for nonempty destination');}
        check((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()===2,'failed repeat import preserved committed rows');
    }
}finally{
    if(!$keepMedia){
        if(isset($relative)){unlink($root.'/'.$relative);rmdir($root.'/portfolio/'.$provider);rmdir($root.'/portfolio');}
        rmdir($root);
    }else{
        echo 'INFO: fictional media kept for independent restore comparison at '.$root.PHP_EOL;
    }
}
