<?php
declare(strict_types=1);
// Read-only check of per-request engagements and review ownership.
// Run against an authorized, disposable MySQL 8.0 / MariaDB 10.11 database.
require __DIR__.'/../../backend/src/Database.php';
$db=sqfDatabase();
$schema=(string)$db->query('SELECT DATABASE()')->fetchColumn();
if(!in_array($schema,['sqf_test','sqf_import_stage','sqf_import_restore'],true))
    throw new RuntimeException('Use only a disposable conversion-test schema');
$column=sqfQuery($db,"SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='service_engagements' AND column_name='source_request_id'")->fetchColumn();
if((int)$column!==1)throw new RuntimeException('Migration 010 not applied');
$ambiguous=(int)$db->query("SELECT COUNT(*) FROM (SELECT engagement_id FROM sqf_service_requests WHERE engagement_id IS NOT NULL GROUP BY engagement_id HAVING COUNT(*)>1) AS duplicates")->fetchColumn();
$invalid=(int)$db->query("SELECT COUNT(*) FROM service_engagements e LEFT JOIN sqf_service_requests r ON r.id=e.source_request_id WHERE e.source_request_id IS NOT NULL AND (r.id IS NULL OR r.engagement_id IS NULL OR r.engagement_id<>e.id OR r.client_id<>e.client_id OR r.provider_id<>e.provider_id OR r.status<>'completed')")->fetchColumn();
$unlinked=(int)$db->query("SELECT COUNT(*) FROM sqf_service_requests WHERE status='completed' AND engagement_id IS NULL")->fetchColumn();
$reviewMismatch=(int)$db->query("SELECT COUNT(*) FROM reviews v JOIN service_engagements e ON e.id=v.engagement_id WHERE v.reviewer_id<>e.client_id OR v.provider_id<>e.provider_id")->fetchColumn();
$historical=(int)$db->query("SELECT COUNT(*) FROM service_engagements WHERE source_request_id IS NULL")->fetchColumn();
echo 'INFO: historical engagements without explicit request ID: '.$historical.PHP_EOL;
echo 'INFO: ambiguous legacy request mappings: '.$ambiguous.PHP_EOL;
if($ambiguous||$invalid||$unlinked||$reviewMismatch)
    throw new RuntimeException('Engagement integrity requires reconciliation: ambiguous='.$ambiguous.', invalid='.$invalid.', unlinked='.$unlinked.', review_mismatch='.$reviewMismatch);
echo 'PASS: distinct completed requests and review ownership are coherent; no ambiguous mappings'.PHP_EOL;
