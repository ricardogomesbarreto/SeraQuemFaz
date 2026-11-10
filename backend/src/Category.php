<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';
function sqfCategoryPage(PDO $db,string $id,string $city):?array {
    if(!preg_match('/^[0-9a-f-]{36}$/iD',$id)||!preg_match('/^[0-9]{7}$/D',$city))throw new DomainException('Categoria ou município inválido');
    $category=sqfQuery($db,"SELECT id,name,description,image_url,status FROM categories WHERE id=? AND status='active'",[$id])->fetch(PDO::FETCH_ASSOC);
    if(!$category)return null;
    $profiles=sqfQuery($db,"SELECT p.id,p.full_name,p.city,p.city_ibge,p.bio,p.created_at,CASE WHEN p.avatar_path IS NULL THEN 0 ELSE 1 END AS has_avatar FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.city_ibge=? AND ".sqfPublicPredicate()." AND EXISTS(SELECT 1 FROM provider_services s WHERE s.provider_id=p.id AND s.category_id=? AND s.is_active=1) ORDER BY p.full_name,p.id LIMIT 100",[$city,$id])->fetchAll(PDO::FETCH_ASSOC);
    $services=[];$reviews=[];$details=[];$photos=[];
    foreach($profiles as $p){
        $services=array_merge($services,sqfQuery($db,'SELECT provider_id,service_title,description FROM provider_services WHERE provider_id=? AND category_id=? AND is_active=1 ORDER BY id LIMIT 100',[$p['id'],$id])->fetchAll(PDO::FETCH_ASSOC));
        $reviews=array_merge($reviews,sqfQuery($db,"SELECT provider_id,rating FROM reviews WHERE provider_id=? AND moderation_status='published' ORDER BY created_at DESC LIMIT 100",[$p['id']])->fetchAll(PDO::FETCH_ASSOC));
        $details=array_merge($details,sqfQuery($db,'SELECT provider_id,specialties,service_mode FROM provider_professional_details WHERE provider_id=?',[$p['id']])->fetchAll(PDO::FETCH_ASSOC));
        $photos=array_merge($photos,sqfQuery($db,'SELECT ph.provider_id FROM portfolio_photos ph JOIN provider_services s ON s.id=ph.service_id AND s.provider_id=ph.provider_id AND s.is_active=1 WHERE ph.provider_id=? LIMIT 50',[$p['id']])->fetchAll(PDO::FETCH_ASSOC));
    }
    return compact('category','profiles','services','reviews','details','photos');
}
function sqfFavoriteCategories(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='cliente')throw new DomainException('Somente clientes');
    return sqfQuery($db,"SELECT c.id,c.name,c.description FROM sqf_client_category_favorites f JOIN categories c ON c.id=f.category_id AND c.status='active' WHERE f.client_id=? ORDER BY f.created_at DESC LIMIT 30",[$actor])->fetchAll(PDO::FETCH_ASSOC);
}
function sqfFavoriteCategory(PDO $db,string $actor,string $id,bool $saved):void {
    sqfTxn($db,function()use($db,$actor,$id,$saved){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=? FOR UPDATE',[$actor])->fetchColumn()!=='cliente')throw new DomainException('Somente clientes');
        if(!$saved){sqfQuery($db,'DELETE FROM sqf_client_category_favorites WHERE client_id=? AND category_id=?',[$actor,$id]);return;}
        if(!sqfQuery($db,"SELECT 1 FROM categories WHERE id=? AND status='active'",[$id])->fetchColumn())throw new DomainException('Categoria indisponível');
        if(sqfQuery($db,'SELECT 1 FROM sqf_client_category_favorites WHERE client_id=? AND category_id=?',[$actor,$id])->fetchColumn())return;
        if((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_client_category_favorites WHERE client_id=?',[$actor])->fetchColumn()>=30)throw new DomainException('Limite de 30 categorias salvas');
        sqfQuery($db,'INSERT INTO sqf_client_category_favorites(client_id,category_id) VALUES (?,?)',[$actor,$id]);
    });
}
