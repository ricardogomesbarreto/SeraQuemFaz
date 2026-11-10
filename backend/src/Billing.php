<?php
declare(strict_types=1);
require_once __DIR__.'/Moderation.php';

function sqfPaidUntil(PDO $db,string $provider):?string {
    $value=sqfQuery($db,"SELECT MAX(i.paid_period_end) FROM sqf_billing_subscriptions s JOIN sqf_billing_invoices i ON i.subscription_id=s.id WHERE s.user_id=? AND i.status='approved' AND i.currency=s.currency AND i.amount_cents=s.price_cents AND i.paid_at<=UTC_TIMESTAMP(6) AND i.paid_period_end>UTC_TIMESTAMP(6)",[$provider])->fetchColumn();
    return $value===null||$value===false?null:(string)$value;
}
function sqfOwnBilling(PDO $db,string $actor):array {
    if(sqfQuery($db,'SELECT account_type FROM profiles WHERE id=?',[$actor])->fetchColumn()!=='prestador')throw new DomainException('Somente prestadores');
    $settings=sqfQuery($db,'SELECT require_paid_subscription FROM sqf_billing_settings WHERE singleton=1')->fetch(PDO::FETCH_ASSOC);
    $s=sqfQuery($db,'SELECT id,cycle,price_cents,currency,state,paid_until,cancel_requested_at FROM sqf_billing_subscriptions WHERE user_id=?',[$actor])->fetch(PDO::FETCH_ASSOC);
    $invoices=$s?sqfQuery($db,'SELECT status,amount_cents,currency,paid_at,paid_period_end,verified_at FROM sqf_billing_invoices WHERE subscription_id=? ORDER BY verified_at DESC LIMIT 100',[$s['id']])->fetchAll(PDO::FETCH_ASSOC):[];
    $paid=sqfPaidUntil($db,$actor);
    if($s){unset($s['id']);$s['paid_until']=$paid;$s['active']=$paid!==null;}
    return ['subscription'=>$s?:null,'invoices'=>$invoices,'require_paid_subscription'=>(bool)($settings['require_paid_subscription']??true),'checkout_enabled'=>false,'plans'=>['monthly'=>1490,'yearly'=>14900]];
}
function sqfStaffBilling(PDO $db,string $actor):array {
    if(sqfRequireStaff($db,$actor)!=='admin')throw new DomainException('Somente administradores');
    $settings=sqfQuery($db,'SELECT require_paid_subscription,checkout_enabled FROM sqf_billing_settings WHERE singleton=1')->fetch(PDO::FETCH_ASSOC);
    $counts=sqfQuery($db,'SELECT state,COUNT(*) AS total FROM sqf_billing_subscriptions GROUP BY state')->fetchAll(PDO::FETCH_ASSOC);
    $invoices=sqfQuery($db,'SELECT status,COUNT(*) AS total,COALESCE(SUM(amount_cents),0) AS cents FROM sqf_billing_invoices GROUP BY status')->fetchAll(PDO::FETCH_ASSOC);
    $active=(int)$db->query("SELECT COUNT(DISTINCT s.user_id) FROM sqf_billing_subscriptions s JOIN sqf_billing_invoices i ON i.subscription_id=s.id WHERE i.status='approved' AND i.currency=s.currency AND i.amount_cents=s.price_cents AND i.paid_at<=UTC_TIMESTAMP(6) AND i.paid_period_end>UTC_TIMESTAMP(6)")->fetchColumn();
    return ['settings'=>$settings,'subscriptions'=>$counts,'invoices'=>$invoices,'active_paid'=>$active,'checkout_available'=>false];
}
/** Internal only: caller must fetch and authenticate the authoritative payment and invoice
 * from the payment provider. Never expose this function as a browser route.
 * This candidate has no live caller; integration fixtures exercise the contract.
 */
