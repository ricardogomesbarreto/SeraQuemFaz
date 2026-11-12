<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';
function sqfProfessionalDetails(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
    return sqfQuery($db,'SELECT professional_title,specialties,experience_years,service_mode,coverage_area,workdays,work_period,quote_policy,professional_website FROM provider_professional_details WHERE provider_id=?',[$actor])->fetch(PDO::FETCH_ASSOC)?:[];
}
function sqfSaveProfessionalDetails(PDO $db,string $actor,array $body):void {
    $limits=['professional_title'=>100,'specialties'=>220,'coverage_area'=>240,'professional_website'=>300];
    foreach($limits as $key=>$max){
        if(!isset($body[$key])||!is_string($body[$key])||mb_strlen(trim($body[$key]))>$max)throw new DomainException('Campo inválido: '.$key);
        $body[$key]=trim($body[$key]);
    }
    $choices=['service_mode'=>['nao_informado','presencial','remoto','hibrido'],'work_period'=>['nao_informado','manha','tarde','noite','flexivel'],'quote_policy'=>['sob_consulta','orcamento_gratuito','orcamento_pago']];
    foreach($choices as $key=>$allowed)if(!in_array($body[$key]??null,$allowed,true))throw new DomainException('Opção inválida: '.$key);
    $years=$body['experience_years']??null;
    if($years!==null&&(!is_int($years)||$years<0||$years>60))throw new DomainException('Experiência inválida');
    $days=$body['workdays']??null;
    if(!is_array($days)||!array_is_list($days)||count($days)>7)throw new DomainException('Dias inválidos');
    foreach($days as $day)if(!in_array($day,['seg','ter','qua','qui','sex','sab','dom'],true))throw new DomainException('Dia inválido');
    if(count(array_unique($days))!==count($days))throw new DomainException('Dias duplicados');
    $url=$body['professional_website'];
    if($url!==''&&(!filter_var($url,FILTER_VALIDATE_URL)||parse_url($url,PHP_URL_SCHEME)!=='https'||parse_url($url,PHP_URL_USER)!==null||preg_match('/\s/',$url)))throw new DomainException('Informe endereço HTTPS válido');
    sqfTxn($db,function()use($db,$actor,$body,$years,$days){
        if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=? FOR UPDATE',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
        sqfQuery($db,'INSERT INTO provider_professional_details(provider_id,professional_title,specialties,experience_years,service_mode,coverage_area,workdays,work_period,quote_policy,professional_website) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE professional_title=VALUES(professional_title),specialties=VALUES(specialties),experience_years=VALUES(experience_years),service_mode=VALUES(service_mode),coverage_area=VALUES(coverage_area),workdays=VALUES(workdays),work_period=VALUES(work_period),quote_policy=VALUES(quote_policy),professional_website=VALUES(professional_website),updated_at=UTC_TIMESTAMP(6)',[$actor,$body['professional_title'],$body['specialties'],$years,$body['service_mode'],$body['coverage_area'],json_encode($days,JSON_THROW_ON_ERROR),$body['work_period'],$body['quote_policy'],$body['professional_website']]);
    });
}
