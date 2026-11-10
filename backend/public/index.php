<?php
declare(strict_types=1);
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/Auth.php';
require_once __DIR__.'/../src/Agenda.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(mixed $data,int $status=200):never {
    http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
function required(array $body,string $key):string {
    if(!isset($body[$key])||!is_string($body[$key]))throw new DomainException('Campo inválido: '.$key);
    return $body[$key];
}
function number(array $body,string $key):int {
    if(!isset($body[$key])||!is_int($body[$key]))throw new DomainException('Campo inválido: '.$key);
    return $body[$key];
}
function deliver(string $email,string $token,string $purpose):void {
    $from=getenv('SQF_MAIL_FROM');
    if(!$from||!filter_var($from,FILTER_VALIDATE_EMAIL))throw new RuntimeException('Envio de e-mail não configurado');
    // A real mail transport must be configured and verified before production.
    if(!mail($email,'Código de segurança — Será Quem Faz?', 'Código de '.($purpose==='verify'?'confirmação':'recuperação').": ".$token."\nVálido por 30 minutos.",['From'=>$from,'Content-Type'=>'text/plain; charset=UTF-8']))throw new RuntimeException('Envio indisponível');
}
try {
    $local=getenv('SQF_ALLOW_INSECURE_LOCAL')==='1'&&in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true);
    if(($_SERVER['HTTPS']??'')!=='on'&&!$local)respond(['error'=>'HTTPS obrigatório'],403);
    ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');
    session_name('SQFSESSION');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!$local,'httponly'=>true,'samesite'=>'Strict']);session_start();
    if(!isset($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
    $db=sqfDatabase();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    $route=trim((string)($_GET['route']??''),'/');
    if($method==='GET'&&$route==='session')respond(['user_id'=>sqfSessionUser($db,$_SESSION),'csrf'=>$_SESSION['csrf']]);
    if($method==='GET'&&$route==='categories')respond(['data'=>sqfQuery($db,"SELECT id,name,description,image_url,status,created_at FROM categories WHERE status='active' ORDER BY name,id")->fetchAll(PDO::FETCH_ASSOC)]);
    if($method==='GET'&&$route==='catalog')respond(['data'=>sqfCatalog($db,(string)($_GET['city']??''))]);
    if($method!=='POST')respond(['error'=>'Rota indisponível'],404);
    if(!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))respond(['error'=>'CSRF inválido'],403);
    if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))respond(['error'=>'Formato inválido'],415);
    $raw=file_get_contents('php://input',false,null,0,65537);
    if(strlen($raw)>65536)respond(['error'=>'Requisição muito grande'],413);
    $body=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
    if(!is_array($body))throw new DomainException('Corpo inválido');
    $ip=$_SERVER['REMOTE_ADDR']??'unknown';
    if(in_array($route,['register','login','request-reset','resend-verification','verify','reset'],true)){
      sqfAuthLimit($db,'ip:'.$ip,30,900);
      if(in_array($route,['register','login','request-reset','resend-verification'],true)){
        $email=sqfEmail(required($body,'email'));sqfAuthLimit($db,'email:'.$email,8,900);
      }
      switch($route){
        case 'register':
          if(!getenv('SQF_MAIL_FROM'))throw new RuntimeException('Envio de e-mail não configurado');
          try{$result=sqfRegister($db,$email,required($body,'password'),required($body,'name'),required($body,'account_type'),isset($body['city_ibge'])?required($body,'city_ibge'):null);deliver($email,$result['token'],'verify');}
          catch(PDOException $e){if($e->getCode()!=='23000')throw $e;}
          respond(['message'=>'Se a conta estiver disponível, confira o e-mail para confirmar.'],202);
        case 'login':
          $identity=sqfLogin($db,$email,required($body,'password'));session_regenerate_id(true);
          $_SESSION=['id'=>$identity['id'],'auth_version'=>$identity['auth_version'],'csrf'=>bin2hex(random_bytes(32))];
          respond(['user_id'=>$identity['id'],'csrf'=>$_SESSION['csrf']]);
        case 'request-reset':
        case 'resend-verification':
          if(!getenv('SQF_MAIL_FROM'))throw new RuntimeException('Envio de e-mail não configurado');
          $purpose=$route==='request-reset'?'reset':'verify';
          $token=sqfRequestAuthToken($db,$email,$purpose);
          if($token!==null)try{deliver($email,$token,$purpose);}catch(Throwable $e){error_log('SQF mail delivery failed');}
          respond(['message'=>'Se houver conta elegível, confira o e-mail.'],202);
        case 'verify':sqfConsumeToken($db,required($body,'token'),'verify');respond(['ok'=>true]);
        case 'reset':sqfConsumeToken($db,required($body,'token'),'reset',required($body,'password'));respond(['ok'=>true]);
      }
    }
    $actor=sqfSessionUser($db,$_SESSION);
    if(!$actor)respond(['error'=>'Autenticação necessária'],401);
    if($route==='profile/update'){
      $name=trim(required($body,'full_name'));$bio=trim(required($body,'bio'));$code=isset($body['city_ibge'])?required($body,'city_ibge'):null;
      if(mb_strlen($name)<2||mb_strlen($name)>120||mb_strlen($bio)>1500)throw new DomainException('Perfil inválido');
      $city='';if($code!==null){$m=sqfQuery($db,'SELECT name,uf FROM sqf_ibge_municipalities WHERE code=?',[$code])->fetch(PDO::FETCH_ASSOC);if(!$m)throw new DomainException('Município inválido');$city=$m['name'].' - '.$m['uf'];}
      sqfQuery($db,'UPDATE profiles SET full_name=?,bio=?,city=?,city_ibge=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',[$name,$bio,$city,$code,$actor]);respond(['ok'=>true]);
    }
    if($route==='profile')respond(['data'=>sqfQuery($db,'SELECT id,full_name,account_type,city,city_ibge,bio FROM profiles WHERE id=?',[$actor])->fetch(PDO::FETCH_ASSOC)]);
    if($route==='requests')respond(['data'=>sqfQuery($db,'SELECT id,client_id,provider_id,description,status,quote_cents,quote_terms,created_at FROM sqf_service_requests WHERE client_id=? OR provider_id=? ORDER BY created_at DESC LIMIT 100',[$actor,$actor])->fetchAll(PDO::FETCH_ASSOC)]);
    if($route==='appointments')respond(['data'=>sqfQuery($db,'SELECT request_id,starts_at,duration_minutes,status,pending_starts_at,pending_duration_minutes,pending_proposed_by,proposed_by FROM sqf_appointments WHERE client_id=? OR provider_id=? ORDER BY starts_at LIMIT 100',[$actor,$actor])->fetchAll(PDO::FETCH_ASSOC)]);
    if($route==='notifications')respond(['data'=>sqfQuery($db,'SELECT id,kind,title,body,request_id,created_at,read_at FROM sqf_notifications WHERE recipient_id=? ORDER BY created_at DESC LIMIT 100',[$actor])->fetchAll(PDO::FETCH_ASSOC)]);
    if($route==='logout'){$_SESSION=[];session_regenerate_id(true);respond(['ok'=>true]);}
    // Explicit routes only: no arbitrary SQL, table, column, or actor supplied by browser.
    $data=match($route){
      'request/create'=>sqfCreateRequest($db,$actor,required($body,'provider_id'),required($body,'service_id'),required($body,'description'),isset($body['desired_date'])?required($body,'desired_date'):null),
      'request/quote'=>sqfSendQuote($db,$actor,required($body,'request_id'),number($body,'amount_cents'),required($body,'terms')),
      'request/action'=>sqfRequestAction($db,$actor,required($body,'request_id'),required($body,'action')),
      'request/messages'=>sqfMessages($db,$actor,required($body,'request_id')),
      'request/message'=>sqfSendMessage($db,$actor,required($body,'request_id'),required($body,'body')),
      'appointment/action'=>sqfAgenda($db,$actor,required($body,'request_id'),required($body,'action'),isset($body['starts_at'])?required($body,'starts_at'):null,isset($body['duration_minutes'])?number($body,'duration_minutes'):null),
      default=>throw new DomainException('Rota indisponível')
    };
    respond(['data'=>$data]);
}catch(DomainException $e){respond(['error'=>$e->getMessage()],400);}
catch(JsonException $e){respond(['error'=>'JSON inválido'],400);}
catch(Throwable $e){error_log('SQF API failure: '.get_class($e));respond(['error'=>'Operação indisponível'],500);}
