#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT}/package.json').version")"
DIST="${ROOT}/dist"
STAGING="${DIST}/.staging"
SITE="SeraQuemFaz-site-v${VERSION}"
SOURCE="SeraQuemFaz-v${VERSION}"
command -v zip >/dev/null || { echo 'O comando zip é necessário.' >&2; exit 1; }
command -v unzip >/dev/null || { echo 'O comando unzip é necessário.' >&2; exit 1; }
rm -rf "${STAGING}"
mkdir -p "${STAGING}/${SITE}" "${STAGING}/${SOURCE}"
# Deploy estático: somente páginas e recursos necessários no servidor web.
for page in "${ROOT}"/*.html; do cp "${page}" "${STAGING}/${SITE}/"; done
cp -a "${ROOT}/assets" "${STAGING}/${SITE}/assets"
for file in .htaccess _headers .nojekyll manifest.webmanifest service-worker.js; do
  if [[ -e "${ROOT}/${file}" ]]; then cp "${ROOT}/${file}" "${STAGING}/${SITE}/"; fi
done
# Código completo: histórico, documentação, SQL, testes, CI, mas nunca segredos/artifacts.
tar -C "${ROOT}" -cf - \
  --exclude='./dist' --exclude='./.artifacts' --exclude='./node_modules' \
  --exclude='./.git' --exclude='./.env' --exclude='./.env.local' \
  --exclude='./__pycache__' --exclude='*.pyc' --exclude='*.log' . \
  | tar -C "${STAGING}/${SOURCE}" -xf -
# Cada pacote possui raiz própria e nomes estáveis para o GitHub Release.
mkdir -p "${DIST}"
rm -f "${DIST}/SeraQuemFaz_site_v${VERSION}.zip" "${DIST}/SeraQuemFaz_codigo_v${VERSION}.zip"
(
  cd "${STAGING}"
  zip -qr "${DIST}/SeraQuemFaz_site_v${VERSION}.zip" "${SITE}"
  zip -qr "${DIST}/SeraQuemFaz_codigo_v${VERSION}.zip" "${SOURCE}"
)
unzip -tq "${DIST}/SeraQuemFaz_site_v${VERSION}.zip" >/dev/null
unzip -tq "${DIST}/SeraQuemFaz_codigo_v${VERSION}.zip" >/dev/null
rm -rf "${STAGING}"
echo "PACOTES OK: ${DIST}/SeraQuemFaz_site_v${VERSION}.zip e ${DIST}/SeraQuemFaz_codigo_v${VERSION}.zip"
