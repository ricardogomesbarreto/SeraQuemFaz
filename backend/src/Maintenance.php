<?php
declare(strict_types=1);
require_once __DIR__.'/Marketplace.php';

// Bounded cleanup, no deletion of accounts, transactions, media or business records.
function sqfCleanupAuth(PDO $db,int $batch=200):array {
    if($batch<1||$batch>500)throw new DomainException('Lote inválido');
    $lock='sqf-maint-'.substr(hash('sha256',(string)$db->query('SELECT DATABASE()')->fetchColumn()),0,40);
    if((int)sqfQuery($db,'SELECT GET_LOCK(?,0)',[$lock])->fetchColumn()!==1)return ['busy'=>true,'tokens'=>0,'limits'=>0];
    try{
        return sqfTxn($db,function()use($db,$batch){
            $tokens=$db->exec('DELETE FROM sqf_auth_tokens WHERE expires_at<UTC_TIMESTAMP(6) ORDER BY expires_at LIMIT '.$batch);
            $limits=$db->exec('DELETE FROM sqf_auth_limits WHERE expires_at<UTC_TIMESTAMP(6) ORDER BY expires_at LIMIT '.$batch);
            return ['busy'=>false,'tokens'=>$tokens,'limits'=>$limits];
        });
    }finally{sqfQuery($db,'SELECT RELEASE_LOCK(?)',[$lock]);}
}
