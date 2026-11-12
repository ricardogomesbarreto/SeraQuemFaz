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
scope="${SQF_LOCAL_ENGINE:-}"
if [[ -n "$scope" && "$scope" != mysql80 && "$scope" != mariadb1011 ]]; then
  echo "Invalid local engine scope" >&2
  exit 2
fi
expected_root="/tmp/sqf-import${scope:+-$scope}-stage-media"
if [[ "${SQF_PRIVATE_MEDIA_ROOT:-}" != "$expected_root" ]]; then
  echo "Refusing staging media outside the dedicated temporary fixture directory: $expected_root" >&2
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
$version=(string)$db->query("SELECT VERSION()")->fetchColumn();
if(!preg_match("/^8[.]0[.][0-9]+/",$version)&&!preg_match("/^10[.]11[.][0-9]+.*MariaDB/i",$version))
    throw new RuntimeException("Only MySQL 8.0 and MariaDB 10.11 are supported in the conversion matrix");
if((string)$db->query("SELECT @@character_set_connection")->fetchColumn()!=="utf8mb4")
    throw new RuntimeException("Connection must use utf8mb4");
if((string)$db->query("SELECT @@session.time_zone")->fetchColumn()!=="+00:00")
    throw new RuntimeException("Connection must use UTC");
if((int)$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type=\x27BASE TABLE\x27 AND engine<>\x27InnoDB\x27")->fetchColumn()!==0)
    throw new RuntimeException("Transactional InnoDB tables required");
if((int)$db->query("SELECT COUNT(*) FROM sqf_auth_users")->fetchColumn()!==0)throw new RuntimeException("Destination is not empty");
if((int)$db->query("SELECT COUNT(*) FROM profiles")->fetchColumn()!==0)throw new RuntimeException("Profiles already exist");
if((int)$db->query("SELECT COUNT(*) FROM categories WHERE status=\x27active\x27")->fetchColumn()!==51)throw new RuntimeException("Import public catalog before testing");
if((int)$db->query("SELECT COUNT(*) FROM sqf_ibge_municipalities")->fetchColumn()<5500)throw new RuntimeException("Municipalities seed missing");
echo "PASS: isolated staging schema and catalog verified\n";
'

SQF_TEST_ISOLATED_IMPORT_STAGE=1 php database/tests/snapshot-integration.php
php database/tests/integrity.php
php database/tests/engagement-integrity.php
echo "PASS: persisted fictional import, row/media reconciliation, rollback checks, engagement integrity and FK integrity"
echo "INFO: fixture media retained at $SQF_PRIVATE_MEDIA_ROOT for independent restore validation"