function sqfReconcileVerifiedInvoice(PDO $db,string $subscription,string $invoice,string $payment,string $state,int $amount,string $currency,?string $paidAt,?string $periodEnd):void {
    if(!in_array($state,['approved','pending','rejected','refunded','charged_back'],true)||!preg_match('/^[A-Za-z0-9_-]{1,120}$/D',$invoice)||!preg_match('/^[A-Za-z0-9_-]{1,120}$/D',$payment)||$currency!=='BRL')throw new DomainException('Fatura inválida');
    $date=static function(?string $value):?DateTimeImmutable {
        if($value===null)return null;
        $d=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$value,new DateTimeZone('UTC'));
        if(!$d||$d->format('Y-m-d H:i:s')!==$value)throw new DomainException('Data inválida');
        return $d;
    };
    $start=$date($paidAt);$end=$date($periodEnd);
    if($state==='approved'&&(!$start||!$end||$end<=$start||$start>new DateTimeImmutable('now',new DateTimeZone('UTC'))))throw new DomainException('Período inválido');
    sqfTxn($db,function()use($db,$subscription,$invoice,$payment,$state,$amount,$currency,$paidAt,$periodEnd){
        $s=sqfQuery($db,'SELECT id,price_cents,currency FROM sqf_billing_subscriptions WHERE id=? FOR UPDATE',[$subscription])->fetch(PDO::FETCH_ASSOC);
        if(!$s||$amount!==(int)$s['price_cents']||$currency!==$s['currency'])throw new DomainException('Pagamento não corresponde ao plano');
        $existing=sqfQuery($db,'SELECT mp_invoice_id FROM sqf_billing_invoices WHERE mp_payment_id=? FOR UPDATE',[$payment])->fetchColumn();
        if($existing!==false&&$existing!==$invoice)throw new DomainException('Pagamento já vinculado a outra fatura');
        $old=sqfQuery($db,'SELECT subscription_id,mp_payment_id,status,paid_at,paid_period_end FROM sqf_billing_invoices WHERE mp_invoice_id=? FOR UPDATE',[$invoice])->fetch(PDO::FETCH_ASSOC);
        if($old&&($old['subscription_id']!==$subscription||$old['mp_payment_id']!==$payment))throw new DomainException('Fatura vinculada a outro pagamento');
        if($old&&in_array($old['status'],['refunded','charged_back'],true)&&!in_array($state,['refunded','charged_back'],true))throw new DomainException('Estorno ou contestação não pode reativar pagamento');
        if($old&&$old['status']==='approved'&&$state==='approved'){
            if(substr((string)$old['paid_at'],0,19)!==$paidAt||substr((string)$old['paid_period_end'],0,19)!==$periodEnd)throw new DomainException('Período aprovado não pode ser alterado');
        }
        if($old&&$old['status']==='approved'&&in_array($state,['pending','rejected'],true))throw new DomainException('Estado anterior não substitui pagamento aprovado');
        if($old)sqfQuery($db,'UPDATE sqf_billing_invoices SET status=?,paid_at=?,paid_period_end=?,verified_at=UTC_TIMESTAMP(6) WHERE mp_invoice_id=?',[$state,$paidAt,$periodEnd,$invoice]);
        else sqfQuery($db,'INSERT INTO sqf_billing_invoices(subscription_id,mp_invoice_id,mp_payment_id,status,amount_cents,currency,paid_at,paid_period_end) VALUES (?,?,?,?,?,?,?,?)',[$subscription,$invoice,$payment,$state,$amount,$currency,$paidAt,$periodEnd]);
        sqfQuery($db,"UPDATE sqf_billing_subscriptions SET paid_until=(SELECT MAX(paid_period_end) FROM sqf_billing_invoices WHERE subscription_id=? AND status='approved' AND currency=? AND amount_cents=? AND paid_at<=UTC_TIMESTAMP(6)),last_verified_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=?",[$subscription,$currency,$amount,$subscription]);
    });
}
