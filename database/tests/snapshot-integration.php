<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';require __DIR__.'/../../backend/src/ImportSnapshot.php';
$db=sqfDatabase();$root=sys_get_temp_dir().'/sqf-import-'.bin2hex(random_bytes(8));mkdir($root,0700);
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
}finally{if(isset($relative)){unlink($root.'/'.$relative);rmdir($root.'/portfolio/'.$provider);rmdir($root.'/portfolio');}rmdir($root);}
