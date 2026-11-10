<?php
declare(strict_types=1);
// Private CLI only. Does not reveal passwords, paths, DSN or personal records.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../src/Database.php';
require __DIR__.'/../src/PrivateMedia.php';
$root=dirname(__DIR__,2);
if(is_file($root.'/config.php'))require $root.'/config.php';
$checks=[];
$checks['php_8_1_plus']=PHP_VERSION_ID>=80100;
foreach(['pdo_mysql','mbstring','gd','fileinfo','curl','openssl','session'] as $extension)$checks['extension_'.$extension]=extension_loaded($extension);
$checks['argon2id']=defined('PASSWORD_ARGON2ID');
$checks['webp']=function_exists('imagecreatefromwebp')&&function_exists('imagewebp');
$public=realpath(dirname($root).'/public_html');
$private=realpath($root);
$checks['separate_public_private']=$public!==false&&$private!==false&&$public!==$private&&!str_starts_with($private,$public.DIRECTORY_SEPARATOR);
$checks['public_api_entry']=$public!==false&&is_file($public.'/api/index.php');
$checks['private_config']=is_file($root.'/config.php')||getenv('SQF_PREFLIGHT_CI')==='1';
try{
    $media=sqfMediaRoot();
    $checks['private_media']=$public!==false&&$media!==$public&&!str_starts_with($media,$public.DIRECTORY_SEPARATOR)&&is_writable($media);
}catch(Throwable $e){$checks['private_media']=false;}
try{
    $db=sqfDatabase();
    $version=(string)$db->query('SELECT VERSION()')->fetchColumn();
    $checks['database_connected']=true;
    $checks['tested_database_family']=preg_match('/^8\\.0\\./',$version)===1||preg_match('/^10\\.11\\..*MariaDB/i',$version)===1;
    $checks['database_utc']=$db->query('SELECT @@session.time_zone')->fetchColumn()==='+00:00';
    $checks['catalog_ready']=(int)$db->query("SELECT COUNT(*) FROM categories WHERE status='active'")->fetchColumn()>=51;
    $checks['municipalities_ready']=(int)$db->query('SELECT COUNT(*) FROM sqf_ibge_municipalities')->fetchColumn()>=5500;
    $checks['checkout_disabled']=(int)$db->query('SELECT checkout_enabled FROM sqf_billing_settings WHERE singleton=1')->fetchColumn()===0;
}catch(Throwable $e){$checks['database_connected']=false;}
$checks['live_webhook_disabled']=getenv('SQF_MP_WEBHOOK_ENABLED')!=='1';
$checks['live_notifications_disabled']=getenv('SQF_NOTIFICATIONS_ENABLED')!=='1';
$ok=!in_array(false,$checks,true);
echo json_encode(['plan'=>'Hostinger Unlimited','ready_for_staging'=>$ok,'production_approved'=>false,'checks'=>$checks],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;
exit($ok?0:1);
