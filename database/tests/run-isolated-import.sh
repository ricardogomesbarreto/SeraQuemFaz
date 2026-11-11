#!/usr/bin/env bash
# Execute only against an existing, disposable MySQL/MariaDB schema. No DDL, no cleanup of user files.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${SQF_DB_DSN:?Configure a disposable MySQL/MariaDB database DSN}"
: "${SQF_DB_USER:?Configure a database-scoped user}"
: "${SQF_DB_PASSWORD:?Configure the test database password}"

if [[ "${SQF_IMPORT_STAGING_ENABLED:-}" != "1" || "${SQF_IMPORT_STAGING_DATABASE:-}" != "sqf_import_stage" ]]; then
  echo "Refusing persistent import: set SQF_IMPORT_STAGING_ENABLED=1 and SQF_IMPORT_STAGING_DATABASE=sqf_import_stage" >&2
  exit 2
fi
if [[ "${SQF_PRIVATE_MEDIA_ROOT:-}" != "/tmp/sqf-import-stage-media" ]]; then
  echo "Refusing staging media outside the dedicated temporary fixture directory" >&2
  exit 2
fi
if [[ -e "$SQF_PRIVATE_MEDIA_ROOT" || -L "$SQF_PRIVATE_MEDIA_ROOT" ]]; then
  echo "Staging media fixture directory must be absent before the test" >&2
  exit 2
fi

php -r '
require "backend/src/Database.php";
$db=sqfDatabase();
$schema=(string)$db->query("SELECT DATABASE()")->fetchColumn();
if($schema!=="sqf_import_stage")throw new RuntimeException("Refusing non-disposable schema");
if((int)$db->query("SELECT COUNT(*) FROM sqf_auth_users")->fetchColumn()!==0)throw new RuntimeException("Destination is not empty");
if((int)$db->query("SELECT COUNT(*) FROM profiles")->fetchColumn()!==0)throw new RuntimeException("Profiles already exist");
if((int)$db->query("SELECT COUNT(*) FROM categories WHERE status=\x27active\x27")->fetchColumn()!==51)throw new RuntimeException("Import public catalog before testing");
if((int)$db->query("SELECT COUNT(*) FROM sqf_ibge_municipalities")->fetchColumn()<5500)throw new RuntimeException("Municipalities seed missing");
echo "PASS: isolated staging schema and catalog verified\n";
'

SQF_TEST_ISOLATED_IMPORT_STAGE=1 php database/tests/snapshot-integration.php
php database/tests/integrity.php
echo "PASS: persisted fictional import, row/media reconciliation, rollback checks and FK integrity"
echo "INFO: fixture media retained at $SQF_PRIVATE_MEDIA_ROOT for independent restore validation"
