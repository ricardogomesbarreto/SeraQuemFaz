<?php
declare(strict_types=1);
// Read-only production/staging preflight. No user data, passwords, token or SMTP mail is emitted.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(is_file(__DIR__.'/../../config.php'))require __DIR__.'/../../config.php';
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/Mail.php';
require_once __DIR__.'/../src/Marketplace.php';
$report=[
  'check'=>'sera-quem-faz-onboarding',
  'database_connected'=>false,
  'municipalities_ready'=>false,
  'categories_ready'=>false,
  'mail_transport_configured'=>false,
  'regional_catalog_query_ready'=>false,
  'visible_in_santa_ines_ma'=>false,
  'any_public_provider_with_service'=>false,
  'ready_for_registration'=>false,
  'mail_delivery_proven'=>false
];
try {sqfMailConfig();$report['mail_transport_configured']=true;}
catch(Throwable $e){/* Fail closed; no exception or secret is printed. */}
try {
  $db=sqfDatabase();
  $report['database_connected']=true;
  $report['municipalities_ready']=(int)$db->query('SELECT COUNT(*) FROM sqf_ibge_municipalities')->fetchColumn()>=5500;
  $report['categories_ready']=(int)$db->query("SELECT COUNT(*) FROM categories WHERE status='active'")->fetchColumn()>=51;
  $predicate=sqfPublicPredicate();
  $query='SELECT 1 FROM profiles p JOIN provider_verifications v ON v.provider_id=p.id WHERE '. $predicate .
     ' AND EXISTS(SELECT 1 FROM provider_services s WHERE s.provider_id=p.id AND s.is_active=1)';
  $report['any_public_provider_with_service']=sqfQuery($db,$query.' LIMIT 1')->fetchColumn()!==false;
  $report['visible_in_santa_ines_ma']=sqfQuery($db,$query.' AND p.city_ibge=? LIMIT 1',['2109908'])->fetchColumn()!==false;
  $report['regional_catalog_query_ready']=true;
}catch(Throwable $e){/* Diagnostic cannot read business data: no stacktrace or secrets. */}
$report['ready_for_registration']=$report['database_connected']&&$report['municipalities_ready']&&
    $report['categories_ready']&&$report['mail_transport_configured'];
echo json_encode($report,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR).PHP_EOL;
// Note: mail_delivery_proven=false until an actual authorized email is received and confirmed.
