#!/usr/bin/env bash
# Local-only verification. Never creates databases, alters schema, deploys or sends payments.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v node >/dev/null || { echo "Node.js is required" >&2; exit 2; }
command -v php >/dev/null || { echo "PHP CLI is required" >&2; exit 2; }

echo "== Static MySQL/MariaDB source audit =="
node database/audit/verify-mysql.mjs
echo "== Node.js unit tests (no network/database) =="
node --test tests/*.test.cjs
echo "== PHP syntax validation =="
while IFS= read -r -d '' file; do
  php -l "$file" >/dev/null
done < <(find backend database -type f -name '*.php' -print0)
echo "PASS: source audit, Node unit tests and PHP syntax"

# Explicit opt-in: metadata read and EXPLAIN against user's isolated test database.
if [[ "${SQF_WITH_DB:-0}" == 1 ]]; then
  : "${SQF_DB_DSN:?Set the DSN of an isolated MySQL/MariaDB schema}"
  : "${SQF_DB_USER:?Set its limited database user}"
  : "${SQF_DB_PASSWORD:?Set its database password}"
  php -r 'if(!extension_loaded("pdo_mysql")){fwrite(STDERR,"pdo_mysql unavailable\n");exit(2);}'
  php database/tests/index-inventory.php
  echo "PASS: isolated index inventory and EXPLAIN diagnostics"
else
  echo "INFO: database tests not executed; set SQF_WITH_DB=1 against an isolated schema to include read-only EXPLAIN"
fi
