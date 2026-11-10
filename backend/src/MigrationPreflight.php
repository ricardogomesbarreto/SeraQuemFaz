<?php
declare(strict_types=1);
require_once __DIR__.'/Auth.php';

/** Transactional dry run only: never persists real identities or changes origin. */
function sqfPreflightIdentities(PDO $db,array $snapshot):array {
    if(!isset($snapshot['identities'],$snapshot['profiles'])||!is_array($snapshot['identities'])||!is_array($snapshot['profiles'])||!array_is_list($snapshot['identities'])||!array_is_list($snapshot['profiles']))throw new DomainException('Formato de exportação inválido');
    if(count($snapshot['identities'])>50000||count($snapshot['profiles'])>50000)throw new DomainException('Limite de lote excedido');
    if(count($snapshot['identities'])!==count($snapshot['profiles']))throw new DomainException('Contagem de perfis divergente');
    if($db->inTransaction())throw new RuntimeException('Transação já aberta');
    if((int)$db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()!==0)throw new DomainException('Use somente banco novo e vazio');
    $uuid=static fn($id):bool=>is_string($id)&&preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D',$id)===1;
    $date=static function($value):?string {
        if($value===null)return null;
        if(!is_string($value)||!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/D',$value))throw new DomainException('Data de origem inválida');
        $d=new DateTimeImmutable($value);$e=DateTimeImmutable::getLastErrors();
        if($e&&($e['warning_count']||$e['error_count']))throw new DomainException('Data de origem inválida');
        return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    };
    $identities=[];$emails=[];$profiles=[];
    foreach($snapshot['identities'] as $row){
        if(!is_array($row)||array_diff(array_keys($row),['id','email','email_confirmed_at','created_at'])||!$uuid($row['id']??null)||!is_string($row['email']??null)||isset($identities[$row['id']]))throw new DomainException('Identidade duplicada ou inválida');
        $email=sqfEmail($row['email']);
        if(isset($emails[$email]))throw new DomainException('E-mail duplicado após normalização');
        $emails[$email]=true;$identities[$row['id']]=[$email,$date($row['email_confirmed_at']??null),$date($row['created_at']??null)];
    }
    foreach($snapshot['profiles'] as $row){
        if(!is_array($row)||array_diff(array_keys($row),['id','full_name','account_type','city_ibge','bio','created_at','updated_at'])||!$uuid($row['id']??null)||!isset($identities[$row['id']])||isset($profiles[$row['id']]))throw new DomainException('Perfil duplicado ou sem identidade');
        $name=$row['full_name']??null;$role=$row['account_type']??null;$city=$row['city_ibge']??null;$bio=$row['bio']??'';
        if(!is_string($name)||mb_strlen(trim($name))<2||mb_strlen(trim($name))>120||!in_array($role,['cliente','prestador'],true)||!is_string($bio)||mb_strlen($bio)>1500||($city!==null&&(!is_string($city)||!preg_match('/^[0-9]{7}$/D',$city))))throw new DomainException('Perfil inválido');
        $profiles[$row['id']]=[trim($name),$role,$city,$bio,$date($row['created_at']??null),$date($row['updated_at']??null)];
    }
    if(count($profiles)!==count($identities))throw new DomainException('Identidades sem perfil');
    $db->beginTransaction();
    try{
        foreach($identities as $id=>[$email,$confirmed,$created])sqfQuery($db,'INSERT INTO sqf_auth_users(id,email,password_hash,email_confirmed_at,created_at) VALUES (?,?,NULL,?,COALESCE(?,UTC_TIMESTAMP(6)))',[$id,$email,$confirmed,$created]);
        $providers=0;
        foreach($profiles as $id=>[$name,$role,$city,$bio,$created,$updated]){
            $label='';
            if($city!==null){$m=sqfQuery($db,'SELECT name,uf FROM sqf_ibge_municipalities WHERE code=?',[$city])->fetch(PDO::FETCH_ASSOC);if(!$m)throw new DomainException('Município não encontrado');$label=$m['name'].' - '.$m['uf'];}
            sqfQuery($db,'INSERT INTO profiles(id,full_name,account_type,city,city_ibge,bio,is_public,created_at,updated_at) VALUES (?,?,?,?,?,?,0,COALESCE(?,UTC_TIMESTAMP(6)),COALESCE(?,UTC_TIMESTAMP(6)))',[$id,$name,$role,$label,$city,$bio,$created,$updated]);
            if($role==='prestador'){$providers++;sqfQuery($db,"INSERT INTO provider_verifications(provider_id,status) VALUES (?,'pending')",[$id]);}
        }
        $result=['identities'=>count($identities),'profiles'=>count($profiles),'providers_pending'=>$providers,'credentials_imported'=>0,'committed'=>false];
        $db->rollBack();return $result;
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
