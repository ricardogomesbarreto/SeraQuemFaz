# Publicação no GitHub — SERÁ QUEM FAZ? v3.9.4

**Estado neste pacote:** código preparado localmente. Nenhum repositório remoto, commit, tag, GitHub Actions ou release foi publicado por este processo.

O nome visual da aplicação é **SERÁ QUEM FAZ?**. O identificador recomendado do repositório é **`SeraQuemFaz`** (sem `?`, caractere inválido para o nome de repositórios GitHub). Conta de destino: `ricardogomesbarreto`.

## Opção A — um comando assistido no seu Ubuntu

Instale e autentique o GitHub CLI (`gh`) e configure seu autor Git. Dentro da pasta do projeto, rode:

```bash
gh auth login
git config --global user.name 'Seu nome de commit'
git config --global user.email 'seu-email-verificado-do-github'
bash scripts/publicar-github.sh
```

O script cria **um repositório privado** se ele ainda não existir, evita forçar commits e envia `main` e a tag atual do `package.json` (`v3.9.4`). Você pode tornar o repositório público depois de confirmar os direitos de publicação dos arquivos.

## Opção B — GitHub pelo navegador

1. Abra https://github.com/new e crie `ricardogomesbarreto/SeraQuemFaz` **vazio**, sem README nem `.gitignore` iniciais (os arquivos já existem). Escolha visibilidade privada inicialmente.
2. Descompacte o ZIP, abra o terminal no diretório do projeto e execute:

```bash
git init -b main
git add .
git commit -m 'fix: stabilize SERÁ QUEM FAZ? v3.9.4'
git remote add origin https://github.com/ricardogomesbarreto/SeraQuemFaz.git
git push -u origin main
git tag -a v3.9.4 -m 'SERÁ QUEM FAZ? v3.9.4'
git push origin v3.9.4
```

**Não use `git push --force`.** Se o repositório já existir e tiver commits, integre as alterações por branch/PR antes de enviar `main`.

## Depois de publicar

- Acesse **Actions** e confira os jobs Node 22/24; habilite as permissões do `GITHUB_TOKEN` necessárias para publicar releases, caso deseje utilizar o workflow de tag.
- Configure proteção de `main` com revisão de PR e checks obrigatórios após a primeira CI bem-sucedida.
- Configure `Settings → Pages` (GitHub Pages, branch `main`, pasta `/`) se desejar usar hospedagem estática.
- Atualize o projeto Supabase para aceitar o domínio do Pages nas URLs de redirecionamento Auth; aplique migrações **apenas após homologação**.
- Revise autoria, licença, uso de imagens, termos e políticas de privacidade antes de disponibilizar publicamente.


### Segurança de publicação da v3.8.0

O ZIP já inclui a pasta `supabase/functions/sqf-billing` e a migração SQL.
**Não envie** `.env`, chaves Mercado Pago nem `SUPABASE_SERVICE_ROLE_KEY` ao GitHub. Publicar o código não implanta nem ativa cobranças.
Leia `docs/financeiro/INTEGRACAO-MERCADO-PAGO-v3.8.0.md` e configure os segredos diretamente no painel/CLI do Supabase.
O repositório GitHub remoto **não foi modificado nesta sessão**.

## Publicação da v3.9.0

- Publicar em **repositório próprio** `ricardogomesbarreto/SeraQuemFaz` após criação e confirmação da permissão de gravação; não utilizar o repositório colaborativo antigo.
- Executar `npm run verify` e revisar os patches SQL antes de PR e merge.
- Nova migração: `supabase/migrations/20261104_09_solicitacoes_mensagens.sql`. **Não** executar diretamente em produção.
- O workflow `.github/workflows/billing-reconciliation.yml` exige segredos `SQF_RECONCILE_URL` / `SQF_RECONCILE_SECRET` e variável `SQF_FINANCIAL_RECONCILIATION_ENABLED=true`. Enquanto essa variável não estiver configurada, o job é ignorado.
- Planejar backfill/upgrade do Supabase de homologação, auditoria RLS, ambiente de teste Mercado Pago e revisão por pull request antes da tag `v3.9.0`.
- A conexão do GitHub desta sessão não confirmou a existência do repositório privado próprio. Nenhuma publicação remota foi realizada.

## Complemento v3.9.4

- O script `scripts/publicar-github.sh` lê a versão de `package.json`, executa `npm run verify` e **não força** substituição da branch ou das tags.
- Antes de criar release, inclua a migração 10 em uma PR, com backup e revisão do plano de aplicação no Supabase de homologação.
- Os testes Node/Chromium utilizam dados simulados e não validam RLS real nem Mercado Pago.
- Este ZIP **não** executa publicação automática. O repositório e as credenciais GitHub devem ser verificados pelo operador.


## Distribuição a partir da v3.9.7

Execute `npm run verify` e `npm run build:dist`. São criados dois ZIPs em `dist/`:

- `SeraQuemFaz_site_vX.Y.Z.zip`: somente páginas HTML, assets e arquivos de cabeçalhos do servidor web. **Este é o pacote para a hospedagem estática**.
- `SeraQuemFaz_codigo_vX.Y.Z.zip`: código-fonte completo, SQL, CI, testes, documentação e histórico. **Não publique seu conteúdo integral como arquivos públicos no servidor**.

O workflow `.github/workflows/release.yml` foi atualizado para anexar ambos os pacotes. Nada é publicado no GitHub automaticamente por rodar o comando local.
