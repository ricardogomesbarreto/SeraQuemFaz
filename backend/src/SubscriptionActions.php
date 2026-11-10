<?php
declare(strict_types=1);
require_once __DIR__.'/MercadoPago.php';
function sqfPlan(string $cycle):array {
    return match($cycle){'monthly'=>[1490,1],'yearly'=>[14900,12],default=>throw new DomainException('Ciclo inválido')};
}
function sqfCheckoutAllowed(PDO $db):bool {
    return getenv('SQF_MP_CHECKOUT_ENABLED')==='1'&&(int)$db->query('SELECT checkout_enabled FROM sqf_billing_settings WHERE singleton=1')->fetchColumn()===1;
}
function sqfSubscriptionActor(PDO $db,string $actor,bool $lock=false):array {
    $row=sqfQuery($db,"SELECT p.account_type,u.email,u.email_confirmed_at FROM profiles p JOIN sqf_auth_users u ON u.id=p.id WHERE p.id=?".($lock?' FOR UPDATE':''),[$actor])->fetch(PDO::FETCH_ASSOC);
    if(!$row||$row['account_type']!=='prestador'||!$row['email_confirmed_at'])throw new DomainException('Prestador confirmado obrigatório');
    return $row;
}
function sqfCheckoutUrl(string $url):string {
    $p=parse_url($url);
    if(!$p||($p['scheme']??'')!=='https'||!in_array(strtolower($p['host']??''),['www.mercadopago.com.br','mercadopago.com.br','www.mercadopago.com'],true)||isset($p['user'])||isset($p['pass'])||isset($p['port']))throw new DomainException('Checkout inválido');
    return $url;
}
/** Reserve first. On an ambiguous external result, retain creating and require
 * reconciliation by reference; never repeat POST blindly. */
