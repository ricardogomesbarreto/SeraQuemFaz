#!/usr/bin/env bash
# Read-only verification of a manually restored, disposable MySQL/MariaDB database and private media.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${SQF_DB_DSN:?Set DSN for sqf_import_stage}"
: "${SQF_DB_USER:?Set database-scoped user}"
: "${SQF_DB_PASSWORD:?Set database password}"
: "${SQF_RESTORE_DSN:?Set DSN for sqf_import_restore}"
: "${SQF_PRIVATE_MEDIA_ROOT:?Set original private media directory}"
: "${SQF_RESTORE_MEDIA_ROOT:?Set restored private media directory}"

php -r '
require "backend/src/Database.php";
$src=sqfDatabase();
if((string)$src->query("SELECT DATABASE()")->fetchColumn()!=="sqf_import_stage")throw new RuntimeException("Source must be isolated staging");
$restore=new PDO(getenv("SQF_RESTORE_DSN"),getenv("SQF_DB_USER"),getenv("SQF_DB_PASSWORD"),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if((string)$restore->query("SELECT DATABASE()")->fetchColumn()!=="sqf_import_restore")throw new RuntimeException("Restore target must be isolated");
echo "PASS: separate disposable source and restore schemas\n";
'

php database/tests/restore-check.php
php database/tests/media-restore.php
echo "PASS: recovered schema, content digests and private media SHA256 match"
