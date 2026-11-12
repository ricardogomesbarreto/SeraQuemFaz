<?php
declare(strict_types=1);
require_once __DIR__.'/Moderation.php';

/**
 * Read-only, aggregated regional catalog diagnostics for an MFA-authenticated admin.
 * No user emails, private documents, names or secrets are returned.
 */
function sqfStaffCatalogDiagnostics(PDO $db,string $actor,string $municipality):array {
    if(sqfRequireStaff($db,$actor)!=='admin')throw new DomainException('Somente administradores');
    if(!preg_match('/^[0-9]{7}$/D',$municipality))throw new DomainException('Município inválido');
    $city=sqfQuery($db,'SELECT code,name,uf FROM sqf_ibge_municipalities WHERE code=?',[$municipality])->fetch(PDO::FETCH_ASSOC);
    if(!$city)throw new DomainException('Município não cadastrado');
    $metrics=sqfQuery($db,"SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN a.email_confirmed_at IS NOT NULL THEN 1 ELSE 0 END),0) AS email_confirmed,
      COALESCE(SUM(CASE WHEN v.status='pending' THEN 1 ELSE 0 END),0) AS verification_pending,
      COALESCE(SUM(CASE WHEN v.status='approved' THEN 1 ELSE 0 END),0) AS approved,
      COALESCE(SUM(CASE WHEN v.status='approved' AND p.is_public=1 THEN 1 ELSE 0 END),0) AS approved_public,
      COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM provider_services s WHERE s.provider_id=p.id AND s.is_active=1) THEN 1 ELSE 0 END),0) AS with_active_service
      FROM profiles p
      LEFT JOIN sqf_auth_users a ON a.id=p.id
      LEFT JOIN provider_verifications v ON v.provider_id=p.id
      WHERE p.account_type='prestador' AND p.city_ibge=?",[$municipality])->fetch(PDO::FETCH_ASSOC);
    $visible=(int)sqfQuery($db,'SELECT COUNT(*) FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.city_ibge=? AND '.sqfPublicPredicate().' AND EXISTS(SELECT 1 FROM provider_services s WHERE s.provider_id=p.id AND s.is_active=1)',[$municipality])->fetchColumn();
    $categoryCount=(int)sqfQuery($db,'SELECT COUNT(DISTINCT s.category_id) FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id JOIN provider_services s ON s.provider_id=p.id AND s.is_active=1 WHERE p.city_ibge=? AND '.sqfPublicPredicate(),[$municipality])->fetchColumn();
    $billing=sqfQuery($db,'SELECT require_paid_subscription FROM sqf_billing_settings WHERE singleton=1')->fetchColumn();
    return [
        'municipality'=>['id'=>$city['code'],'name'=>$city['name'],'uf'=>$city['uf']],
        'total'=>(int)$metrics['total'],
        'email_confirmed'=>(int)$metrics['email_confirmed'],
        'verification_pending'=>(int)$metrics['verification_pending'],
        'approved'=>(int)$metrics['approved'],
        'approved_public'=>(int)$metrics['approved_public'],
        'with_active_service'=>(int)$metrics['with_active_service'],
        'visible'=>$visible,
        'visible_categories'=>$categoryCount,
        'billing_policy_defined'=>$billing!==false,
        'paid_subscription_required'=>$billing!==false&&(int)$billing===1
    ];
}
