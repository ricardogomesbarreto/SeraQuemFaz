<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';

function sqfEmail(string $email): string {
    $email=strtolower(trim($email));
    if(strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL)) throw new DomainException('E-mail inválido');
    return $email;
}
function sqfPassword(string $password): string {
    if(strlen($password)<12 || strlen($password)>72) throw new DomainException('Senha deve ter de 12 a 72 bytes');
    return password_hash($password, PASSWORD_ARGON2ID);
}
// Fixed-window limits in DB, independent of browser sessions. Do not trust forwarded IP headers.
function sqfAuthLimit(PDO $db,string $key,int $max,int $seconds):void {
    $bucket=hash('sha256',$key);
    $db->beginTransaction();
    try {
        sqfQuery($db,'INSERT INTO sqf_auth_limits(bucket,attempts,expires_at) VALUES (?,0,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE bucket=bucket',[$bucket]);
        $row=sqfQuery($db,'SELECT attempts,expires_at<=UTC_TIMESTAMP(6) AS expired FROM sqf_auth_limits WHERE bucket=? FOR UPDATE',[$bucket])->fetch(PDO::FETCH_ASSOC);
        $n=(int)$row['expired']===1?1:(int)$row['attempts']+1;
        if((int)$row['expired']===1) sqfQuery($db,'UPDATE sqf_auth_limits SET attempts=?,expires_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? SECOND) WHERE bucket=?',[$n,$seconds,$bucket]);
        else sqfQuery($db,'UPDATE sqf_auth_limits SET attempts=? WHERE bucket=?',[$n,$bucket]);
        $db->commit();
        if($n>$max)throw new DomainException('Muitas tentativas. Tente novamente mais tarde.');
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function sqfIssueToken(PDO $db,string $id,string $purpose):string {
    if(!in_array($purpose,['verify','reset'],true))throw new DomainException('Finalidade inválida');
    $token=bin2hex(random_bytes(32));
    sqfQuery($db,'DELETE FROM sqf_auth_tokens WHERE user_id=? AND purpose=?',[$id,$purpose]);
    sqfQuery($db,'INSERT INTO sqf_auth_tokens(token_hash,user_id,purpose,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 30 MINUTE))',[hash('sha256',$token),$id,$purpose]);
    return $token;
}
// Raw tokens are returned only to trusted mail-delivery code, never HTTP callers.
function sqfRegister(PDO $db,string $email,string $password,string $name,string $type):array {
    $email=sqfEmail($email);$hash=sqfPassword($password);$name=trim($name);
    if(mb_strlen($name)<2||mb_strlen($name)>120||!in_array($type,['cliente','prestador'],true))throw new DomainException('Perfil inválido');
    return sqfTxn($db,function()use($db,$email,$hash,$name,$type){
        $id=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,'INSERT INTO sqf_auth_users(id,email,password_hash) VALUES (?,?,?)',[$id,$email,$hash]);
        sqfQuery($db,'INSERT INTO profiles(id,full_name,account_type) VALUES (?,?,?)',[$id,$name,$type]);
        return ['id'=>$id,'token'=>sqfIssueToken($db,$id,'verify')];
    });
}
function sqfRequestAuthToken(PDO $db,string $email,string $purpose):?string {
    $email=sqfEmail($email);
    return sqfTxn($db,function()use($db,$email,$purpose){
        $u=sqfQuery($db,'SELECT id,email_confirmed_at FROM sqf_auth_users WHERE email=? FOR UPDATE',[$email])->fetch(PDO::FETCH_ASSOC);
        if(!$u||($purpose==='verify'&&$u['email_confirmed_at']!==null))return null;
        return sqfIssueToken($db,$u['id'],$purpose);
    });
}
function sqfConsumeToken(PDO $db,string $token,string $purpose,?string $password=null):void {
    if(!preg_match('/^[0-9a-f]{64}$/D',$token))throw new DomainException('Código inválido ou expirado');
    $hash=$purpose==='reset'?sqfPassword($password??''):null;
    sqfTxn($db,function()use($db,$token,$purpose,$hash){
        $digest=hash('sha256',$token);
        $t=sqfQuery($db,'SELECT user_id FROM sqf_auth_tokens WHERE token_hash=? AND purpose=? AND expires_at>UTC_TIMESTAMP(6)',[$digest,$purpose])->fetch(PDO::FETCH_ASSOC);
        if(!$t)throw new DomainException('Código inválido ou expirado');
        // Lock identity first, as token issuing does; recheck token under lock.
        sqfQuery($db,'SELECT id FROM sqf_auth_users WHERE id=? FOR UPDATE',[$t['user_id']])->fetchColumn();
        if(!sqfQuery($db,'SELECT token_hash FROM sqf_auth_tokens WHERE token_hash=? AND purpose=? AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',[$digest,$purpose])->fetchColumn())throw new DomainException('Código inválido ou expirado');
        if($purpose==='verify')sqfQuery($db,'UPDATE sqf_auth_users SET email_confirmed_at=COALESCE(email_confirmed_at,UTC_TIMESTAMP(6)) WHERE id=?',[$t['user_id']]);
        elseif($purpose==='reset')sqfQuery($db,'UPDATE sqf_auth_users SET password_hash=?,auth_version=auth_version+1 WHERE id=?',[$hash,$t['user_id']]);
        else throw new DomainException('Finalidade inválida');
        sqfQuery($db,'DELETE FROM sqf_auth_tokens WHERE user_id=? AND purpose=?',[$t['user_id'],$purpose]);
    });
}
function sqfLogin(PDO $db,string $email,string $password):array {
    $email=sqfEmail($email);
    $u=sqfQuery($db,'SELECT id,password_hash,email_confirmed_at,auth_version FROM sqf_auth_users WHERE email=?',[$email])->fetch(PDO::FETCH_ASSOC);
    // Dummy hash avoids immediately distinguishing missing accounts from bad passwords.
    $dummy='$2y$12$Hia2LiVq8pnlPb.0I.JcLOjZ0VvPZ4rgWHqk5FD7hmYRkz4bUHqVe';
    $valid=password_verify($password,$u['password_hash']??$dummy);
    if(!$u||!$valid||!$u['email_confirmed_at'])throw new DomainException('Credenciais inválidas ou e-mail não confirmado');
    return ['id'=>$u['id'],'auth_version'=>(int)$u['auth_version']];
}
function sqfSessionUser(PDO $db,array $session):?string {
    if(!isset($session['id'],$session['auth_version']))return null;
    $u=sqfQuery($db,'SELECT id,auth_version,email_confirmed_at FROM sqf_auth_users WHERE id=?',[$session['id']])->fetch(PDO::FETCH_ASSOC);
    return $u&&$u['email_confirmed_at']&&(int)$u['auth_version']===(int)$session['auth_version']?$u['id']:null;
}
