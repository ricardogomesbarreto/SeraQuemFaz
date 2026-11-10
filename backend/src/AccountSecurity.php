<?php
declare(strict_types=1);
require_once __DIR__.'/Auth.php';

function sqfAccountSecurity(PDO $db,string $actor):array {
    $row=sqfQuery($db,'SELECT email,email_confirmed_at FROM sqf_auth_users WHERE id=?',[$actor])->fetch(PDO::FETCH_ASSOC);
    if(!$row)throw new DomainException('Conta indisponível');
    $row['email_enabled']=(bool)sqfQuery($db,'SELECT email_enabled FROM sqf_notification_preferences WHERE user_id=?',[$actor])->fetchColumn();
    return $row;
}
function sqfChangePassword(PDO $db,string $actor,string $current,string $replacement):void {
    if($current===$replacement)throw new DomainException('Escolha uma senha diferente');
    $hash=sqfPassword($replacement);
    sqfTxn($db,function()use($db,$actor,$current,$hash){
        $row=sqfQuery($db,'SELECT password_hash FROM sqf_auth_users WHERE id=? FOR UPDATE',[$actor])->fetch(PDO::FETCH_ASSOC);
        if(!$row||!password_verify($current,$row['password_hash']??''))throw new DomainException('Senha atual inválida');
        sqfQuery($db,'UPDATE sqf_auth_users SET password_hash=?,auth_version=auth_version+1 WHERE id=?',[$hash,$actor]);
        sqfQuery($db,'DELETE FROM sqf_auth_tokens WHERE user_id=? AND purpose=?',[$actor,'reset']);
    });
}
function sqfRevokeSessions(PDO $db,string $actor,string $current):void {
    sqfTxn($db,function()use($db,$actor,$current){
        $row=sqfQuery($db,'SELECT password_hash FROM sqf_auth_users WHERE id=? FOR UPDATE',[$actor])->fetch(PDO::FETCH_ASSOC);
        if(!$row||!password_verify($current,$row['password_hash']??''))throw new DomainException('Senha atual inválida');
        sqfQuery($db,'UPDATE sqf_auth_users SET auth_version=auth_version+1 WHERE id=?',[$actor]);
    });
}
function sqfNotificationPreference(PDO $db,string $actor,bool $enabled):void {
    sqfQuery($db,'INSERT INTO sqf_notification_preferences(user_id,email_enabled) VALUES (?,?) ON DUPLICATE KEY UPDATE email_enabled=VALUES(email_enabled),updated_at=UTC_TIMESTAMP(6)',[$actor,$enabled?1:0]);
}
function sqfReadNotification(PDO $db,string $actor,string $id):void {
    if(!preg_match('/^[a-f0-9-]{36}$/iD',$id))throw new DomainException('Notificação inválida');
    if(!sqfQuery($db,'SELECT 1 FROM sqf_notifications WHERE id=? AND recipient_id=?',[$id,$actor])->fetchColumn())throw new DomainException('Notificação indisponível');
    sqfQuery($db,'UPDATE sqf_notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(6)) WHERE id=? AND recipient_id=?',[$id,$actor]);
}
