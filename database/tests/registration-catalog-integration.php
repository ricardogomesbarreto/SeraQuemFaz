<?php
declare(strict_types=1);
/**
 * Disposable DB integration: registration, verification, approval and city-aware discovery.
 * SMTP is simulated in memory. No real users, emails, payment or production data are touched.
 */
require_once __DIR__.'/../../backend/src/Database.php';
require_once __DIR__.'/../../backend/src/Auth.php';
require_once __DIR__.'/../../backend/src/Services.php';
require_once __DIR__.'/../../backend/src/Category.php';
require_once __DIR__.'/../../backend/src/AccountCases.php';
require_once __DIR__.'/../../backend/src/CatalogDiagnostics.php';
require_once __DIR__.'/../../backend/src/Mail.php';
$db=sqfDatabase();
function assertFlow(bool $ok,string $label):void {if(!$ok)throw new RuntimeException($label);echo "PASS: ".$label."\n";}
function blocked(callable $fn,string $label):void {try{$fn();}catch(DomainException $e){assertFlow(true,$label);return;}throw new RuntimeException($label);}
$city='2109908'; // Santa Inês, Maranhão (official IBGE municipality code).
$other='2111300'; // São Luís, Maranhão.
$location=sqfQuery($db,'SELECT name,uf FROM sqf_ibge_municipalities WHERE code=?',[$city])->fetch(PDO::FETCH_ASSOC);
assertFlow($location!==false&&$location['name']==='Santa Inês'&&$location['uf']==='MA','IBGE municipality identifies Santa Inês (MA) accurately');
$random=bin2hex(random_bytes(6));
$clientEmail="flow-client-$random@example.invalid";
$providerEmail="flow-provider-$random@example.invalid";
$clientPassword='ci-client-password-2026';
$providerPassword='ci-provider-password-2026';
$client=sqfRegister($db,$clientEmail,$clientPassword,'Cliente Fluxo Regional','cliente',$city);
$provider=sqfRegister($db,$providerEmail,$providerPassword,'Prestador Fluxo Regional','prestador',$city);
assertFlow(strlen($client['id'])===36&&strlen($provider['id'])===36,'distinct client and provider accounts registered');
assertFlow($db->query('SELECT COUNT(*) FROM sqf_auth_users')->fetchColumn()>=2,'accounts persisted in MySQL');
assertFlow(!sqfQuery($db,'SELECT 1 FROM sqf_auth_tokens WHERE token_hash=?',[$client['token']])->fetchColumn(),'raw email tokens never stored in database');
$captured=[];
foreach([[$clientEmail,$client['token']],[$providerEmail,$provider['token']]] as [$recipient,$token]){
    $message=sqfMailMessage('sender@example.invalid',$recipient,'Código de confirmação','Código de confirmação: '.$token);
    assertFlow(str_contains($message,'To: '.$recipient),"mail envelope generated for synthetic recipient");
    $captured[$recipient]=$token;
}
blocked(fn()=>sqfLogin($db,$clientEmail,$clientPassword),'unconfirmed client cannot log in');
blocked(fn()=>sqfLogin($db,$providerEmail,$providerPassword),'unconfirmed provider cannot log in');
sqfConsumeToken($db,$captured[$clientEmail],'verify');
assertFlow(sqfLogin($db,$clientEmail,$clientPassword)['id']===$client['id'],'client confirmation and login work');
$category=(string)sqfQuery($db,"SELECT id FROM categories WHERE status='active' ORDER BY name LIMIT 1")->fetchColumn();
assertFlow($category!=='','active service category available');
$service=sqfSaveService($db,$provider['id'],null,$category,'Serviço regional de homologação','Atendimento simulado para validar filtros do catálogo',null,null);
assertFlow(strlen($service)===36,'provider saves active service before public approval');
assertFlow(count(sqfCatalog($db,$city))===0,'unconfirmed and unapproved provider stays hidden in selected city');
sqfConsumeToken($db,$captured[$providerEmail],'verify');
assertFlow(sqfLogin($db,$providerEmail,$providerPassword)['id']===$provider['id'],'provider confirmation and login work');
assertFlow(count(sqfCatalog($db,$city))===0,'verified but unapproved provider is not exposed');
$admin='00000000-0000-4000-8000-000000000099';
$before=sqfStaffCatalogDiagnostics($db,$admin,$city);
assertFlow($before['verification_pending']>=1&&$before['visible']===0,'administration detects pending provider without public exposure');
blocked(fn()=>sqfStaffCatalogDiagnostics($db,$client['id'],$city),'client cannot access regional administrative diagnostics');
$doc=(string)$db->query('SELECT UUID()')->fetchColumn();
// Synthetic accepted identity document for disposable CI only: no physical identity photo.
sqfQuery($db,"INSERT INTO sqf_verification_documents(id,provider_id,document_kind,storage_path,status) VALUES (?,?,'identity_evidence',?,'accepted')",
  [$doc,$provider['id'],$provider['id'].'/'.$doc.'.webp']);
sqfStaffProviderDecide($db,$admin,$provider['id'],'approved','Documento fictício aceito apenas durante teste isolado de homologação.');
$found=sqfCatalog($db,$city);
assertFlow(count($found)===1&&$found[0]['id']===$provider['id'],'approved provider appears in client-requested municipality');
assertFlow(!in_array($provider['id'],array_column(sqfCatalog($db,$other),'id'),true),'provider from Santa Inês never leaks into São Luís search');
$bundle=sqfCategoryPage($db,$category,$city);
assertFlow($bundle!==null&&count($bundle['profiles'])===1&&$bundle['profiles'][0]['id']===$provider['id'],'category displays approved provider with active matching service');
assertFlow(!in_array($provider['id'],array_column(sqfCategoryPage($db,$category,$other)['profiles'],'id'),true),'category listing respects requested city');
assertFlow(sqfPublicProvider($db,$provider['id'])['city_ibge']===$city,'public provider page retains municipality ID');
$after=sqfStaffCatalogDiagnostics($db,$admin,$city);
assertFlow($after['visible']===1&&$after['visible_categories']>=1,'administrative diagnostics match public catalog');
sqfToggleService($db,$provider['id'],$service,false);
assertFlow(count(sqfCatalog($db,$city))===0,'provider without an active service is omitted from client catalog');
sqfToggleService($db,$provider['id'],$service,true);
assertFlow(count(sqfCatalog($db,$city))===1,'reactivated service restores provider visibility');
echo "PASS: complete synthetic signup -> confirmation -> approved provider -> regional catalog/profile flow\n";
