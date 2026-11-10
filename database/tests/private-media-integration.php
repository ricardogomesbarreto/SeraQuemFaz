<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Moderation.php';
require __DIR__.'/../../backend/src/PrivateMedia.php';
$db=sqfDatabase();
function verify(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);echo "PASS: $m\n";}
function forbid(callable $action,string $m):void{try{$action();}catch(DomainException $e){verify(true,$m);return;}throw new RuntimeException($m);}
$client='00000000-0000-4000-8000-000000000001';
$provider='00000000-0000-4000-8000-000000000002';
$stranger='00000000-0000-4000-8000-000000000003';
$request='00000000-0000-4000-8000-000000000011';
$im=imagecreatetruecolor(8,8);imagefill($im,0,0,imagecolorallocate($im,20,80,100));ob_start();imagewebp($im);$bytes=ob_get_clean();imagedestroy($im);
verify(is_string($bytes)&&strlen($bytes)>16,'valid WebP fixture');
$doc=sqfSavePrivateImage($db,$provider,'verification','identity_evidence',$bytes);
verify(strlen($doc)===36,'verification stored by provider');
verify(is_file(sqfPrivateImagePath($db,$provider,'verification',$doc)),'owner can view verification document');
forbid(fn()=>sqfPrivateImagePath($db,$client,'verification',$doc),'client cannot read provider identity document');
forbid(fn()=>sqfPrivateImagePath($db,$stranger,'verification',$doc),'unverified staff cannot read private identity');
forbid(fn()=>sqfSavePrivateImage($db,$client,'verification','identity_evidence',$bytes),'client cannot submit provider document');
$attachment=sqfSavePrivateImage($db,$client,'attachment',$request,$bytes,'Imagem de teste');
verify(is_file(sqfPrivateImagePath($db,$provider,'attachment',$attachment)),'other request participant can read attachment');
forbid(fn()=>sqfPrivateImagePath($db,$stranger,'attachment',$attachment),'third party cannot read request attachment');
forbid(fn()=>sqfSavePrivateImage($db,$stranger,'attachment',$request,$bytes),'third party cannot attach to request');
forbid(fn()=>sqfPrivateImagePath($db,$provider,'attachment','../etc/passwd'),'path traversal rejected');
verify((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_verification_documents WHERE id=? AND provider_id=?',[$doc,$provider])->fetchColumn()===1,'private document metadata committed');
verify((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_request_attachments WHERE id=? AND uploaded_by=?',[$attachment,$client])->fetchColumn()===1,'attachment metadata committed');