function sqfCreateCheckout(PDO $db,string $actor,string $cycle,callable $remote):array {
    if(!sqfCheckoutAllowed($db))throw new DomainException('Checkout desativado');
    [$price,$months]=sqfPlan($cycle);
    $site=getenv('SQF_SITE_URL');
    if(!$site||!filter_var($site,FILTER_VALIDATE_URL)||parse_url($site,PHP_URL_SCHEME)!=='https'||parse_url($site,PHP_URL_USER)!==null||parse_url($site,PHP_URL_QUERY)!==null||parse_url($site,PHP_URL_FRAGMENT)!==null)throw new RuntimeException('URL de retorno inválida');
    $reserved=sqfTxn($db,function()use($db,$actor,$cycle,$price){
        $user=sqfSubscriptionActor($db,$actor,true);
        $s=sqfQuery($db,'SELECT id,external_reference,state,cycle,checkout_url FROM sqf_billing_subscriptions WHERE user_id=? FOR UPDATE',[$actor])->fetch(PDO::FETCH_ASSOC);
        if($s){if($s['state']==='pending'&&$s['cycle']===$cycle&&$s['checkout_url'])return ['url'=>sqfCheckoutUrl($s['checkout_url'])];throw new DomainException('Assinatura existente: consulte a situação antes de contratar');}
        $id=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,"INSERT INTO sqf_billing_subscriptions(id,user_id,external_reference,cycle,price_cents,state) VALUES (?,?,?,?,?,'creating')",[$id,$actor,$id,$cycle,$price]);
        return ['id'=>$id,'email'=>$user['email']];
    });
    if(isset($reserved['url']))return $reserved;
    $id=$reserved['id'];
    $response=$remote('POST','/preapproval',['reason'=>'Será Quem Faz? — '.$cycle,'external_reference'=>$id,'payer_email'=>$reserved['email'],'auto_recurring'=>['frequency'=>$months,'frequency_type'=>'months','transaction_amount'=>$price/100,'currency_id'=>'BRL'],'back_url'=>rtrim($site,'/').'/painel.html#assinatura','status'=>'pending']);
    $remoteId=(string)($response['id']??'');$url=sqfCheckoutUrl((string)($response['init_point']??''));
    if(!preg_match('/^[A-Za-z0-9_-]{8,120}$/D',$remoteId)||($response['external_reference']??'')!==$id||($response['status']??'')!=='pending')throw new RuntimeException('Resposta de assinatura divergente');
    sqfQuery($db,"UPDATE sqf_billing_subscriptions SET mp_preapproval_id=?,checkout_url=?,state='pending',updated_at=UTC_TIMESTAMP(6) WHERE id=? AND state='creating'",[$remoteId,$url,$id]);
    return ['url'=>$url];
}
function sqfCancelSubscription(PDO $db,string $actor,callable $remote):void {
    if(getenv('SQF_MP_CHECKOUT_ENABLED')!=='1')throw new DomainException('Operação desativada');
    $s=sqfTxn($db,function()use($db,$actor){
        sqfSubscriptionActor($db,$actor,true);
        $s=sqfQuery($db,'SELECT id,mp_preapproval_id,external_reference,state FROM sqf_billing_subscriptions WHERE user_id=? FOR UPDATE',[$actor])->fetch(PDO::FETCH_ASSOC);
        if(!$s||!$s['mp_preapproval_id'])throw new DomainException('Assinatura indisponível');
        if($s['state']!=='canceled')sqfQuery($db,'UPDATE sqf_billing_subscriptions SET cancel_requested_at=COALESCE(cancel_requested_at,UTC_TIMESTAMP(6)) WHERE id=?',[$s['id']]);
        return $s;
    });
    if($s['state']==='canceled')return;
    $result=$remote('PUT','/preapproval/'.rawurlencode($s['mp_preapproval_id']),['status'=>'canceled']);
    if(($result['id']??'')!==$s['mp_preapproval_id']||($result['external_reference']??'')!==$s['external_reference']||($result['status']??'')!=='canceled')throw new RuntimeException('Cancelamento não confirmado');
    sqfQuery($db,"UPDATE sqf_billing_subscriptions SET state='canceled',canceled_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=?",[$s['id']]);
}
function sqfRequestCycle(PDO $db,string $actor,string $cycle):array {
    sqfPlan($cycle);
    return sqfTxn($db,function()use($db,$actor,$cycle){
        sqfSubscriptionActor($db,$actor,true);
        $s=sqfQuery($db,'SELECT cycle FROM sqf_billing_subscriptions WHERE user_id=? FOR UPDATE',[$actor])->fetch(PDO::FETCH_ASSOC);
        if(!$s||$s['cycle']===$cycle)throw new DomainException('Escolha outro ciclo para assinatura existente');
        $until=sqfPaidUntil($db,$actor);
        sqfQuery($db,'INSERT INTO sqf_billing_cycle_requests(user_id,next_cycle,effective_after) VALUES (?,?,?) ON DUPLICATE KEY UPDATE next_cycle=VALUES(next_cycle),effective_after=VALUES(effective_after),requested_at=UTC_TIMESTAMP(6)',[$actor,$cycle,$until]);
        return ['next_cycle'=>$cycle,'effective_after'=>$until,'state'=>'requested','immediate_charge'=>false];
    });
}
function sqfMpWrite(string $method,string $path,array $body):array {
    $token=getenv('SQF_MP_ACCESS_TOKEN');
    if(getenv('SQF_MP_CHECKOUT_ENABLED')!=='1'||!$token||!preg_match('/^TEST-[A-Za-z0-9_-]{16,507}$/D',$token)||!function_exists('curl_init'))throw new RuntimeException('Somente sandbox');
    if(!(($method==='POST'&&$path==='/preapproval')||($method==='PUT'&&preg_match('#^/preapproval/[A-Za-z0-9_-]{8,120}$#D',$path))))throw new DomainException('Operação inválida');
    $ch=curl_init('https://api.mercadopago.com'.$path);$raw='';
    try{
        curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR),CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token,'Content-Type: application/json','Accept: application/json'],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>12,CURLOPT_WRITEFUNCTION=>static function($ch,string $chunk)use(&$raw):int{if(strlen($raw)+strlen($chunk)>1048576)return 0;$raw.=$chunk;return strlen($chunk);}]);
        if(curl_exec($ch)===false||!in_array(curl_getinfo($ch,CURLINFO_RESPONSE_CODE),[200,201],true))throw new RuntimeException('Operação financeira não confirmada');
        $data=json_decode($raw,true,32,JSON_THROW_ON_ERROR|JSON_BIGINT_AS_STRING);if(!is_array($data))throw new RuntimeException('Resposta inválida');return $data;
    }finally{curl_close($ch);}
}
