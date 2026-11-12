<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';require __DIR__.'/../../backend/src/SubscriptionActions.php';
$db=sqfDatabase();$provider='00000000-0000-4000-8000-000000000002';$client='00000000-0000-4000-8000-000000000001';
function check(bool $x,string $m):void{if(!$x)throw new RuntimeException($m);echo "PASS: $m\n";}
function reject(callable $f,string $m):void{try{$f();}catch(DomainException $e){check(true,$m);return;}throw new RuntimeException($m);}
$original=sqfQuery($db,'SELECT email_confirmed_at FROM sqf_auth_users WHERE id=?',[$provider])->fetchColumn();
sqfQuery($db,'UPDATE sqf_auth_users SET email_confirmed_at=UTC_TIMESTAMP(6) WHERE id=?',[$provider]);
$remoteCalls=0;$reference=null;
$remote=function(string $method,string $path,array $data)use(&$remoteCalls,&$reference):array{
    $remoteCalls++;
    if($method==='POST'){check($path==='/preapproval'&&$data['status']==='pending'&&in_array($data['auto_recurring']['transaction_amount'],[14.9,149,149.0],true),'checkout fixed monthly price');$reference=$data['external_reference'];return ['id'=>'fixture-new-preapproval-'.$remoteCalls,'status'=>'pending','external_reference'=>$reference,'init_point'=>'https://www.mercadopago.com.br/checkout/fixture'];}
    check($method==='PUT'&&$data['status']==='canceled','remote cancellation contract');return ['id'=>'fixture-new-preapproval-1','status'=>'canceled','external_reference'=>$reference];
};
putenv('SQF_MP_CHECKOUT_ENABLED=0');reject(fn()=>sqfCreateCheckout($db,$provider,'monthly',$remote),'disabled checkout rejects');
putenv('SQF_MP_CHECKOUT_ENABLED=1');putenv('SQF_SITE_URL=https://example.invalid');
sqfQuery($db,'UPDATE sqf_billing_settings SET checkout_enabled=1 WHERE singleton=1');
try{
    reject(fn()=>sqfCreateCheckout($db,$client,'monthly',$remote),'client cannot subscribe as provider');
    // The first request has committed its reservation but is still awaiting the remote response.
    // A second connection must reject a competing checkout without invoking the payment transport.
    $competingCalls=0;
    $overlap=function(string $method,string $path,array $data)use($db,$provider,$remote,&$competingCalls):array{
        if($method==='POST'){
            $other=sqfDatabase();
            reject(fn()=>sqfCreateCheckout($other,$provider,'monthly',function()use(&$competingCalls){$competingCalls++;throw new RuntimeException('duplicate remote checkout');}),'in-flight checkout rejects competing request');
            check($competingCalls===0,'competing request never calls payment transport');
        }
        return $remote($method,$path,$data);
    };
    $a=sqfCreateCheckout($db,$provider,'monthly',$overlap);
    check(sqfCreateCheckout($db,$provider,'monthly',$remote)===$a&&$remoteCalls===1,'checkout retry reuses existing link');
    $s=sqfQuery($db,'SELECT id FROM sqf_billing_subscriptions WHERE user_id=?',[$provider])->fetchColumn();
    $start=gmdate('Y-m-d H:i:s',time()-60);$end=gmdate('Y-m-d H:i:s',time()+86400);
    sqfReconcileVerifiedInvoice($db,$s,'fixture-action-invoice','fixture-action-payment','approved',1490,'BRL',$start,$end);
    $until=sqfPaidUntil($db,$provider);$cycle=sqfRequestCycle($db,$provider,'yearly');
    check($cycle['effective_after']===$until&&$cycle['immediate_charge']===false&&$remoteCalls===1,'cycle intent preserves paid period and does not charge');
    sqfCancelSubscription($db,$provider,$remote);sqfCancelSubscription($db,$provider,$remote);
    check($remoteCalls===2&&sqfPaidUntil($db,$provider)===$until,'cancellation idempotent and preserves paid period');
    reject(fn()=>sqfCreateCheckout($db,$provider,'yearly',$remote),'renewal blocked during paid period');
    sqfQuery($db,"UPDATE sqf_billing_invoices SET paid_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY),paid_period_end=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE subscription_id=?",[$s]);
    sqfQuery($db,"UPDATE sqf_billing_cycle_requests SET effective_after=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE user_id=?",[$provider]);
    reject(fn()=>sqfCreateCheckout($db,$provider,'monthly',$remote),'renewal respects requested cycle');
    sqfCreateCheckout($db,$provider,'yearly',$remote);
    check((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_billing_subscriptions WHERE user_id=?',[$provider])->fetchColumn()===2,'historical subscription preserved');
    try{sqfQuery($db,'UPDATE sqf_billing_subscriptions SET is_current=1 WHERE id=?',[$s]);throw new RuntimeException('historical promotion accepted');}
    catch(PDOException $e){check($e->getCode()==='23000','database rejects promotion of historical contract while current exists');}
    check((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_billing_subscriptions WHERE user_id=? AND is_current=1',[$provider])->fetchColumn()===1,'exactly one current contract after rejected promotion');
    $billing=sqfOwnBilling($db,$provider);
    check($billing['subscription']['cycle']==='yearly'&&count($billing['invoices'])===1&&$billing['invoices'][0]['cycle']==='monthly','new cycle and old invoice retained');
    check($billing['cycle_request']===null,'confirmed new checkout consumes cycle request');
    try{sqfQuery($db,"INSERT INTO sqf_billing_subscriptions(user_id,cycle,price_cents,state) VALUES (?,'monthly',1490,'creating')",[$provider]);throw new RuntimeException('duplicate current subscription accepted');}
    catch(PDOException $e){check($e->getCode()==='23000','database rejects second current subscription');}
}finally{
    sqfQuery($db,'DELETE FROM sqf_billing_cycle_requests WHERE user_id=?',[$provider]);
    sqfQuery($db,'DELETE a FROM sqf_billing_payment_attempts a JOIN sqf_billing_invoices i ON i.mp_invoice_id=a.invoice_id JOIN sqf_billing_subscriptions s ON s.id=i.subscription_id WHERE s.user_id=?',[$provider]);
    sqfQuery($db,'DELETE i FROM sqf_billing_invoices i JOIN sqf_billing_subscriptions s ON s.id=i.subscription_id WHERE s.user_id=?',[$provider]);
    sqfQuery($db,'DELETE FROM sqf_billing_subscriptions WHERE user_id=?',[$provider]);
    sqfQuery($db,'UPDATE sqf_billing_settings SET checkout_enabled=0 WHERE singleton=1');
    sqfQuery($db,'UPDATE sqf_auth_users SET email_confirmed_at=? WHERE id=?',[$original?:null,$provider]);
}
