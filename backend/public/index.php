<?php
declare(strict_types=1);
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/Auth.php';
require_once __DIR__.'/../src/Agenda.php';
require_once __DIR__.'/../src/Services.php';
require_once __DIR__.'/../src/Moderation.php';
require_once __DIR__.'/../src/PrivateMedia.php';
require_once __DIR__.'/../src/Category.php';
require_once __DIR__.'/../src/Professional.php';
require_once __DIR__.'/../src/AccountCases.php';
require_once __DIR__.'/../src/AccountSecurity.php';
require_once __DIR__.'/../src/Billing.php';
require_once __DIR__.'/../src/MercadoPago.php';
require_once __DIR__.'/../src/Engagement.php';
require_once __DIR__.'/../src/Mail.php';
require_once __DIR__.'/../src/SubscriptionActions.php';
require_once __DIR__.'/../src/PrivacyExport.php';

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

try {
    $local=getenv('SQF_ALLOW_INSECURE_LOCAL')==='1'&&in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true);
    if(($_SERVER['HTTPS']??'')!=='on'&&!$local)respond(['error'=>'HTTPS obrigatório'],403);
    // Provider-to-server callback: HMAC authentication instead of browser cookies/CSRF.
    if(($_GET['route']??'')==='billing/webhook'){
      if(getenv('SQF_MP_WEBHOOK_ENABLED')!=='1')respond(['error'=>'Integração desativada'],503);
      if(($_SERVER['REQUEST_METHOD']??'')!=='POST')respond(['error'=>'Método indisponível'],405);
      $params=sqfMpWebhookQuery($_SERVER['QUERY_STRING']??'');
      $id=$params['data.id'];$signature=(string)($_SERVER['HTTP_X_SIGNATURE']??'');$request=(string)($_SERVER['HTTP_X_REQUEST_ID']??'');
      $secret=getenv('SQF_MP_WEBHOOK_SECRET')?:'';
      if(!sqfMpWebhookValid($signature,$id,$request,$secret,time()))respond(['error'=>'Assinatura inválida'],401);
      $raw=file_get_contents('php://input',false,null,0,65537);
      if(strlen($raw)>65536)respond(['error'=>'Requisição muito grande'],413);
      $event=json_decode($raw,true,32,JSON_THROW_ON_ERROR|JSON_BIGINT_AS_STRING);
      if(!is_array($event)||($event['type']??'')!==$params['type']||(string)($event['data']['id']??'')!==$id)respond(['error'=>'Evento divergente'],400);
      // No production traffic is accepted in the candidate.
      if(($event['live_mode']??null)!==false)respond(['error'=>'Somente homologação'],403);
      try{sqfMpSyncInvoice(sqfDatabase(),$id,'sqfMpGet');}
      catch(Throwable $e){error_log('SQF webhook reconciliation pending: '.get_class($e));respond(['error'=>'Reconciliação pendente'],503);}
      respond(['ok'=>true]);
    }
    ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');
    session_name('SQFSESSION');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!$local,'httponly'=>true,'samesite'=>'Strict']);session_start();
    if(!isset($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
    $db=sqfDatabase();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    $route=trim((string)($_GET['route']??''),'/');
    if($method==='GET'&&$route==='session')respond(['user_id'=>sqfSessionUser($db,$_SESSION),'csrf'=>$_SESSION['csrf']]);
    if($method==='GET'&&$route==='categories')respond(['data'=>sqfQuery($db,"SELECT id,name,description,image_url,status,created_at FROM categories WHERE status='active' ORDER BY name,id")->fetchAll(PDO::FETCH_ASSOC)]);
    if($method==='GET'&&$route==='reviews/public')respond(['data'=>sqfPublicReviews($db,(string)($_GET['id']??''))]);
    if($method==='GET'&&$route==='provider')respond(['data'=>sqfPublicProvider($db,(string)($_GET['id']??''))]);
    if($method==='GET'&&$route==='category')respond(['data'=>sqfCategoryPage($db,(string)($_GET['id']??''),(string)($_GET['city']??''))]);
    if($method==='GET'&&$route==='catalog')respond(['data'=>sqfCatalog($db,(string)($_GET['city']??''))]);
    if($method==='GET'&&$route==='media/read'){
      $actor=sqfSessionUser($db,$_SESSION);
      $kind=(string)($_GET['kind']??'');$id=(string)($_GET['id']??'');
      if(!$actor&&!in_array($kind,['avatar','portfolio'],true))respond(['error'=>'Autenticação necessária'],401);
      $actor=$actor??'';
      $staff=(int)($_SESSION['staff_mfa_until']??0)>time();
      $path=sqfPrivateImagePath($db,$actor,$kind,$id,$staff);
      header('Content-Type: image/webp');header('Content-Disposition: inline; filename="arquivo.webp"');
      header('X-Frame-Options: DENY');header('Content-Length: '.filesize($path));
      readfile($path);exit;
    }
    if($method!=='POST')respond(['error'=>'Rota indisponível'],404);
    if(!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))respond(['error'=>'CSRF inválido'],403);
    if($route==='media/upload'){
      $actor=sqfSessionUser($db,$_SESSION);
      if(!$actor)respond(['error'=>'Autenticação necessária'],401);
      $file=$_FILES['file']??null;
      if(!is_array($file)||($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||!is_string($file['tmp_name']??null))throw new DomainException('Arquivo não recebido');
      $bytes=sqfImagePayload($file['tmp_name'],(int)$file['size']);
      $id=sqfSavePrivateImage($db,$actor,(string)($_POST['kind']??''),(string)($_POST['context']??''),$bytes,(string)($_POST['caption']??''));
      respond(['data'=>['id'=>$id]],201);
    }
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
          sqfMailConfig();
          try{$result=sqfRegister($db,$email,required($body,'password'),required($body,'name'),required($body,'account_type'),isset($body['city_ibge'])?required($body,'city_ibge'):null);sqfAuthMail($email,$result['token'],'verify');}
          catch(PDOException $e){if($e->getCode()!=='23000')throw $e;}
          respond(['message'=>'Se a conta estiver disponível, confira o e-mail para confirmar.'],202);
        case 'login':
          $identity=sqfLogin($db,$email,required($body,'password'));session_regenerate_id(true);
          $_SESSION=['id'=>$identity['id'],'auth_version'=>$identity['auth_version'],'csrf'=>bin2hex(random_bytes(32))];
          respond(['user_id'=>$identity['id'],'csrf'=>$_SESSION['csrf']]);
        case 'request-reset':
        case 'resend-verification':
          sqfMailConfig();
          $purpose=$route==='request-reset'?'reset':'verify';
          $token=sqfRequestAuthToken($db,$email,$purpose);
          if($token!==null)try{sqfAuthMail($email,$token,$purpose);}catch(Throwable $e){error_log('SQF mail delivery failed');}
          respond(['message'=>'Se houver conta elegível, confira o e-mail.'],202);
        case 'verify':sqfConsumeToken($db,required($body,'token'),'verify');respond(['ok'=>true]);
        case 'reset':sqfConsumeToken($db,required($body,'token'),'reset',required($body,'password'));respond(['ok'=>true]);
      }
    }
    $actor=sqfSessionUser($db,$_SESSION);
    if(!$actor)respond(['error'=>'Autenticação necessária'],401);
    if($route==='staff/mfa'){
      sqfRequireStaff($db,$actor);
      sqfAuthLimit($db,'staff-mfa:'.$actor,5,300);
      $secrets=json_decode(getenv('SQF_STAFF_TOTP_SECRETS')?:'{}',true,32,JSON_THROW_ON_ERROR);
      sqfStaffMfa($db,$actor,required($body,'code'),(string)($secrets[$actor]??''),time());
      session_regenerate_id(true);$_SESSION['staff_mfa_until']=time()+600;
      respond(['ok'=>true]);
    }
    if(str_starts_with($route,'staff/')){
      sqfRequireStaff($db,$actor);
      if((int)($_SESSION['staff_mfa_until']??0)<=time())respond(['error'=>'MFA administrativo obrigatório'],403);
      if($route==='staff/metrics')respond(['data'=>sqfStaffMetrics($db,$actor)]);
      if($route==='staff/billing')respond(['data'=>sqfStaffBilling($db,$actor)]);
      if($route==='staff/providers')respond(['data'=>sqfStaffProviders($db,$actor)]);
      if($route==='staff/provider/decide'){sqfStaffProviderDecide($db,$actor,required($body,'id'),required($body,'status'),required($body,'note'));respond(['ok'=>true]);}
      if($route==='staff/cases')respond(['data'=>sqfStaffCases($db,$actor)]);
      if($route==='staff/case/decide'){sqfStaffCaseDecide($db,$actor,required($body,'kind'),required($body,'id'),required($body,'status'),required($body,'note'));respond(['ok'=>true]);}
      if($route==='staff/documents')respond(['data'=>sqfStaffDocuments($db,$actor)]);
      if($route==='staff/document/decide'){sqfStaffDocumentDecide($db,$actor,required($body,'id'),required($body,'status'),required($body,'note'));respond(['ok'=>true]);}
      if($route==='staff/review-cases')respond(['data'=>sqfStaffReviewCases($db,$actor)]);
      if($route==='staff/review-case/decide'){sqfStaffReviewCaseDecide($db,$actor,required($body,'type'),required($body,'id'),required($body,'status'),required($body,'note'));respond(['ok'=>true]);}
      if($route==='staff/reviews')respond(['data'=>sqfStaffQueue($db,$actor)]);
      if($route==='staff/review/decide'){sqfReviewModerate($db,$actor,required($body,'id'),required($body,'status'),required($body,'note'));respond(['ok'=>true]);}
      respond(['error'=>'Rota administrativa indisponível'],404);
    }
    if($route==='review-cases')respond(['data'=>sqfOwnReviewCases($db,$actor)]);
    if($route==='review/response'){sqfReviewResponse($db,$actor,required($body,'id'),required($body,'message'));respond(['ok'=>true]);}
    if($route==='review/dispute')respond(['data'=>sqfReviewDispute($db,$actor,required($body,'id'),required($body,'reason'),required($body,'details'))]);
    if($route==='reviews')respond(['data'=>sqfOwnReviews($db,$actor)]);
    if($route==='review/create')respond(['data'=>sqfReviewCreate($db,$actor,required($body,'request_id'),number($body,'rating'),required($body,'comment'))]);
    if($route==='media/list')respond(['data'=>sqfListPrivateMedia($db,$actor,required($body,'kind'),isset($body['request_id'])?required($body,'request_id'):null)]);
    if($route==='favorites/providers')respond(['data'=>sqfClientFavorites($db,$actor)]);
    if($route==='favorite/provider'){if(!isset($body['saved'])||!is_bool($body['saved']))throw new DomainException('Estado inválido');sqfSetFavorite($db,$actor,required($body,'provider_id'),$body['saved']);respond(['ok'=>true]);}
    if($route==='profile/view'){sqfRecordView($db,$actor,required($body,'provider_id'));respond(['ok'=>true]);}
    if($route==='performance')respond(['data'=>sqfProviderMetrics($db,$actor)]);
    if($route==='quotes/compare')respond(['data'=>sqfCompareQuotes($db,$actor)]);
    if($route==='favorites/categories')respond(['data'=>sqfFavoriteCategories($db,$actor)]);
    if($route==='favorite/category'){if(!isset($body['saved'])||!is_bool($body['saved']))throw new DomainException('Estado inválido');sqfFavoriteCategory($db,$actor,required($body,'category_id'),$body['saved']);respond(['ok'=>true]);}
    if($route==='billing/checkout'){sqfAuthLimit($db,'billing:'.$actor,5,900);respond(['data'=>sqfCreateCheckout($db,$actor,required($body,'cycle'),'sqfMpWrite')]);}
    if($route==='billing/cancel'){sqfAuthLimit($db,'billing:'.$actor,5,900);sqfCancelSubscription($db,$actor,'sqfMpWrite');respond(['ok'=>true]);}
    if($route==='billing/cycle'){if(getenv('SQF_MP_CHECKOUT_ENABLED')!=='1')throw new DomainException('Operação desativada');respond(['data'=>sqfRequestCycle($db,$actor,required($body,'cycle'))]);}
    if($route==='billing')respond(['data'=>sqfOwnBilling($db,$actor)]);
    if($route==='account/export'){sqfAuthLimit($db,'privacy-export:'.$actor,3,3600);respond(['data'=>sqfOwnPrivacyExport($db,$actor)]);}
    if($route==='account/security')respond(['data'=>sqfAccountSecurity($db,$actor)]);
    if(in_array($route,['account/password','account/revoke-sessions'],true)){
      sqfAuthLimit($db,'account-security:'.$actor,5,900);
      $current=required($body,'current_password');
      if($route==='account/password')sqfChangePassword($db,$actor,$current,required($body,'new_password'));
      else sqfRevokeSessions($db,$actor,$current);
      $_SESSION=[];session_regenerate_id(true);respond(['ok'=>true]);
    }
    if($route==='notification/preference'){if(!isset($body['email_enabled'])||!is_bool($body['email_enabled']))throw new DomainException('Preferência inválida');sqfNotificationPreference($db,$actor,$body['email_enabled']);respond(['ok'=>true]);}
    if($route==='notification/read'){sqfReadNotification($db,$actor,required($body,'id'));respond(['ok'=>true]);}
    if($route==='verification')respond(['data'=>sqfVerificationStatus($db,$actor)]);
    if($route==='cases')respond(['data'=>sqfOwnCases($db,$actor)]);
    if($route==='case/create')respond(['data'=>sqfCreateCase($db,$actor,required($body,'kind'),required($body,'type'),required($body,'message'))]);
    if($route==='professional')respond(['data'=>sqfProfessionalDetails($db,$actor)]);
    if($route==='professional/save'){sqfSaveProfessionalDetails($db,$actor,$body);respond(['ok'=>true]);}
    if($route==='portfolio/manage'){sqfManagePortfolio($db,$actor,required($body,'id'),required($body,'action'));respond(['ok'=>true]);}
    if($route==='services')respond(['data'=>sqfOwnServices($db,$actor)]);
    if($route==='service/save'){
      $id=isset($body['id'])?required($body,'id'):null;
      $minimum=isset($body['price_min_cents'])?number($body,'price_min_cents'):null;
      $maximum=isset($body['price_max_cents'])?number($body,'price_max_cents'):null;
      respond(['data'=>sqfSaveService($db,$actor,$id,required($body,'category_id'),required($body,'service_title'),required($body,'description'),$minimum,$maximum)]);
    }
    if($route==='service/toggle'){
      if(!isset($body['is_active'])||!is_bool($body['is_active']))throw new DomainException('Estado inválido');
      sqfToggleService($db,$actor,required($body,'id'),$body['is_active']);respond(['ok'=>true]);
    }
    if($route==='profile/update'){
      $name=trim(required($body,'full_name'));$bio=trim(required($body,'bio'));$code=isset($body['city_ibge'])?required($body,'city_ibge'):null;
      if(mb_strlen($name)<2||mb_strlen($name)>120||mb_strlen($bio)>1500)throw new DomainException('Perfil inválido');
      $city='';if($code!==null){$m=sqfQuery($db,'SELECT name,uf FROM sqf_ibge_municipalities WHERE code=?',[$code])->fetch(PDO::FETCH_ASSOC);if(!$m)throw new DomainException('Município inválido');$city=$m['name'].' - '.$m['uf'];}
      sqfQuery($db,'UPDATE profiles SET full_name=?,bio=?,city=?,city_ibge=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',[$name,$bio,$city,$code,$actor]);respond(['ok'=>true]);
    }
    if($route==='profile')respond(['data'=>sqfQuery($db,'SELECT id,full_name,account_type,city,city_ibge,bio,CASE WHEN avatar_path IS NULL THEN 0 ELSE 1 END AS has_avatar FROM profiles WHERE id=?',[$actor])->fetch(PDO::FETCH_ASSOC)]);
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
