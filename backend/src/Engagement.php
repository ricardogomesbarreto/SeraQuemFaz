<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';
function sqfClientFavorites(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='cliente')throw new DomainException('Somente clientes');
    return sqfQuery($db,'SELECT p.id,p.full_name,p.city FROM sqf_client_favorites f JOIN profiles p ON p.id=f.provider_id JOIN provider_verifications v ON v.provider_id=p.id WHERE f.client_id=? AND '.sqfPublicPredicate().' ORDER BY f.created_at DESC,p.id LIMIT 100',[$actor])->fetchAll(PDO::FETCH_ASSOC);
}
function sqfSetFavorite(PDO $db,string $actor,string $provider,bool $saved):void {
    sqfTxn($db,function()use($db,$actor,$provider,$saved){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=? FOR UPDATE',[$actor])->fetchColumn()!=='cliente')throw new DomainException('Somente clientes');
        if(!$saved){sqfQuery($db,'DELETE FROM sqf_client_favorites WHERE client_id=? AND provider_id=?',[$actor,$provider]);return;}
        if($actor===$provider||!sqfProviderPublic($db,$provider))throw new DomainException('Prestador indisponível');
        if(sqfQuery($db,'SELECT 1 FROM sqf_client_favorites WHERE client_id=? AND provider_id=?',[$actor,$provider])->fetchColumn())return;
        if((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_client_favorites WHERE client_id=?',[$actor])->fetchColumn()>=100)throw new DomainException('Limite de favoritos atingido');
        sqfQuery($db,'INSERT INTO sqf_client_favorites(client_id,provider_id) VALUES (?,?)',[$actor,$provider]);
    });
}
function sqfRecordView(PDO $db,string $actor,string $provider):void {
    if($actor===$provider)return;
    if(!sqfProviderPublic($db,$provider))throw new DomainException('Prestador indisponível');
    sqfQuery($db,'INSERT INTO sqf_profile_views(provider_id,viewer_id,viewed_on) VALUES (?,?,UTC_DATE()) ON DUPLICATE KEY UPDATE viewed_on=VALUES(viewed_on)',[$provider,$actor]);
}
function sqfProviderMetrics(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
    $counts=sqfQuery($db,"SELECT COUNT(*) AS requests_total,COALESCE(SUM(quote_sent_at IS NOT NULL),0) AS quotes_sent,COALESCE(SUM(status='completed'),0) AS requests_completed FROM sqf_service_requests WHERE provider_id=?",[$actor])->fetch(PDO::FETCH_ASSOC);
    $counts['views_authenticated']=(int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_profile_views WHERE provider_id=?',[$actor])->fetchColumn();
    return array_map('intval',$counts);
}
function sqfCompareQuotes(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='cliente')throw new DomainException('Somente clientes');
    return sqfQuery($db,"SELECT r.id,r.provider_id,p.full_name,r.description,r.quote_cents,r.quote_terms,r.status FROM sqf_service_requests r JOIN profiles p ON p.id=r.provider_id WHERE r.client_id=? AND r.status='quoted' AND r.quote_cents IS NOT NULL ORDER BY r.quote_cents,r.id LIMIT 100",[$actor])->fetchAll(PDO::FETCH_ASSOC);
}
