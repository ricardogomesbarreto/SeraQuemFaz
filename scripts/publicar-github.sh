#!/usr/bin/env bash
set -euo pipefail

OWNER="ricardogomesbarreto"
REPO="SeraQuemFaz"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v gh >/dev/null || { echo 'Instale GitHub CLI (gh) antes de publicar.' >&2; exit 1; }
command -v git >/dev/null || { echo 'Git é necessário.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js >=22 é necessário.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm é necessário.' >&2; exit 1; }
VERSION="v$(node -p "require('./package.json').version")"
echo "Versão local: ${VERSION}. Executando verificações antes de preparar o Git..."
npm run verify
gh auth status >/dev/null || { echo 'Autentique com gh auth login.' >&2; exit 1; }
[ -n "$(git config user.name || true)" ] && [ -n "$(git config user.email || true)" ] || { echo 'Configure git user.name e user.email com sua identidade.' >&2; exit 1; }

if [ ! -d .git ]; then git init -b main; fi
if [ -z "$(git rev-parse --verify HEAD 2>/dev/null || true)" ]; then
  git add .
  git commit -m "fix: stabilize SERÁ QUEM FAZ? ${VERSION}"
elif [ -n "$(git status --porcelain)" ]; then
  echo 'Há alterações locais. Revise e crie um commit antes de publicar.' >&2; exit 1
fi

if ! gh repo view "${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo 'Criando repositório PRIVADO. Revise direitos de publicação antes de torná-lo público.'
  gh repo create "${OWNER}/${REPO}" --private --description 'SERÁ QUEM FAZ? — plataforma para encontrar profissionais e serviços por cidade' --disable-wiki
fi
REMOTE="https://github.com/${OWNER}/${REPO}.git"
if git remote get-url origin >/dev/null 2>&1; then
  if [ "$(git remote get-url origin)" != "$REMOTE" ]; then
    echo 'A origem não corresponde ao repositório de destino; interrompendo sem alterar a origem.' >&2; exit 1
  fi
else
  git remote add origin "$REMOTE"
fi
git push -u origin main
if git rev-parse -q --verify "refs/tags/${VERSION}" >/dev/null; then
  echo "A tag ${VERSION} já existe localmente; não foi reescrita."
else
  git tag -a "$VERSION" -m "SERÁ QUEM FAZ? ${VERSION}"
fi
git push origin "$VERSION"
echo "Publicação solicitada: https://github.com/${OWNER}/${REPO}"
