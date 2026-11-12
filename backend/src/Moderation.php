<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';
require_once __DIR__.'/Auth.php';

function sqfStaffRole(PDO $db,string $actor,bool $lock=false):?string {
    $role=sqfQuery($db,'SELECT role FROM sqf_admin_members WHERE user_id=? AND active=1'.($lock?' FOR UPDATE':''),[$actor])->fetchColumn();
    return in_array($role,['admin','moderator'],true)?$role:null;
}
function sqfRequireStaff(PDO $db,string $actor,bool $lock=false):string {
    return sqfStaffRole($db,$actor,$lock)??throw new DomainException('Acesso administrativo negado');
}
// RFC 6238 SHA-1, six digits. Provision independent per-user 20-byte secrets
// in a protected server environment; the browser never receives the secret.
function sqfTotp(string $secret,int $counter):string {
    $mac=hash_hmac('sha1',pack('N2',intdiv($counter,4294967296),$counter%4294967296),$secret,true);
    $offset=ord($mac[19])&15;
    $n=unpack('N',substr($mac,$offset,4))[1]&0x7fffffff;
    return str_pad((string)($n%1000000),6,'0',STR_PAD_LEFT);
}
function sqfStaffMfa(PDO $db,string $actor,string $code,string $secretHex,int $now):void {
    if(!preg_match('/^[0-9]{6}$/D',$code)||!preg_match('/^[a-f0-9]{40,128}$/iD',$secretHex)||strlen($secretHex)%2)throw new DomainException('MFA inválido ou indisponível');
    $secret=hex2bin($secretHex);$current=intdiv($now,30);$matched=null;
    foreach([$current-1,$current,$current+1] as $counter)if($counter>=0&&hash_equals(sqfTotp($secret,$counter),$code))$matched=$counter;
    if($matched===null)throw new DomainException('Código MFA inválido');
    sqfTxn($db,function()use($db,$actor,$matched){
        sqfRequireStaff($db,$actor,true);
        sqfQuery($db,'INSERT INTO sqf_staff_mfa_state(user_id,last_counter) VALUES (?,-1) ON DUPLICATE KEY UPDATE user_id=user_id',[$actor]);
        $last=(int)sqfQuery($db,'SELECT last_counter FROM sqf_staff_mfa_state WHERE user_id=? FOR UPDATE',[$actor])->fetchColumn();
        if($matched<=$last)throw new DomainException('Código MFA já utilizado');
        sqfQuery($db,'UPDATE sqf_staff_mfa_state SET last_counter=? WHERE user_id=?',[$matched,$actor]);
    });
}
function sqfReviewCreate(PDO $db,string $actor,string $request,int $rating,string $comment):string {
    $comment=trim($comment);
    if($rating<1||$rating>5||mb_strlen($comment)<15||mb_strlen($comment)>1500)throw new DomainException('Avaliação inválida');
    return sqfTxn($db,function()use($db,$actor,$request,$rating,$comment){
        $r=sqfRequestRow($db,$actor,$request);
        if($r['client_id']!==$actor||$r['status']!=='completed'||!$r['engagement_id'])throw new DomainException('Somente cliente de atendimento concluído pode avaliar');
        $e=sqfQuery($db,"SELECT id FROM service_engagements WHERE id=? AND client_id=? AND provider_id=? AND status='confirmed' AND (source_request_id IS NULL OR source_request_id=?) FOR UPDATE",[$r['engagement_id'],$actor,$r['provider_id'],$request])->fetchColumn();
        if(!$e||sqfQuery($db,'SELECT 1 FROM reviews WHERE engagement_id=?',[$e])->fetchColumn())throw new DomainException('Avaliação indisponível ou já registrada');
        $id=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,"INSERT INTO reviews(id,provider_id,reviewer_id,engagement_id,rating,comment,moderation_status) VALUES (?,?,?,?,?,?,'pending')",[$id,$r['provider_id'],$actor,$e,$rating,$comment]);
        return $id;
    });
}
function sqfOwnReviews(PDO $db,string $actor):array {
    return sqfQuery($db,'SELECT id,provider_id,reviewer_id,engagement_id,rating,comment,moderation_status,created_at FROM reviews WHERE reviewer_id=? OR provider_id=? ORDER BY created_at DESC LIMIT 100',[$actor,$actor])->fetchAll(PDO::FETCH_ASSOC);
}
function sqfPublicReviews(PDO $db,string $provider):array {
    if(!sqfProviderPublic($db,$provider))return [];
    return sqfQuery($db,"SELECT r.id,r.rating,r.comment,r.created_at,s.message AS response FROM reviews r LEFT JOIN sqf_review_responses s ON s.review_id=r.id AND s.moderation_status='published' WHERE r.provider_id=? AND r.moderation_status='published' ORDER BY r.created_at DESC LIMIT 100",[$provider])->fetchAll(PDO::FETCH_ASSOC);
}
function sqfStaffQueue(PDO $db,string $actor):array {
    sqfRequireStaff($db,$actor);
    return sqfQuery($db,"SELECT id,provider_id,rating,comment,moderation_status,created_at FROM reviews WHERE moderation_status='pending' ORDER BY created_at LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
}
function sqfReviewModerate(PDO $db,string $actor,string $id,string $state,string $note):void {
    $note=trim($note);
    if(!in_array($state,['published','rejected','hidden'],true)||mb_strlen($note)<20||mb_strlen($note)>1000)throw new DomainException('Decisão inválida');
    sqfTxn($db,function()use($db,$actor,$id,$state,$note){
        sqfRequireStaff($db,$actor,true);
        $r=sqfQuery($db,'SELECT moderation_status,provider_id,reviewer_id FROM reviews WHERE id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$r||$actor===$r['provider_id']||$actor===$r['reviewer_id']||$r['moderation_status']===$state)throw new DomainException('Decisão indisponível');
        sqfQuery($db,'UPDATE reviews SET moderation_status=?,moderated_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=?',[$state,$id]);
        sqfQuery($db,"INSERT INTO sqf_staff_decision_log(actor_id,entity_type,entity_id,previous_status,new_status,decision_note) VALUES (?,'review',?,?,?,?)",[$actor,$id,$r['moderation_status'],$state,$note]);
    });
}

function sqfReviewResponse(PDO $db,string $actor,string $id,string $message):void {
    $message=trim($message);
    if(mb_strlen($message)<20||mb_strlen($message)>600)throw new DomainException('Resposta inválida');
    sqfTxn($db,function()use($db,$actor,$id,$message){
        $r=sqfQuery($db,"SELECT provider_id,moderation_status FROM reviews WHERE id=? FOR UPDATE",[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$r||$r['provider_id']!==$actor||$r['moderation_status']!=='published')throw new DomainException('Avaliação indisponível');
        sqfQuery($db,"INSERT INTO sqf_review_responses(review_id,provider_id,message,moderation_status) VALUES (?,?,?,'pending') ON DUPLICATE KEY UPDATE message=VALUES(message),moderation_status='pending',moderated_at=NULL",[$id,$actor,$message]);
    });
}
function sqfReviewDispute(PDO $db,string $actor,string $id,string $reason,string $details):string {
    $details=trim($details);
    if(!in_array($reason,['false_service','inaccurate','harassment','personal_data','other'],true)||mb_strlen($details)<30||mb_strlen($details)>1200)throw new DomainException('Contestação inválida');
    return sqfTxn($db,function()use($db,$actor,$id,$reason,$details){
        $r=sqfQuery($db,'SELECT provider_id,moderation_status FROM reviews WHERE id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$r||$r['provider_id']!==$actor||$r['moderation_status']!=='published')throw new DomainException('Avaliação indisponível');
        if(sqfQuery($db,'SELECT 1 FROM sqf_review_disputes WHERE review_id=? AND provider_id=?',[$id,$actor])->fetchColumn())throw new DomainException('Contestação já registrada');
        $d=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,'INSERT INTO sqf_review_disputes(id,review_id,provider_id,reason,details) VALUES (?,?,?,?,?)',[$d,$id,$actor,$reason,$details]);return $d;
    });
}
function sqfOwnReviewCases(PDO $db,string $actor):array {
    return ['responses'=>sqfQuery($db,'SELECT review_id,message,moderation_status,created_at FROM sqf_review_responses WHERE provider_id=? ORDER BY created_at DESC LIMIT 100',[$actor])->fetchAll(PDO::FETCH_ASSOC),
    'disputes'=>sqfQuery($db,'SELECT id,review_id,reason,details,status,created_at FROM sqf_review_disputes WHERE provider_id=? ORDER BY created_at DESC LIMIT 100',[$actor])->fetchAll(PDO::FETCH_ASSOC)];
}
function sqfStaffReviewCases(PDO $db,string $actor):array {
    sqfRequireStaff($db,$actor);
    return ['responses'=>sqfQuery($db,"SELECT review_id,provider_id,message,moderation_status FROM sqf_review_responses WHERE moderation_status='pending' LIMIT 100")->fetchAll(PDO::FETCH_ASSOC),
    'disputes'=>sqfQuery($db,"SELECT id,review_id,provider_id,reason,details,status FROM sqf_review_disputes WHERE status IN ('pending','reviewing') LIMIT 100")->fetchAll(PDO::FETCH_ASSOC)];
}
function sqfStaffReviewCaseDecide(PDO $db,string $actor,string $type,string $id,string $state,string $note):void {
    $note=trim($note);
    if(mb_strlen($note)<20||mb_strlen($note)>1000)throw new DomainException('Justificativa inválida');
    if($type==='response'){
        if(!in_array($state,['published','rejected','hidden'],true))throw new DomainException('Decisão inválida');
        $table='sqf_review_responses';$key='review_id';$status='moderation_status';$date='moderated_at';
    }elseif($type==='dispute'){
        if(!in_array($state,['reviewing','upheld','dismissed'],true))throw new DomainException('Decisão inválida');
        $table='sqf_review_disputes';$key='id';$status='status';$date='decided_at';
    }else throw new DomainException('Tipo inválido');
    sqfTxn($db,function()use($db,$actor,$type,$id,$state,$note,$table,$key,$status,$date){
        sqfRequireStaff($db,$actor,true);
        // SQL identifiers are selected solely from the two constant branches above.
        $r=sqfQuery($db,"SELECT provider_id,review_id,$status AS previous FROM $table WHERE $key=? FOR UPDATE",[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$r||$r['provider_id']===$actor||$r['previous']===$state)throw new DomainException('Decisão indisponível');
        $review=sqfQuery($db,'SELECT reviewer_id FROM reviews WHERE id=?',[$r['review_id']])->fetchColumn();
        if(!$review||$review===$actor)throw new DomainException('Conflito de interesse');
        if($type==='dispute'&&!in_array($r['previous'],['pending','reviewing'],true))throw new DomainException('Contestação encerrada');
        sqfQuery($db,"UPDATE $table SET $status=?,$date=UTC_TIMESTAMP(6) WHERE $key=?",[$state,$id]);
        sqfQuery($db,"INSERT INTO sqf_staff_decision_log(actor_id,entity_type,entity_id,previous_status,new_status,decision_note) VALUES (?,?,?,?,?,?)",[$actor,'review_'.$type,$id,$r['previous'],$state,$note]);
        // Upheld disputes hide the contested review, but never delete it.
        if($type==='dispute'&&$state==='upheld'){
            $old=sqfQuery($db,'SELECT moderation_status FROM reviews WHERE id=? FOR UPDATE',[$r['review_id']])->fetchColumn();
            if($old!=='hidden'){
                sqfQuery($db,"UPDATE reviews SET moderation_status='hidden',moderated_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=?",[$r['review_id']]);
                sqfQuery($db,"INSERT INTO sqf_staff_decision_log(actor_id,entity_type,entity_id,previous_status,new_status,decision_note) VALUES (?,'review',?,?,'hidden',?)",[$actor,$r['review_id'],$old,$note]);
            }
        }
    });
}

function sqfStaffDocuments(PDO $db,string $actor):array {
    sqfRequireStaff($db,$actor);
    return sqfQuery($db,"SELECT id,provider_id,document_kind,status,created_at FROM sqf_verification_documents WHERE status='pending' ORDER BY created_at ASC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
}
function sqfStaffDocumentDecide(PDO $db,string $actor,string $id,string $state,string $note):void {
    $note=trim($note);
    if(!in_array($state,['accepted','rejected'],true)||mb_strlen($note)<20||mb_strlen($note)>1000)throw new DomainException('Decisão documental inválida');
    sqfTxn($db,function()use($db,$actor,$id,$state,$note){
        sqfRequireStaff($db,$actor,true);
        $row=sqfQuery($db,'SELECT provider_id,status FROM sqf_verification_documents WHERE id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$row||$row['provider_id']===$actor||$row['status']!=='pending')throw new DomainException('Documento indisponível ou já analisado');
        sqfQuery($db,'UPDATE sqf_verification_documents SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(6),review_note=? WHERE id=?',[$state,$actor,$note,$id]);
        sqfQuery($db,"INSERT INTO sqf_staff_decision_log(actor_id,entity_type,entity_id,previous_status,new_status,decision_note) VALUES (?,'verification_document',?,?,?,?)",[$actor,$id,$row['status'],$state,$note]);
        // Document decision does NOT change provider_verifications.status.
    });
}
