<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';

/** Private image storage: never put SQF_PRIVATE_MEDIA_ROOT under the web root. */
function sqfMediaRoot():string {
    $root=getenv('SQF_PRIVATE_MEDIA_ROOT');
    if(!$root||!is_dir($root)||!is_writable($root))throw new RuntimeException('Armazenamento privado indisponível');
    $resolved=realpath($root);
    $site=realpath(__DIR__.'/../../');
    if(!$resolved||($site&&($resolved===$site||str_starts_with($resolved,$site.DIRECTORY_SEPARATOR))))throw new RuntimeException('Diretório privado inseguro');
    return $resolved;
}
function sqfImagePayload(string $tmp,int $size):string {
    if($size<=0||$size>5*1024*1024||!is_uploaded_file($tmp))throw new DomainException('Imagem inválida (máximo 5 MB)');
    if(!extension_loaded('gd')||!function_exists('imagecreatefromwebp'))throw new RuntimeException('Extensão GD/WebP indisponível');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($tmp);
    if($mime!=='image/webp')throw new DomainException('Envie imagem WebP');
    $info=@getimagesize($tmp);
    if(!$info||$info[0]<1||$info[1]<1||$info[0]>4000||$info[1]>4000)throw new DomainException('Dimensões inválidas');
    $image=@imagecreatefromwebp($tmp);
    if(!$image)throw new DomainException('Imagem corrompida');
    try{
        ob_start();$ok=imagewebp($image,null,85);$bytes=ob_get_clean();
        if(!$ok||!is_string($bytes)||strlen($bytes)>5*1024*1024)throw new DomainException('Imagem não processável');
        return $bytes;
    } finally {imagedestroy($image);}
}
function sqfSavePrivateImage(PDO $db,string $actor,string $kind,string $context,string $bytes,string $caption=''):string {
    $root=sqfMediaRoot();
    $id=(string)$db->query('SELECT UUID()')->fetchColumn();
    if(strlen($bytes)<16||substr($bytes,0,4)!=='RIFF'||substr($bytes,8,4)!=='WEBP')throw new DomainException('Imagem inválida');
    $caption=trim($caption);
    if(mb_strlen($caption)>160)throw new DomainException('Legenda muito longa');
    if($kind==='verification'){
        if(!in_array($context,['identity_evidence','professional_license'],true))throw new DomainException('Documento inválido');
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
        $path=$actor.'/'.$id.'.webp';$relative='verification/'.$path;
    }elseif($kind==='portfolio'){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
        if(!sqfQuery($db,'SELECT 1 FROM provider_services WHERE id=? AND provider_id=?',[$context,$actor])->fetchColumn())throw new DomainException('Serviço indisponível');
        $path=$actor.'/'.$id.'.webp';$relative='portfolio/'.$path;
    }elseif($kind==='avatar'){
        if($context!=='self'||!sqfQuery($db,'SELECT 1 FROM profiles WHERE id=?',[$actor])->fetchColumn())throw new DomainException('Perfil indisponível');
        $path=$actor.'/'.$id.'.webp';$relative='avatars/'.$path;
    }elseif($kind==='attachment'){
        $r=sqfQuery($db,'SELECT client_id,provider_id,status FROM sqf_service_requests WHERE id=?',[$context])->fetch(PDO::FETCH_ASSOC);
        if(!$r||!in_array($actor,[$r['client_id'],$r['provider_id']],true)||in_array($r['status'],['canceled','declined'],true))throw new DomainException('Solicitação indisponível');
        $path=$context.'/'.$actor.'/'.$id.'.webp';$relative='attachments/'.$path;
    }else throw new DomainException('Tipo de arquivo inválido');
    $full=$root.'/'.$relative;
    $folder=dirname($full);
    if(!is_dir($folder)&&!mkdir($folder,0700,true)&&!is_dir($folder))throw new RuntimeException('Erro ao preparar armazenamento');
    // Identifiers are UUIDs and fixed names, never arbitrary browser-supplied paths.
    if(file_put_contents($full,$bytes,LOCK_EX)!==strlen($bytes))throw new RuntimeException('Erro ao gravar arquivo');
    chmod($full,0600);
    try{
        sqfTxn($db,function()use($db,$kind,$id,$actor,$context,$path,$caption){
            if($kind==='portfolio')sqfQuery($db,'INSERT INTO portfolio_photos(id,provider_id,storage_path,caption,service_id) VALUES (?,?,?,?,?)',[$id,$actor,$path,$caption,$context]);
            elseif($kind==='avatar')sqfQuery($db,'UPDATE profiles SET avatar_path=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',[$path,$actor]);
            elseif($kind==='verification')sqfQuery($db,'INSERT INTO sqf_verification_documents(id,provider_id,document_kind,storage_path) VALUES (?,?,?,?)',[$id,$actor,$context,$path]);
            else sqfQuery($db,'INSERT INTO sqf_request_attachments(id,request_id,uploaded_by,storage_path,caption) VALUES (?,?,?,?,?)',[$id,$context,$actor,$path,$caption]);
        });
    }catch(Throwable $e){@unlink($full);throw $e;}
    return $id;
}
function sqfPrivateImagePath(PDO $db,string $actor,string $kind,string $id,bool $staffMfa=false):string {
    if(!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD',$id))throw new DomainException('Arquivo indisponível');
    if($kind==='verification'){
        $row=sqfQuery($db,'SELECT provider_id,storage_path FROM sqf_verification_documents WHERE id=?',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$row||($row['provider_id']!==$actor&&!($staffMfa&&sqfStaffRole($db,$actor)!==null)))throw new DomainException('Arquivo indisponível');
        $relative='verification/'.$row['storage_path'];
    }elseif($kind==='portfolio'){
        $row=sqfQuery($db,'SELECT ph.provider_id,ph.storage_path,s.is_active FROM portfolio_photos ph LEFT JOIN provider_services s ON s.id=ph.service_id AND s.provider_id=ph.provider_id WHERE ph.id=?',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$row||($row['provider_id']!==$actor&&(!(int)$row['is_active']||!sqfProviderPublic($db,$row['provider_id']))))throw new DomainException('Arquivo indisponível');
        $relative='portfolio/'.$row['storage_path'];
    }elseif($kind==='avatar'){
        $row=sqfQuery($db,'SELECT id,avatar_path FROM profiles WHERE id=?',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$row||!$row['avatar_path']||($row['id']!==$actor&&!sqfProviderPublic($db,$row['id'])))throw new DomainException('Arquivo indisponível');
        $relative='avatars/'.$row['avatar_path'];
    }elseif($kind==='attachment'){
        $row=sqfQuery($db,'SELECT a.storage_path,r.client_id,r.provider_id FROM sqf_request_attachments a JOIN sqf_service_requests r ON r.id=a.request_id WHERE a.id=?',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$row||!in_array($actor,[$row['client_id'],$row['provider_id']],true))throw new DomainException('Arquivo indisponível');
        $relative='attachments/'.$row['storage_path'];
    }else throw new DomainException('Arquivo indisponível');
    $root=sqfMediaRoot();
    $path=$root.'/'.$relative;$resolved=realpath($path);
    if(!$resolved||!str_starts_with($resolved,$root.DIRECTORY_SEPARATOR)||!is_file($resolved)||is_link($path))throw new DomainException('Arquivo indisponível');
    return $resolved;
}

function sqfListPrivateMedia(PDO $db,string $actor,string $kind,?string $request=null):array {
    if($kind==='portfolio'){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
        return sqfQuery($db,'SELECT id,caption,service_id,is_cover,created_at FROM portfolio_photos WHERE provider_id=? ORDER BY created_at DESC LIMIT 50',[$actor])->fetchAll(PDO::FETCH_ASSOC);
    }
    if($kind==='verification'){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
        return sqfQuery($db,'SELECT id,document_kind,status,created_at FROM sqf_verification_documents WHERE provider_id=? ORDER BY created_at DESC LIMIT 50',[$actor])->fetchAll(PDO::FETCH_ASSOC);
    }
    if($kind==='attachment'&&$request!==null){
        $row=sqfQuery($db,'SELECT client_id,provider_id FROM sqf_service_requests WHERE id=?',[$request])->fetch(PDO::FETCH_ASSOC);
        if(!$row||!in_array($actor,[$row['client_id'],$row['provider_id']],true))throw new DomainException('Solicitação indisponível');
        return sqfQuery($db,'SELECT id,caption,created_at FROM sqf_request_attachments WHERE request_id=? ORDER BY created_at DESC LIMIT 50',[$request])->fetchAll(PDO::FETCH_ASSOC);
    }
    throw new DomainException('Tipo de mídia inválido');
}
