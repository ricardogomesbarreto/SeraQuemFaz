<?php
declare(strict_types=1);

/** Shared prepared-query helper; actor IDs originate exclusively in authenticated server sessions. */
function sqfQuery(PDO $db,string $sql,array $args=[]): PDOStatement {
    $s=$db->prepare($sql); $s->execute($args); return $s;
}
function sqfPublicPredicate(): string {
    return "p.account_type='prestador' AND p.is_public=1 AND v.status='approved' AND (
       EXISTS(SELECT 1 FROM sqf_billing_settings b WHERE b.singleton=1 AND b.require_paid_subscription=0)
       OR EXISTS(SELECT 1 FROM sqf_billing_subscriptions s JOIN sqf_billing_invoices i ON i.subscription_id=s.id
         WHERE s.user_id=p.id AND i.status='approved' AND i.currency=s.currency AND i.amount_cents=s.price_cents
           AND i.paid_at<=UTC_TIMESTAMP(6) AND i.paid_period_end>UTC_TIMESTAMP(6)))";
}
function sqfProviderPublic(PDO $db,string $id): bool {
    return (bool)sqfQuery($db,'SELECT 1 FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.id=? AND '.sqfPublicPredicate(),[$id])->fetchColumn();
}
function sqfCatalog(PDO $db,string $city): array {
    if (!preg_match('/^[0-9]{7}$/D',$city)) throw new DomainException('Município inválido');
    return sqfQuery($db,'SELECT p.id,p.full_name,p.city,p.city_ibge,p.bio FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.city_ibge=? AND '.sqfPublicPredicate().' ORDER BY p.full_name,p.id LIMIT 100',[$city])->fetchAll(PDO::FETCH_ASSOC);
}
function sqfTxn(PDO $db,callable $fn): mixed {
    $db->beginTransaction();
    try {$result=$fn();$db->commit();return $result;}
    catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function sqfRequestRow(PDO $db,string $actor,string $id): array {
    $r=sqfQuery($db,'SELECT * FROM sqf_service_requests WHERE id=? FOR UPDATE',[$id])->fetch(PDO::FETCH_ASSOC);
    if (!$r || !in_array($actor,[$r['client_id'],$r['provider_id']],true)) throw new DomainException('Acesso negado');
    return $r;
}
function sqfNotify(PDO $db,string $recipient,string $kind,string $title,string $body,string $request):void {
    sqfQuery($db,'INSERT INTO sqf_notifications(recipient_id,kind,title,body,request_id) VALUES (?,?,?,?,?)',[$recipient,$kind,$title,$body,$request]);
}
function sqfEvent(PDO $db,string $request,string $actor,string $action,?string $from,string $to,?int $cents=null):void {
    sqfQuery($db,'INSERT INTO sqf_request_events(request_id,actor_id,action,from_status,to_status,amount_cents) VALUES (?,?,?,?,?,?)',[$request,$actor,$action,$from,$to,$cents]);
}
function sqfCreateRequest(PDO $db,string $actor,string $provider,string $service,string $description,?string $date=null):string {
    $description=trim($description);
    if(mb_strlen($description)<25||mb_strlen($description)>2000||$actor===$provider)throw new DomainException('Solicitação inválida');
    if($date!==null){
      $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('UTC'));
      $today=new DateTimeImmutable('today',new DateTimeZone('UTC'));
      if(!$d||$d->format('Y-m-d')!==$date||$d<$today->modify('-1 day')||$d>$today->modify('+366 days'))throw new DomainException('Data desejada inválida');
    }
    return sqfTxn($db,function()use($db,$actor,$provider,$service,$description,$date){
        $identity=sqfQuery($db,'SELECT email_confirmed_at FROM sqf_auth_users WHERE id=? FOR UPDATE',[$actor])->fetch(PDO::FETCH_ASSOC);
        if(!$identity||!$identity['email_confirmed_at']||!sqfQuery($db,"SELECT 1 FROM profiles WHERE id=? AND account_type='cliente'",[$actor])->fetchColumn())throw new DomainException('Cliente não autorizado');
        if(!sqfProviderPublic($db,$provider))throw new DomainException('Prestador indisponível');
        $city=sqfQuery($db,'SELECT p.city_ibge FROM profiles p JOIN sqf_ibge_municipalities m ON m.code=p.city_ibge JOIN provider_services s ON s.provider_id=p.id WHERE p.id=? AND s.id=? AND s.is_active=1',[$provider,$service])->fetchColumn();
        if(!$city)throw new DomainException('Serviço ou cidade inválida');
        if((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_service_requests WHERE client_id=? AND created_at>UTC_TIMESTAMP(6)-INTERVAL 24 HOUR',[$actor])->fetchColumn()>=8)throw new DomainException('Limite diário excedido');
        if(sqfQuery($db,"SELECT 1 FROM sqf_service_requests WHERE client_id=? AND provider_id=? AND service_id=? AND status NOT IN ('completed','declined','canceled') AND created_at>UTC_TIMESTAMP(6)-INTERVAL 48 HOUR LIMIT 1",[$actor,$provider,$service])->fetchColumn())throw new DomainException('Solicitação aberta existente');
        $id=(string)$db->query('SELECT UUID()')->fetchColumn();
        sqfQuery($db,'INSERT INTO sqf_service_requests(id,client_id,provider_id,service_id,city_ibge,description,desired_date) VALUES (?,?,?,?,?,?,?)',[$id,$actor,$provider,$service,$city,$description,$date]);
        sqfEvent($db,$id,$actor,'create',null,'requested'); sqfNotify($db,$provider,'request','Nova solicitação de orçamento','Consulte a central de solicitações.',$id); return $id;
    });
}
function sqfSendQuote(PDO $db,string $actor,string $id,int $amount,string $terms):string {
    $terms=trim($terms);
    if($amount<100||$amount>100000000||mb_strlen($terms)<10||mb_strlen($terms)>1500)throw new DomainException('Valor ou condições inválidos');
    return sqfTxn($db,function()use($db,$actor,$id,$amount,$terms){
        $r=sqfRequestRow($db,$actor,$id);
        if($actor!==$r['provider_id']||!in_array($r['status'],['requested','quoted'],true)||!sqfProviderPublic($db,$actor))throw new DomainException('Prestador indisponível');
        sqfQuery($db,"UPDATE sqf_service_requests SET status='quoted',quote_cents=?,quote_terms=?,quote_sent_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=?",[$amount,$terms,$id]);
        sqfEvent($db,$id,$actor,'quote',$r['status'],'quoted',$amount); sqfNotify($db,$r['client_id'],'request_status','Orçamento recebido','Consulte a proposta.',$id); return 'quoted';
    });
}
function sqfRequestAction(PDO $db,string $actor,string $id,string $action):string {
    return sqfTxn($db,function()use($db,$actor,$id,$action){
        $r=sqfRequestRow($db,$actor,$id);$status=$r['status'];$client=$actor===$r['client_id'];
        $next=match(true){
            $action==='decline'&&!$client&&in_array($status,['requested','quoted'],true)=>'declined',
            $action==='cancel'&&$client&&in_array($status,['requested','quoted','accepted'],true)=>'canceled',
            $action==='accept'&&$client&&$status==='quoted'=>'accepted',
            $action==='start'&&!$client&&$status==='accepted'=>'in_progress',
            $action==='finish'&&!$client&&$status==='in_progress'=>'awaiting_confirmation',
            $action==='confirm'&&$client&&$status==='awaiting_confirmation'=>'completed',
            default=>throw new DomainException('Transição inválida')
        };
        if($next==='accepted'&&!sqfProviderPublic($db,$r['provider_id']))throw new DomainException('Prestador indisponível');
        if(in_array($next,['in_progress','awaiting_confirmation'],true)&&!sqfQuery($db,"SELECT 1 FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE p.id=? AND p.account_type='prestador' AND p.is_public=1 AND v.status='approved'",[$r['provider_id']])->fetchColumn())throw new DomainException('Prestador suspenso');
        if($next==='completed'){
            sqfQuery($db,"INSERT INTO service_engagements(client_id,provider_id,status,requested_at,confirmed_at) VALUES (?,?,'confirmed',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE status='confirmed',confirmed_at=COALESCE(confirmed_at,UTC_TIMESTAMP(6))",[$r['client_id'],$r['provider_id']]);
            $eng=sqfQuery($db,'SELECT id FROM service_engagements WHERE client_id=? AND provider_id=?',[$r['client_id'],$r['provider_id']])->fetchColumn();
            sqfQuery($db,'UPDATE sqf_service_requests SET status=?,updated_at=UTC_TIMESTAMP(6),completed_at=UTC_TIMESTAMP(6),engagement_id=? WHERE id=?',[$next,$eng,$id]);
        }else sqfQuery($db,'UPDATE sqf_service_requests SET status=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',[$next,$id]);
        sqfEvent($db,$id,$actor,$action,$status,$next,$r['quote_cents']===null?null:(int)$r['quote_cents']);sqfNotify($db,$client?$r['provider_id']:$r['client_id'],'request_status','Atendimento atualizado','Consulte os detalhes na central de solicitações.',$id);return $next;
    });
}

function sqfMessages(PDO $db,string $actor,string $id):array {
    return sqfTxn($db,function()use($db,$actor,$id){
      sqfRequestRow($db,$actor,$id);
      return sqfQuery($db,'SELECT id,sender_id,body,created_at FROM sqf_request_messages WHERE request_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[$id])->fetchAll(PDO::FETCH_ASSOC);
    });
}
function sqfSendMessage(PDO $db,string $actor,string $id,string $body):string {
    $body=trim($body);
    if(mb_strlen($body)<2||mb_strlen($body)>2000)throw new DomainException('Mensagem inválida');
    return sqfTxn($db,function()use($db,$actor,$id,$body){
      $r=sqfRequestRow($db,$actor,$id);
      if(!in_array($r['status'],['requested','quoted','accepted','in_progress','awaiting_confirmation'],true))throw new DomainException('Atendimento encerrado');
      if(!sqfQuery($db,'SELECT id FROM sqf_auth_users WHERE id=? FOR UPDATE',[$actor])->fetchColumn())throw new DomainException('Identidade indisponível');
      if((int)sqfQuery($db,'SELECT COUNT(*) FROM sqf_request_messages WHERE sender_id=? AND created_at>UTC_TIMESTAMP(6)-INTERVAL 1 HOUR',[$actor])->fetchColumn()>=40)throw new DomainException('Limite de mensagens excedido');
      $message=(string)$db->query('SELECT UUID()')->fetchColumn();
      sqfQuery($db,'INSERT INTO sqf_request_messages(id,request_id,sender_id,body) VALUES (?,?,?,?)',[$message,$id,$actor,$body]);
      sqfNotify($db,$actor===$r['client_id']?$r['provider_id']:$r['client_id'],'message','Nova mensagem privada','Abra a conversa para ler a mensagem.',$id);
      return $message;
    });
}
