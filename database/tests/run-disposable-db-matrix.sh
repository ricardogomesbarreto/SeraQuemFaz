#!/usr/bin/env bash
# Local-only, disposable MySQL 8.0 / MariaDB 10.11 compatibility check.
# No production hosts, deploy, GitHub Actions, payments or real user data.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ "${1:-}" != "--apply-fixtures" ]]; then
  echo "Usage: bash database/tests/run-disposable-db-matrix.sh --apply-fixtures" >&2
  echo "This initializes ONLY the named localhost Docker fixtures and their sqf_test/sqf_import_stage databases." >&2
  exit 2
fi

command -v docker >/dev/null || { echo "Docker is required on the local test computer" >&2; exit 2; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required" >&2; exit 2; }
command -v node >/dev/null || { echo "Node.js is required" >&2; exit 2; }
command -v php >/dev/null || { echo "PHP CLI is required" >&2; exit 2; }
php -r 'foreach(["pdo_mysql","mbstring"] as $ext)if(!extension_loaded($ext)){fwrite(STDERR,"Missing PHP extension: ".$ext."\n");exit(2);}'

compose="database/tests/compose.mysql-mariadb.local.yml"
build_dir="$PWD/dist/local-db-matrix"
mkdir -p "$build_dir"
node database/hostinger/build-install.mjs "$build_dir"
sql="$build_dir/01-instalar-banco.sql"
test -s "$sql" || { echo "Consolidated SQL missing" >&2; exit 2; }
for filename in 001 002 003 004 005 006 007 008 009 010; do
  grep -q -- "-- ${filename}_" "$sql" || { echo "Migration ${filename} missing in consolidated SQL" >&2; exit 2; }
done

# Fixed, publicly documented synthetic credentials; never accept external DB hostnames.
export SQF_DB_USER="sqf_fixture"
export SQF_DB_PASSWORD="sqf_fixture_password_local_only"
docker compose -f "$compose" up -d --wait mysql80 mariadb1011

check_empty() {
  php -r '
    $db=new PDO(getenv("SQF_DB_DSN"),getenv("SQF_DB_USER"),getenv("SQF_DB_PASSWORD"),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $schema=(string)$db->query("SELECT DATABASE()")->fetchColumn();
    if(!in_array($schema,["sqf_test","sqf_import_stage"],true))throw new RuntimeException("Unexpected schema");
    $count=(int)$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()")->fetchColumn();
    if($count!==0)throw new RuntimeException("Refusing a nonempty fixture database: ".$schema);
  '
}
install_sql() {
  local service="$1" schema="$2"
  if [[ "$service" == mysql80 ]]; then
    docker compose -f "$compose" exec -T mysql80 sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=tcp -h127.0.0.1 -u"$MYSQL_USER" "$1"' -- "$schema" < "$sql"
  else
    docker compose -f "$compose" exec -T mariadb1011 sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" mariadb --protocol=tcp -h127.0.0.1 -u"$MARIADB_USER" "$1"' -- "$schema" < "$sql"
  fi
}
for spec in "mysql80:13306" "mariadb1011:13311"; do
  service="${spec%%:*}"
  port="${spec##*:}"
  echo "== ${service}: initial schema and local integration tests =="
  for schema in sqf_test sqf_import_stage; do
    export SQF_DB_DSN="mysql:host=127.0.0.1;port=${port};dbname=${schema};charset=utf8mb4"
    check_empty
    install_sql "$service" "$schema"
  done
  export SQF_DB_DSN="mysql:host=127.0.0.1;port=${port};dbname=sqf_test;charset=utf8mb4"
  php -r '
    require "backend/src/Database.php";
    $db=sqfDatabase();$version=(string)$db->query("SELECT VERSION()")->fetchColumn();
    $target=getenv("SQF_LOCAL_ENGINE");
    if($target==="mysql80"&&!preg_match("/^8\\.0\\./",$version))throw new RuntimeException("Expected MySQL 8.0, got ".$version);
    if($target==="mariadb1011"&&!preg_match("/^10\\.11\\.[0-9]+.*MariaDB/i",$version))throw new RuntimeException("Expected MariaDB 10.11, got ".$version);
    echo "PASS: isolated ".$version." on sqf_test\n";
  ' SQF_LOCAL_ENGINE="$service"
  php database/tests/integrity.php
  php database/tests/agenda-integration.php
  php database/tests/auth-integration.php
  php database/tests/index-inventory.php
  php database/tests/engagement-integrity.php
  echo "PASS: ${service} schema 001-010 and local transaction/auth/review/index checks"
done

echo "PASS: local fixture matrix completed on MySQL 8.0 and MariaDB 10.11."
echo "Import/media and restore checks require the separately documented isolated staging runners."
echo "Containers are still running for inspection. To stop and discard ONLY these tmpfs fixtures:"
echo "  docker compose -f ${compose} down"
