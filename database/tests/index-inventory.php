<?php
declare(strict_types=1);
// Local MySQL/MariaDB diagnostics: metadata and EXPLAIN only, no writes or personal values.
require __DIR__.'/../../backend/src/Database.php';
$db=sqfDatabase();
$version=(string)$db->query('SELECT VERSION()')->fetchColumn();
$indexes=[
 'sqf_request_messages'=>['ix_sqf_messages_request_time'=>['request_id','created_at','id']],
 'sqf_service_requests'=>['ix_sqf_requests_open_lookup'=>['client_id','provider_id','service_id','created_at']],
 'reviews'=>[
  'ix_sqf_reviews_provider_status_time'=>['provider_id','moderation_status','created_at','id'],
  'ix_sqf_reviews_moderation_queue'=>['moderation_status','created_at','id'],
 ],
];
$inspect=$db->prepare('SELECT column_name,seq_in_index,sub_part FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? ORDER BY seq_in_index');
foreach($indexes as $table=>$definitions){
 foreach($definitions as $name=>$columns){
  $inspect->execute([$table,$name]);
  $actual=$inspect->fetchAll(PDO::FETCH_ASSOC);
  if(array_column($actual,'column_name')!==$columns)throw new RuntimeException('Missing or incomplete database index: '.$name);
  foreach($actual as $entry){
   if($entry['column_name']==='moderation_status'&&(int)$entry['sub_part']!==16)throw new RuntimeException('Unexpected moderation status prefix: '.$name);
  }
  echo 'PASS: '.$table.'.'.$name.' ('.count($columns).' columns)'.PHP_EOL;
 }
}
$sample='00000000-0000-4000-8000-000000000001';
$plans=[
 ['request messages','EXPLAIN SELECT id,sender_id,body,created_at FROM sqf_request_messages WHERE request_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[$sample]],
 ['duplicate request lookup',"EXPLAIN SELECT id FROM sqf_service_requests WHERE client_id=? AND provider_id=? AND service_id=? AND status NOT IN ('completed','declined','canceled') AND created_at>UTC_TIMESTAMP(6)-INTERVAL 48 HOUR LIMIT 1",[$sample,$sample,$sample]],
 ['public provider reviews',"EXPLAIN SELECT id FROM reviews WHERE provider_id=? AND moderation_status='published' ORDER BY created_at DESC LIMIT 100",[$sample]],
 ['pending review moderation',"EXPLAIN SELECT id FROM reviews WHERE moderation_status='pending' ORDER BY created_at LIMIT 100",[]],
];
foreach($plans as [$name,$sql,$params]){
 $stmt=$db->prepare($sql);$stmt->execute($params);
 $plan=$stmt->fetch(PDO::FETCH_ASSOC);
 if(!$plan)throw new RuntimeException('EXPLAIN unavailable: '.$name);
 echo 'PLAN: '.$name.' | index='.(string)($plan['key']??'none').' | access='.(string)($plan['type']??'unknown').PHP_EOL;
}
// On an empty fixture the optimizer may choose a table scan; do not claim latency or index usage without representative data.
echo 'PASS: index definitions and read-only EXPLAIN diagnostics on '.$version.PHP_EOL;
