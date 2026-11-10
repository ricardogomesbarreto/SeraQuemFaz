<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
require __DIR__.'/../../backend/src/Marketplace.php';
$db=sqfDatabase();
$categories=json_decode(file_get_contents(__DIR__.'/categories.json'),true,512,JSON_THROW_ON_ERROR);
$cities=json_decode(file_get_contents(__DIR__.'/../../assets/municipios-br.json'),true,512,JSON_THROW_ON_ERROR);
if(!is_array($categories)||!is_array($cities)||count($categories)<1||count($cities)<5500)throw new RuntimeException('Dados públicos incompletos');
sqfTxn($db,function()use($db,$categories,$cities){
  $city=$db->prepare('INSERT INTO sqf_ibge_municipalities(code,name,uf,ibge_uf) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),uf=VALUES(uf),ibge_uf=VALUES(ibge_uf)');
  foreach($cities as $m){
    if(!preg_match('/^[0-9]{7}$/D',$m['id'])||!preg_match('/^[A-Z]{2}$/D',$m['uf']))throw new RuntimeException('Município inválido');
    $city->execute([$m['id'],$m['name'],$m['uf'],(int)substr($m['id'],0,2)]);
  }
  $category=$db->prepare('INSERT INTO categories(id,name,description,image_url,status) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE description=VALUES(description),image_url=VALUES(image_url),status=VALUES(status)');
  foreach($categories as $c)$category->execute([$c['id'],$c['name'],$c['description'],$c['image_url'],$c['status']]);
  $db->exec('INSERT INTO sqf_billing_settings(singleton,require_paid_subscription,checkout_enabled) VALUES (1,0,0) ON DUPLICATE KEY UPDATE singleton=singleton');
});
echo 'Public seed: '.count($categories).' categories and '.count($cities)." municipalities\n";
