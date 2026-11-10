<?php
declare(strict_types=1);
require_once __DIR__.'/Billing.php';

function sqfMpWebhookValid(string $header,string $id,string $request,string $secret,int $now):bool {
    if($secret===''||!preg_match('/^[A-Za-z0-9_-]{1,120}$/D',$id)||!preg_match('/^[A-Za-z0-9_-]{1,200}$/D',$request))return false;
    $parts=[];
    foreach(explode(',',$header) as $part){$pair=explode('=',trim($part),2);if(count($pair)!==2||isset($parts[$pair[0]]))return false;$parts[$pair[0]]=$pair[1];}
    $ts=$parts['ts']??'';$signature=$parts['v1']??'';
    if(!preg_match('/^(?:[0-9]{10}|[0-9]{13})$/D',$ts)||!preg_match('/^[a-f0-9]{64}$/iD',$signature))return false;
    $seconds=strlen($ts)===13?intdiv((int)$ts,1000):(int)$ts;
    if(abs($now-$seconds)>600)return false;
    return hash_equals(hash_hmac('sha256','id:'.strtolower($id).';request-id:'.$request.';ts:'.$ts.';',$secret),strtolower($signature));
}
function sqfMpCents(mixed $amount):int {
    if(!is_int($amount)&&!is_float($amount)&&!is_string($amount))throw new DomainException('Valor inválido');
    $value=(string)$amount;
    if(!preg_match('/^[0-9]{1,8}(?:\.[0-9]{1,2})?$/D',$value))throw new DomainException('Valor inválido');
    [$whole,$fraction]=array_pad(explode('.',$value,2),2,'');
    return (int)$whole*100+(int)str_pad($fraction,2,'0');
}
function sqfMpPeriod(string $date,int $months):array {
    if(!in_array($months,[1,12],true)||!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/D',$date))throw new DomainException('Data de pagamento inválida');
    $start=new DateTimeImmutable($date);$errors=DateTimeImmutable::getLastErrors();
    if($errors&&($errors['warning_count']||$errors['error_count']))throw new DomainException('Data de pagamento inválida');
    $start=$start->setTimezone(new DateTimeZone('UTC'));
    $target=$start->modify('first day of this month')->modify('+'.$months.' months');
    $end=$target->setDate((int)$target->format('Y'),(int)$target->format('m'),min((int)$start->format('d'),(int)$target->format('t')));
    return [$start->format('Y-m-d H:i:s'),$end->format('Y-m-d H:i:s')];
}
/** Read-only transport is injected. Never trust payment state from webhook body. */
function sqfMpSyncInvoice(PDO $db,string $invoiceId,callable $get):void {
    if(!preg_match('/^[A-Za-z0-9_-]{1,120}$/D',$invoiceId))throw new DomainException('Fatura inválida');
    $invoice=$get('/authorized_payments/'.rawurlencode($invoiceId));
    if(!is_array($invoice)||(string)($invoice['id']??'')!==$invoiceId)throw new DomainException('Fatura divergente');
    $remoteId=(string)($invoice['preapproval_id']??'');
    if(!preg_match('/^[A-Za-z0-9_-]{8,120}$/D',$remoteId))throw new DomainException('Assinatura inválida');
    $sub=sqfQuery($db,'SELECT id,mp_preapproval_id,external_reference,cycle,price_cents,currency FROM sqf_billing_subscriptions WHERE mp_preapproval_id=?',[$remoteId])->fetch(PDO::FETCH_ASSOC);
    if(!$sub)throw new DomainException('Assinatura não encontrada');
    $remote=$get('/preapproval/'.rawurlencode($remoteId));$rec=$remote['auto_recurring']??[];
    if((string)($remote['id']??'')!==$remoteId||(string)($remote['external_reference']??'')!==$sub['external_reference']||($rec['currency_id']??'')!=='BRL'||sqfMpCents($rec['transaction_amount']??null)!==(int)$sub['price_cents']||(string)($rec['frequency']??'')!==($sub['cycle']==='yearly'?'12':'1')||($rec['frequency_type']??'')!=='months')throw new DomainException('Contrato externo divergente');
    $paymentId=(string)($invoice['payment']['id']??'');
    if(!preg_match('/^[A-Za-z0-9_-]{1,120}$/D',$paymentId))throw new DomainException('Pagamento ainda não identificado');
    $payment=$get('/v1/payments/'.rawurlencode($paymentId));
    if((string)($payment['id']??'')!==$paymentId||($payment['currency_id']??'')!=='BRL'||($invoice['currency_id']??'')!=='BRL'||sqfMpCents($payment['transaction_amount']??null)!==(int)$sub['price_cents']||sqfMpCents($invoice['transaction_amount']??null)!==(int)$sub['price_cents'])throw new DomainException('Pagamento divergente');
    $status=match($payment['status']??''){'approved'=>'approved','refunded'=>'refunded','charged_back'=>'charged_back','rejected','cancelled'=>'rejected','pending','in_process','authorized'=>'pending',default=>throw new DomainException('Estado externo inválido')};
    $paid=null;$end=null;
    if($status==='approved'){
        if(($invoice['payment']['status']??'')!=='approved')throw new DomainException('Pagamento ainda não confirmado pela fatura');
        [$paid,$end]=sqfMpPeriod((string)($payment['date_approved']??''),$sub['cycle']==='yearly'?12:1);
    }
    sqfReconcileVerifiedInvoice($db,$sub['id'],$invoiceId,$paymentId,$status,(int)$sub['price_cents'],'BRL',$paid,$end);
}
function sqfMpProcessInvoiceWebhook(PDO $db,string $signature,string $id,string $request,string $secret,int $now,callable $get):void {
    if(!sqfMpWebhookValid($signature,$id,$request,$secret,$now))throw new DomainException('Assinatura do webhook inválida');
    sqfMpSyncInvoice($db,$id,$get);
}
