<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';

/** Single worker per database; retry bounded. A successful transport followed by a
 * process crash can repeat delivery; not an exactly-once guarantee. */
function sqfDeliverNotifications(PDO $db,callable $send,int $limit=15):array {
    if($limit<1||$limit>100)throw new DomainException('Limite inválido');
    $lock='sqf-mail-'.substr(hash('sha256',(string)$db->query('SELECT DATABASE()')->fetchColumn()),0,40);
    if((int)sqfQuery($db,'SELECT GET_LOCK(?,0)',[$lock])->fetchColumn()!==1)return ['sent'=>0,'skipped'=>0,'retry'=>0,'busy'=>true];
    $counts=['sent'=>0,'skipped'=>0,'retry'=>0,'busy'=>false];
    try{
        $ids=sqfQuery($db,"SELECT notification_id FROM sqf_notification_outbox WHERE status='pending' AND next_attempt_at<=UTC_TIMESTAMP(6) ORDER BY created_at,notification_id LIMIT ".$limit)->fetchAll(PDO::FETCH_COLUMN);
        foreach($ids as $id){
            $result=sqfTxn($db,function()use($db,$id,$send){
                $row=sqfQuery($db,"SELECT o.attempts,o.recipient_id,u.email,u.email_confirmed_at,p.email_enabled,n.recipient_id AS note_recipient FROM sqf_notification_outbox o JOIN sqf_auth_users u ON u.id=o.recipient_id JOIN sqf_notifications n ON n.id=o.notification_id LEFT JOIN sqf_notification_preferences p ON p.user_id=o.recipient_id WHERE o.notification_id=? AND o.status='pending' AND o.next_attempt_at<=UTC_TIMESTAMP(6) FOR UPDATE",[$id])->fetch(PDO::FETCH_ASSOC);
                if(!$row)return null;
                if(!$row['email_confirmed_at']||!(int)$row['email_enabled']||$row['recipient_id']!==$row['note_recipient']||!filter_var($row['email'],FILTER_VALIDATE_EMAIL)){
                    sqfQuery($db,"UPDATE sqf_notification_outbox SET status='skipped',processed_at=UTC_TIMESTAMP(6) WHERE notification_id=?",[$id]);return 'skipped';
                }
                $attempt=(int)$row['attempts']+1;
                try{$ok=$send($row['email'],$id)===true;}catch(Throwable $e){$ok=false;}
                if($ok){sqfQuery($db,"UPDATE sqf_notification_outbox SET status='sent',attempts=?,processed_at=UTC_TIMESTAMP(6) WHERE notification_id=?",[$attempt,$id]);return 'sent';}
                $delay=min(3600,60*(2**min($attempt,6)));
                sqfQuery($db,"UPDATE sqf_notification_outbox SET status=?,attempts=?,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? SECOND),processed_at=CASE WHEN ?>=8 THEN UTC_TIMESTAMP(6) ELSE NULL END WHERE notification_id=?",[$attempt>=8?'failed':'pending',$attempt,$delay,$attempt,$id]);
                return 'retry';
            });
            if($result!==null)$counts[$result]++;
        }
        return $counts;
    }finally{sqfQuery($db,'SELECT RELEASE_LOCK(?)',[$lock]);}
}
function sqfNotificationMail(string $email,string $id):bool {
    $from=getenv('SQF_MAIL_FROM');$site=getenv('SQF_SITE_URL');
    if(!$from||!filter_var($from,FILTER_VALIDATE_EMAIL)||!$site||!filter_var($site,FILTER_VALIDATE_URL)||parse_url($site,PHP_URL_SCHEME)!=='https'||parse_url($site,PHP_URL_USER)!==null||parse_url($site,PHP_URL_PASS)!==null||parse_url($site,PHP_URL_QUERY)!==null||parse_url($site,PHP_URL_FRAGMENT)!==null)throw new RuntimeException('Configuração de e-mail indisponível');
    // No request description, documents, payment details or private messages in email.
    return mail($email,'Nova atualização — Será Quem Faz?',"Você possui uma atualização na plataforma.\n\nAcesse sua conta: ".rtrim($site,'/')."/painel.html\n\nNão compartilhe senhas ou códigos por e-mail.",['From'=>$from,'Content-Type'=>'text/plain; charset=UTF-8']);
}
