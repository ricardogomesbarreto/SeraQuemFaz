<?php
declare(strict_types=1);
require_once __DIR__.'/Auth.php';

/** Normalized export only. Source credentials, privileged roles and sessions
 * are deliberately excluded; publication must be reviewed after transfer. */
function sqfImportTables():array {
    return ['sqf_auth_users','profiles','provider_professional_details','provider_services','provider_verifications','sqf_account_settings','service_engagements','sqf_service_requests','sqf_appointments','sqf_request_messages','sqf_request_events','sqf_request_read_receipts','portfolio_photos','sqf_request_attachments','sqf_verification_documents','reviews','sqf_review_responses','sqf_review_disputes','sqf_client_favorites','sqf_client_category_favorites','sqf_profile_views','sqf_provider_coverage','sqf_portrait_checks','safety_reports','privacy_requests','sqf_support_tickets','sqf_notification_preferences','sqf_notifications','sqf_billing_subscriptions','sqf_billing_cycle_requests','sqf_billing_invoices','sqf_billing_payment_attempts','sqf_staff_decision_log'];
}
function sqfMediaInventory(PDO $db,string $root):array {
    $base=realpath($root);if(!$base||!is_dir($base))throw new DomainException('Diretório de mídia inválido');
    $files=[];
    foreach(['avatars'=>['profiles','avatar_path'],'portfolio'=>['portfolio_photos','storage_path'],'attachments'=>['sqf_request_attachments','storage_path'],'verification'=>['sqf_verification_documents','storage_path']] as $prefix=>[$table,$column]){
        foreach($db->query("SELECT $column FROM $table WHERE $column IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN) as $path){
            $relative=$prefix.'/'.$path;
            if(!preg_match('#^(?:avatars|portfolio|verification)/[0-9a-f-]{36}/[0-9a-f-]{36}\\.webp$|^attachments/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.webp$#D',$relative))throw new DomainException('Caminho de mídia inválido');
            $full=realpath($base.'/'.$relative);
            if(!$full||!str_starts_with($full,$base.DIRECTORY_SEPARATOR)||!is_file($full)||is_link($base.'/'.$relative)||filesize($full)>5*1024*1024||filesize($full)===0)throw new DomainException('Mídia ausente ou inválida');
            $info=@getimagesize($full);if(!$info||($info['mime']??'')!=='image/webp'||$info[0]>4000||$info[1]>4000)throw new DomainException('Formato de mídia inválido');
            $files[$relative]=hash_file('sha256',$full);
        }
    }
    ksort($files);return $files;
}
function sqfImportSnapshot(PDO $db,array $snapshot,string $mediaRoot,bool $commit=false):array {
    if($commit){
        if(getenv('SQF_IMPORT_STAGING_ENABLED')!=='1')throw new DomainException('Importação persistente desativada');
        $database=(string)$db->query('SELECT DATABASE()')->fetchColumn();
        $expected=(string)(getenv('SQF_IMPORT_STAGING_DATABASE')?:'');
        if($expected===''||!hash_equals($expected,$database)||preg_match('/(?:^|_)(?:staging|stage)(?:_|$)/i',$database)!==1)
            throw new DomainException('Destino de importação não é o banco isolado autorizado');
    }
    $tables=sqfImportTables();$rows=$snapshot['tables']??null;$manifest=$snapshot['media']??null;
    if(!is_array($rows)||!is_array($manifest)||array_diff(array_keys($rows),$tables)||array_diff($tables,array_keys($rows)))throw new DomainException('Inventário incompleto ou desconhecido');
    if(array_diff(array_keys($snapshot),['tables','media']))throw new DomainException('Campos desconhecidos no snapshot');
    // Validate the normalized source before any insert. This must remain safe
    // even when a source dump or database session has disabled foreign keys.
    $profiles=[];
    if(!is_array($rows['profiles'])||!is_array($rows['sqf_service_requests'])||!is_array($rows['sqf_request_messages']))
        throw new DomainException('Relações do inventário inválidas');
    foreach($rows['profiles'] as $profile){
        if(!is_array($profile)||!isset($profile['id'])||!is_string($profile['id']))throw new DomainException('Perfil de origem inválido');
        $profiles[$profile['id']]=true;
    }
    $participants=[];
    foreach($rows['sqf_service_requests'] as $request){
        if(!is_array($request)||!isset($request['id'],$request['client_id'],$request['provider_id'])
           ||!is_string($request['id'])||!is_string($request['client_id'])||!is_string($request['provider_id']))
            throw new DomainException('Solicitação de origem inválida');
        if(!isset($profiles[$request['client_id']],$profiles[$request['provider_id']]))
            throw new DomainException('Solicitação sem perfis participantes');
        $participants[$request['id']]=[$request['client_id'],$request['provider_id']];
    }
    foreach($rows['sqf_request_messages'] as $message){
        if(!is_array($message)||!isset($message['request_id'],$message['sender_id'])
           ||!is_string($message['request_id'])||!is_string($message['sender_id'])
           ||!isset($participants[$message['request_id']])
           ||!in_array($message['sender_id'],$participants[$message['request_id']],true))
            throw new DomainException('Mensagem sem remetente participante da solicitação');
    }
    if($db->inTransaction())throw new DomainException('Transação aberta');
    if((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()!==0)throw new DomainException('Banco de destino deve estar vazio');
    $db->beginTransaction();try{
        $counts=[];
        foreach($tables as $table){
            if(!is_array($rows[$table])||!array_is_list($rows[$table])||count($rows[$table])>50000)throw new DomainException('Lote inválido');
            if((int)$db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn()!==0)throw new DomainException('Tabela de destino não vazia');
            $columns=sqfQuery($db,'SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name<>? ',[$table,'current_user_id'])->fetchAll(PDO::FETCH_COLUMN);
            foreach($rows[$table] as $row){
                if(!is_array($row)||!$row||array_is_list($row)||array_diff(array_keys($row),$columns))throw new DomainException('Colunas inválidas');
                if($table==='sqf_auth_users'){
                    if(array_key_exists('password_hash',$row)||array_key_exists('auth_version',$row))throw new DomainException('Credenciais proibidas');
                    $row['email']=sqfEmail((string)($row['email']??''));$row['password_hash']=null;
                }
                if($table==='profiles')$row['is_public']=0;
                if($table==='sqf_billing_subscriptions'){$row['checkout_url']=null;}
                foreach($row as $value)if(!is_scalar($value)&&$value!==null)throw new DomainException('Normalize JSON e datas antes da importação');
                $keys=array_keys($row);$names=implode(',',array_map(fn($k)=>'`'.$k.'`',$keys));
                sqfQuery($db,"INSERT INTO `$table` ($names) VALUES (".implode(',',array_fill(0,count($keys),'?')).')',array_values($row));
            }
            $counts[$table]=(int)$db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
            if($counts[$table]!==count($rows[$table]))throw new RuntimeException('Contagem divergente');
        }
        if($counts['profiles']!==$counts['sqf_auth_users'])throw new DomainException('Identidades sem perfil');
        // Never rely solely on database FK settings during a normalized import:
        // the sender must exist and participate in the referenced service request.
        $invalidSenders=(int)$db->query(
            'SELECT COUNT(*) FROM sqf_request_messages m
             LEFT JOIN sqf_service_requests r ON r.id=m.request_id
             LEFT JOIN profiles p ON p.id=m.sender_id
             WHERE r.id IS NULL OR p.id IS NULL
                OR (m.sender_id<>r.client_id AND m.sender_id<>r.provider_id)'
        )->fetchColumn();
        if($invalidSenders!==0)throw new DomainException('Mensagem com remetente sem vínculo com a solicitação');
        $actual=sqfMediaInventory($db,$mediaRoot);ksort($manifest);
        if($actual!==$manifest)throw new DomainException('Manifesto de mídia divergente');
        if($commit)$db->commit();else $db->rollBack();
        return ['tables'=>$counts,'media_count'=>count($actual),'committed'=>$commit,'publication_enabled'=>false];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
