<?php
declare(strict_types=1);
require_once __DIR__.'/Moderation.php';
function sqfVerificationStatus(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
    $row=sqfQuery($db,'SELECT status,requested_at,reviewed_at FROM provider_verifications WHERE provider_id=?',[$actor])->fetch(PDO::FETCH_ASSOC)
        ?:['status'=>'pending','requested_at'=>null,'reviewed_at'=>null];
    $profile=sqfQuery($db,'SELECT city_ibge,is_public FROM profiles WHERE id=?',[$actor])->fetch(PDO::FETCH_ASSOC);
    $row['email_confirmed']=(bool)sqfQuery($db,'SELECT email_confirmed_at IS NOT NULL FROM sqf_auth_users WHERE id=?',[$actor])->fetchColumn();
    $row['city_selected']=is_array($profile)&&preg_match('/^[0-9]{7}$/D',(string)($profile['city_ibge']??''))===1;
    $row['services_active']=(int)sqfQuery($db,'SELECT COUNT(*) FROM provider_services WHERE provider_id=? AND is_active=1',[$actor])->fetchColumn();
    $row['identity_document_accepted']=(bool)sqfQuery($db,"SELECT 1 FROM sqf_verification_documents WHERE provider_id=? AND document_kind='identity_evidence' AND status='accepted' LIMIT 1",[$actor])->fetchColumn();
    $row['publication_enabled']=(bool)($profile['is_public']??false);
    $row['catalog_visible']=$row['city_selected']&&$row['services_active']>0&&sqfProviderPublic($db,$actor);
    $row['paid_subscription_required']=(bool)sqfQuery($db,'SELECT require_paid_subscription FROM sqf_billing_settings WHERE singleton=1')->fetchColumn();
    return $row;
}
function sqfStaffProviders(PDO $db,string $actor):array {
    sqfRequireStaff($db,$actor);
    return sqfQuery($db,"SELECT p.id,p.full_name,p.city,p.is_public,v.status,v.requested_at,(SELECT COUNT(*) FROM sqf_verification_documents d WHERE d.provider_id=p.id AND d.document_kind='identity_evidence' AND d.status='accepted') AS accepted_identity,(SELECT COUNT(*) FROM provider_services s WHERE s.provider_id=p.id AND s.is_active=1) AS active_services,(SELECT au.email_confirmed_at IS NOT NULL FROM sqf_auth_users au WHERE au.id=p.id) AS email_confirmed,p.city_ibge FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.account_type='prestador' ORDER BY v.requested_at DESC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
}
function sqfStaffProviderDecide(PDO $db,string $actor,string $id,string $state,string $note):void {
    $note=trim($note);
    if(!in_array($state,['approved','rejected','suspended'],true)||mb_strlen($note)<20||mb_strlen($note)>1000||$actor===$id)throw new DomainException('Decisão inválida');
    sqfTxn($db,function()use($db,$actor,$id,$state,$note){
        sqfRequireStaff($db,$actor,true);
        $profile=sqfQuery($db,'SELECT account_type FROM profiles WHERE id=? FOR UPDATE',[$id])->fetchColumn();
        if($profile!=='prestador')throw new DomainException('Prestador indisponível');
        $old=sqfQuery($db,'SELECT status FROM provider_verifications WHERE provider_id=? FOR UPDATE',[$id])->fetchColumn();
        if(!$old||$old===$state)throw new DomainException('Decisão indisponível');
        if($state==='approved'&&!sqfQuery($db,"SELECT 1 FROM sqf_verification_documents WHERE provider_id=? AND document_kind='identity_evidence' AND status='accepted' LIMIT 1",[$id])->fetchColumn())throw new DomainException('Documento de identidade aceito obrigatório');
        sqfQuery($db,'UPDATE provider_verifications SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(6),internal_note=? WHERE provider_id=?',[$state,$actor,$note,$id]);
        sqfQuery($db,'UPDATE profiles SET is_public=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',[$state==='approved'?1:0,$id]);
        sqfQuery($db,"INSERT INTO sqf_staff_decision_log(actor_id,entity_type,entity_id,previous_status,new_status,decision_note) VALUES (?,'provider_verification',?,?,?,?)",[$actor,$id,$old,$state,$note]);
    });
}
function sqfOwnCases(PDO $db,string $actor):array {
    return ['privacy'=>sqfQuery($db,'SELECT id,request_type,details,status,created_at FROM privacy_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 50',[$actor])->fetchAll(PDO::FETCH_ASSOC),'support'=>sqfQuery($db,'SELECT id,topic,message,status,created_at FROM sqf_support_tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 50',[$actor])->fetchAll(PDO::FETCH_ASSOC)];
}
function sqfCreateCase(PDO $db,string $actor,string $kind,string $type,string $message):string {
    $message=trim($message);
    if($kind==='privacy'){
        if(!in_array($type,['access','correction','deletion','portability'],true)||mb_strlen($message)>500)throw new DomainException('Solicitação inválida');
        $table='privacy_requests';$column='request_type';$field='details';$closed='resolved';
    }elseif($kind==='support'){
        if(!in_array($type,['account','budget','appointment','review','technical','other'],true)||mb_strlen($message)<15||mb_strlen($message)>2000)throw new DomainException('Solicitação inválida');
        $table='sqf_support_tickets';$column='topic';$field='message';$closed='resolved';
    }else throw new DomainException('Tipo inválido');
    return sqfTxn($db,function()use($db,$actor,$type,$message,$table,$column,$field,$closed){
        if(!sqfQuery($db,'SELECT id FROM profiles WHERE id=? FOR UPDATE',[$actor])->fetchColumn())throw new DomainException('Conta indisponível');
        if((int)sqfQuery($db,"SELECT COUNT(*) FROM $table WHERE user_id=? AND status<>?",[$actor,$closed])->fetchColumn()>=5)throw new DomainException('Limite de solicitações abertas');
        $id=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,"INSERT INTO $table(id,user_id,$column,$field) VALUES (?,?,?,?)",[$id,$actor,$type,$message]);
        return $id;
    });
}
function sqfStaffCases(PDO $db,string $actor):array {
    if(sqfRequireStaff($db,$actor)!=='admin')throw new DomainException('Somente administradores');
    return ['privacy'=>sqfQuery($db,"SELECT id,user_id,request_type,details,status FROM privacy_requests WHERE status<>'resolved' ORDER BY created_at LIMIT 100")->fetchAll(PDO::FETCH_ASSOC),'support'=>sqfQuery($db,"SELECT id,user_id,topic,message,status FROM sqf_support_tickets WHERE status<>'resolved' ORDER BY created_at LIMIT 100")->fetchAll(PDO::FETCH_ASSOC)];
}
function sqfStaffCaseDecide(PDO $db,string $actor,string $kind,string $id,string $state,string $note):void {
    $note=trim($note);
    if(!in_array($kind,['privacy','support'],true)||!in_array($state,['reviewing','resolved'],true)||mb_strlen($note)<20||mb_strlen($note)>1000)throw new DomainException('Decisão inválida');
    $table=$kind==='privacy'?'privacy_requests':'sqf_support_tickets';
    sqfTxn($db,function()use($db,$actor,$kind,$id,$state,$note,$table){
        if(sqfRequireStaff($db,$actor,true)!=='admin')throw new DomainException('Somente administradores');
        $r=sqfQuery($db,"SELECT user_id,status FROM $table WHERE id=? FOR UPDATE",[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$r||$r['user_id']===$actor||$r['status']==='resolved'||$r['status']===$state)throw new DomainException('Solicitação indisponível');
        sqfQuery($db,"UPDATE $table SET status=?".($kind==='support'?',updated_at=UTC_TIMESTAMP(6)':'').' WHERE id=?',[$state,$id]);
        sqfQuery($db,'INSERT INTO sqf_staff_decision_log(actor_id,entity_type,entity_id,previous_status,new_status,decision_note) VALUES (?,?,?,?,?,?)',[$actor,$kind,$id,$r['status'],$state,$note]);
    });
}
