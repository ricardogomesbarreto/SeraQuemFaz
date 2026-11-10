<?php
declare(strict_types=1);
require __DIR__.'/../../backend/src/Database.php';
$db=sqfDatabase();
function verify(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);echo "PASS: $message\n";}
function ident(string $value):string{return "`".str_replace("`","``",$value)."`";}
verify((int)$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE' AND engine<>'InnoDB'")->fetchColumn()===0,'all tables use transactional InnoDB');
verify((int)$db->query("SELECT COUNT(*) FROM categories WHERE status='active'")->fetchColumn()===51,'51 active categories preserved');
verify((int)$db->query("SELECT COUNT(*) FROM sqf_ibge_municipalities")->fetchColumn()>=5500,'Brazilian municipality dataset present');
$rows=$db->query("SELECT constraint_name,table_name,column_name,referenced_table_name,referenced_column_name FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND referenced_table_name IS NOT NULL ORDER BY table_name,constraint_name,ordinal_position")->fetchAll(PDO::FETCH_ASSOC);
$groups=[];foreach($rows as $row)$groups[$row['table_name'].':'.$row['constraint_name']][]=$row;
verify(count($groups)>=63,'foreign key inventory present');
foreach($groups as $name=>$parts){
 $first=$parts[0];$join=[];$nonnull=[];
 foreach($parts as $p){$join[]='c.'.ident($p['column_name']).'=p.'.ident($p['referenced_column_name']);$nonnull[]='c.'.ident($p['column_name']).' IS NOT NULL';}
 $sql='SELECT COUNT(*) FROM '.ident($first['table_name']).' c LEFT JOIN '.ident($first['referenced_table_name']).' p ON '.implode(' AND ',$join).' WHERE '.implode(' AND ',$nonnull).' AND p.'.ident($first['referenced_column_name']).' IS NULL';
 verify((int)$db->query($sql)->fetchColumn()===0,'no orphan: '.$name);
}
verify((int)$db->query("SELECT COUNT(*) FROM profiles p LEFT JOIN sqf_auth_users u ON u.id=p.id WHERE u.id IS NULL")->fetchColumn()===0,'profiles have matching identities');
verify((int)$db->query("SELECT COUNT(*) FROM sqf_auth_tokens WHERE token_hash IS NULL OR CHAR_LENGTH(token_hash)<>64")->fetchColumn()===0,'token hashes have expected length');
