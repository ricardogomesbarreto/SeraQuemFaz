# Atualizacao automatica da Hostinger (homologacao)

Este projeto usa duas pastas irmas: `public_html/` (publica) e `sqf-private/` (privada). **Nao conecte a branch `main` ao diretorio `public_html` pela integracao Git direta**, pois a raiz do repositorio inclui codigo do backend, SQL, documentacao e testes. O fluxo preparado em `.github/workflows/deploy-hostinger-staging.yml` monta a distribuicao correta e sincroniza apenas os arquivos apropriados por SSH/rsync.

O workflow esta **desativado por padrao**. A variavel `HOSTINGER_AUTO_DEPLOY_ENABLED` deve ser criada com valor `true` pelo titular, apos configurar e conferir todo o restante. Nenhuma publicacao remota foi realizada durante a criacao do workflow.

## Preparar a Hostinger

1. Abra o hPanel do site de homologacao `deeppink-hawk-778631.hostingersite.com`. Em **Avancado > Acesso SSH**, habilite SSH e anote, no seu computador, host, porta, usuario e *fingerprint* da chave do servidor.
2. No Ubuntu, gere uma chave exclusiva para deploy: `ssh-keygen -t ed25519 -f ~/.ssh/sqf_hostinger_deploy -C sqf-hostinger-staging`. Proteja a chave privada. Cadastre **somente a chave publica** `~/.ssh/sqf_hostinger_deploy.pub` na Hostinger (Acesso SSH > chaves publicas).
3. Confirme por SSH o caminho real do site (pode ser diferente do `/files/` mostrado no gerenciador). Ele deve terminar em `/deeppink-hawk-778631.hostingersite.com` e conter `public_html/`, `sqf-private/` e `sqf-private/config.php`.
4. Com o Gerenciador de Arquivos, crie um arquivo vazio **`.sqf-staging-deploy`** na mesma pasta de `public_html/`. Este marcador e obrigatorio para evitar deploy no dominio errado. Nao o crie dentro de `public_html`.
5. Obtenha a entrada `known_hosts` via `ssh-keyscan -p PORTA HOST` **e confira a fingerprint** em relacao ao hPanel antes de confiar nela. Jamais desligue `StrictHostKeyChecking`.

## Preparar o GitHub

Abra **Settings > Secrets and variables > Actions**, no repositorio `ricardogomesbarreto/SeraQuemFaz`.

**Variables** (nao sao credenciais):
- `HOSTINGER_SSH_HOST`: hostname/IP SSH mostrado no hPanel.
- `HOSTINGER_SSH_PORT`: porta SSH mostrada no hPanel.
- `HOSTINGER_SSH_USER`: usuario SSH mostrado no hPanel.
- `HOSTINGER_SITE_ROOT`: caminho absoluto real ate a pasta do subdominio, **sem barra final**.

**Secrets** (nao devem aparecer em commits, capturas nem mensagens):
- `HOSTINGER_SSH_PRIVATE_KEY`: conteudo da chave privada de deploy gerada no Ubuntu.
- `HOSTINGER_SSH_KNOWN_HOSTS`: entrada SSH do servidor obtida e verificada como descrito acima.

Ao final, crie a variavel `HOSTINGER_AUTO_DEPLOY_ENABLED` = `true` e execute manualmente **Actions > Deploy seguro - Hostinger homologacao > Run workflow** para conferir a primeira implantacao. A partir de entao, commits na branch `main` que afetem o site/backend acionarao o deploy automaticamente.

## Regras de seguranca

- O job so executa se a variavel de habilitacao for `true`.
- O caminho deve ser o do subdominio de homologacao e conter o marcador `.sqf-staging-deploy`; falha antecipadamente se nao houver o marcador ou `config.php`.
- O build produz apenas HTML, CSS, JS, imagens, regras publicas, entrada `api/index.php` e backend PHP **privado**. Nunca envia a raiz bruta do GitHub.
- Nunca envia ou sobrescreve `sqf-private/config.php` nem `sqf-private/media/`. Nao usa `rsync --delete`.
- Nunca aplica migracoes SQL automaticamente, nao restaura backups, nao altera usuario do banco e nao ativa pagamentos, SMTP ou cron.
- A publicacao na homologacao nao constitui aprovacao de producao; o teste final inclui autenticacao, SMTP, permissao, media privada, responsive, logs, migracao e rollback.
- Antes de habilitar, confira o backup de arquivos e banco. Se o deploy falhar depois da copia, o site pode ficar parcialmente atualizado; usar a copia e os logs para recuperar.
- Alteracoes apenas em `docs/` ou testes nao disparam deploy; alteracoes em arquivos de runtime da landing, API e backend disparam.
- Para publicar a producao no futuro, criar outra configuracao e gates formais; nao reutilizar as credenciais de homologacao.

## Observacao sobre o Git nativo da Hostinger

A Hostinger oferece OAuth do GitHub em **Avancado > Git**. Esse recurso publica o repositorio selecionado no diretorio escolhido. Na arquitetura deste projeto, **a integracao direta da `main` com `public_html` e insegura**. O workflow SSH permite conservar a separacao publica/privada e a configuracao local sem versionar credenciais.
