<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';

/** Restricted self-service export, not a complete statutory access response.
 * No secrets, other people's messages, document binaries or staff notes. */
function sqfOwnPrivacyExport(PDO $db,string $actor):array {
    $identity=sqfQuery($db,'SELECT id,email,email_confirmed_at,created_at FROM sqf_auth_users WHERE id=?',[$actor])->fetch(PDO::FETCH_ASSOC);
    if(!$identity)throw new DomainException('Conta indisponível');
    $profile=sqfQuery($db,'SELECT id,full_name,account_type,city,city_ibge,bio,created_at,updated_at FROM profiles WHERE id=?',[$actor])->fetch(PDO::FETCH_ASSOC);
    $preferences=sqfQuery($db,'SELECT email_enabled FROM sqf_notification_preferences WHERE user_id=?',[$actor])->fetch(PDO::FETCH_ASSOC);
    $cases=sqfQuery($db,'SELECT id,request_type,details,status,created_at FROM privacy_requests WHERE user_id=? ORDER BY created_at,id LIMIT 500',[$actor])->fetchAll(PDO::FETCH_ASSOC);
    $tickets=sqfQuery($db,'SELECT id,topic,message,status,created_at FROM sqf_support_tickets WHERE user_id=? ORDER BY created_at,id LIMIT 500',[$actor])->fetchAll(PDO::FETCH_ASSOC);
    return ['generated_at'=>gmdate('c'),'scope'=>'self_service_summary','identity'=>$identity,'profile'=>$profile,'preferences'=>$preferences?:null,'privacy_requests'=>$cases,'support_tickets'=>$tickets,'limits'=>['cases_each'=>500,'complete_request'=>'Solicite acesso completo pelo atendimento de privacidade.']];
}
