<?php
declare(strict_types=1);
require_once __DIR__.'/Auth.php';

/** Normalized export only. Source credentials, privileged roles and sessions
 * are deliberately excluded; publication must be reviewed after transfer. */
function sqfImportTables():array {
    return ['sqf_auth_users','profiles','provider_professional_details','provider_services','provider_verifications','sqf_account_settings','service_engagements','sqf_service_requests','sqf_appointments','sqf_request_messages','sqf_request_events','sqf_request_read_receipts','portfolio_photos','sqf_request_attachments','sqf_verification_documents','reviews','sqf_review_responses','sqf_review_disputes','sqf_client_favorites','sqf_client_category_favorites','sqf_profile_views','sqf_provider_coverage','sqf_portrait_checks','safety_reports','privacy_requests','sqf_support_tickets','sqf_notification_preferences','sqf_notifications','sqf_billing_subscriptions','sqf_billing_invoices','sqf_billing_payment_attempts','sqf_staff_decision_log'];
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
    if($commit&&getenv('SQF_IMPORT_STAGING_ENABLED')!=='1')throw new DomainException('Importação persistente desativada');
    $tables=sqfImportTables();$rows=$snapshot['tables']??null;$manifest=$snapshot['media']??null;
    if(!is_array($rows)||!is_array($manifest)||array_diff(array_keys($rows),$tables)||array_diff($tables,array_keys($rows)))throw new DomainException('Inventário incompleto ou desconhecido');
    if($db->inTransaction())throw new DomainException('Transação aberta');
    if((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()!==0)throw new DomainException('Banco de destino deve estar vazio');
    $db->beginTransaction();try{
        $counts=[];
        foreach($tables as $table){
            if(!is_array($rows[$table])||!array_is_list($rows[$table])||count($rows[$table])>50000)throw new DomainException('Lote inválido');
            if((int)$db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn()!==0)throw new DomainException('Tabela de destino não vazia');
            $columns=sqfQuery($db,'SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?',[$table])->fetchAll(PDO::FETCH_COLUMN);
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
        $actual=sqfMediaInventory($db,$mediaRoot);ksort($manifest);
        if($actual!==$manifest)throw new DomainException('Manifesto de mídia divergente');
        if($commit)$db->commit();else $db->rollBack();
        return ['tables'=>$counts,'media_count'=>count($actual),'committed'=>$commit,'publication_enabled'=>false];
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
