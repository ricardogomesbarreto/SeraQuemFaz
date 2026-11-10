<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';

/**
 * Service authoring is server-side and restricted to the authenticated provider.
 * Never trust provider_id from the browser. A service with historical contracts
 * is deactivated rather than deleted, protecting foreign-key integrity.
 */
function sqfOwnServices(PDO $db,string $actor):array {
    $role=sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn();
    if($role!=='prestador')throw new DomainException('Somente prestadores podem gerenciar serviços');
    return sqfQuery($db,'SELECT id,provider_id,category_id,service_title,description,price_min_cents,price_max_cents,is_active,created_at FROM provider_services WHERE provider_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[$actor])->fetchAll(PDO::FETCH_ASSOC);
}
function sqfSaveService(PDO $db,string $actor,?string $id,string $category,string $title,string $description,?int $minimum,?int $maximum):string {
    $title=trim($title);$description=trim($description);
    if(mb_strlen($title)<3||mb_strlen($title)>100||mb_strlen($description)>500)throw new DomainException('Descrição ou título inválidos');
    if(($minimum===null)!==($maximum===null)||($minimum!==null&&($minimum<0||$maximum<$minimum||$maximum>100000000)))throw new DomainException('Valores inválidos');
    return sqfTxn($db,function()use($db,$actor,$id,$category,$title,$description,$minimum,$maximum){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=? FOR UPDATE',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Acesso negado');
        if(!sqfQuery($db,"SELECT 1 FROM categories WHERE id=? AND status='active'",[$category])->fetchColumn())throw new DomainException('Categoria indisponível');
        if($id!==null){
            if(!sqfQuery($db,'SELECT id FROM provider_services WHERE id=? AND provider_id=? FOR UPDATE',[$id,$actor])->fetchColumn())throw new DomainException('Serviço indisponível');
            sqfQuery($db,'UPDATE provider_services SET category_id=?,service_title=?,description=?,price_min_cents=?,price_max_cents=? WHERE id=? AND provider_id=?',[$category,$title,$description,$minimum,$maximum,$id,$actor]);
            return $id;
        }
        $id=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,'INSERT INTO provider_services(id,provider_id,category_id,service_title,description,price_min_cents,price_max_cents,is_active) VALUES (?,?,?,?,?,?,?,1)',[$id,$actor,$category,$title,$description,$minimum,$maximum]);
        return $id;
    });
}
function sqfToggleService(PDO $db,string $actor,string $id,bool $active):void {
    sqfTxn($db,function()use($db,$actor,$id,$active){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=? FOR UPDATE',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Acesso negado');
        if(!sqfQuery($db,'SELECT id FROM provider_services WHERE id=? AND provider_id=? FOR UPDATE',[$id,$actor])->fetchColumn())throw new DomainException('Serviço indisponível');
        sqfQuery($db,'UPDATE provider_services SET is_active=? WHERE id=? AND provider_id=?',[$active?1:0,$id,$actor]);
    });
}
function sqfPublicProvider(PDO $db,string $provider):?array {
    if(!preg_match('/^[a-f0-9-]{36}$/iD',$provider))throw new DomainException('Identificador inválido');
    $sql='SELECT p.id,p.full_name,p.city,p.city_ibge,p.bio,CASE WHEN p.avatar_path IS NULL THEN 0 ELSE 1 END AS has_avatar FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.id=? AND '.sqfPublicPredicate();
    $row=sqfQuery($db,$sql,[$provider])->fetch(PDO::FETCH_ASSOC);
    if(!$row)return null;
    $row['services']=sqfQuery($db,'SELECT id,category_id,service_title,description,price_min_cents,price_max_cents FROM provider_services WHERE provider_id=? AND is_active=1 ORDER BY service_title,id LIMIT 100',[$provider])->fetchAll(PDO::FETCH_ASSOC);
    $row['portfolio']=sqfQuery($db,'SELECT ph.id,ph.caption,ph.service_id,ph.is_cover FROM portfolio_photos ph JOIN provider_services s ON s.id=ph.service_id AND s.provider_id=ph.provider_id AND s.is_active=1 WHERE ph.provider_id=? ORDER BY ph.is_cover DESC,ph.created_at DESC LIMIT 50',[$provider])->fetchAll(PDO::FETCH_ASSOC);
    return $row;
}
