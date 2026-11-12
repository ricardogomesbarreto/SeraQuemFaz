<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Notifications.php';
require __DIR__.'/../../backend/src/AccountSecurity.php';
$db=sqfDatabase();
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);echo "PASS: $m\n";}
$actor='00000000-0000-4000-8000-000000000001';
$other='00000000-0000-4000-8000-000000000003';
$request='00000000-0000-4000-8000-000000000011';
sqfQuery($db,'UPDATE sqf_auth_users SET email_confirmed_at=UTC_TIMESTAMP(6) WHERE id=?',[$actor]);
$sendCount=0;$send=function(string $email,string $id)use(&$sendCount):bool{$sendCount++;check($email==='fixture0@example.invalid','delivery addressed to confirmed owner');return true;};
$create=function()use($db,$actor,$request):string{
    sqfTxn($db,fn()=>sqfNotify($db,$actor,'test_notice','Aviso de teste','Conteúdo privado da fixture',$request));
    return (string)sqfQuery($db,"SELECT id FROM sqf_notifications WHERE recipient_id=? AND kind='test_notice' ORDER BY created_at DESC,id DESC LIMIT 1",[$actor])->fetchColumn();
};
sqfNotificationPreference($db,$actor,false);$disabled=$create();
check(!sqfQuery($db,'SELECT 1 FROM sqf_notification_outbox WHERE notification_id=?',[$disabled])->fetchColumn(),'opt-out does not enqueue');
sqfNotificationPreference($db,$actor,true);$id=$create();
check(sqfDeliverNotifications($db,$send)['sent']===1,'opt-in queued message sent');
check(sqfDeliverNotifications($db,$send)['sent']===0&&$sendCount===1,'sent notification not delivered again');
$skip=$create();sqfNotificationPreference($db,$actor,false);
check(sqfDeliverNotifications($db,$send)['skipped']===1&&$sendCount===1,'opt-out before delivery respected');
sqfNotificationPreference($db,$actor,true);$retry=$create();
check(sqfDeliverNotifications($db,fn()=>false)['retry']===1,'failed transport scheduled retry');
check(sqfDeliverNotifications($db,$send)['sent']===0,'retry backoff respected');
sqfQuery($db,'UPDATE sqf_notification_outbox SET next_attempt_at=UTC_TIMESTAMP(6),attempts=7 WHERE notification_id=?',[$retry]);
sqfDeliverNotifications($db,fn()=>false);
check(sqfQuery($db,'SELECT status FROM sqf_notification_outbox WHERE notification_id=?',[$retry])->fetchColumn()==='failed','bounded attempts terminate');
try{sqfReadNotification($db,$other,$id);throw new RuntimeException('foreign notification marked read');}catch(DomainException $e){check(true,'foreign notification denied');}
sqfReadNotification($db,$actor,$id);
check((bool)sqfQuery($db,'SELECT read_at FROM sqf_notifications WHERE id=?',[$id])->fetchColumn(),'owner notification marked read');
sqfNotificationPreference($db,$actor,false);
sqfQuery($db,"DELETE FROM sqf_notification_outbox WHERE notification_id IN (SELECT id FROM sqf_notifications WHERE kind='test_notice')");
sqfQuery($db,"DELETE FROM sqf_notifications WHERE kind='test_notice'");
