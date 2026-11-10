# Banco de dados — Será Quem Faz?

## Instalação na Hostinger

**Entrada recomendada:** [`hostinger/README.md`](hostinger/README.md). Gere o SQL único com `node database/hostinger/build-install.mjs` na raiz do repositório. O resultado fica em `dist/hostinger/01-instalar-banco.sql`, com `SHA256SUMS`; a CI publica o artefato de homologação e testa a importação em MySQL 8.0 e MariaDB 10.11. Nunca importe em um banco não vazio. A configuração de exemplo fica em `hostinger/config.example.php` e deve ser copiada para fora da raiz pública.

## Estrutura

- `mysql/migrations/002_auth.sql`: identidade local, tokens e limitação de tentativas.
- `mysql/migrations/001_schema.sql`: instalação limpa em MySQL 8.0.16+ e MariaDB 10.11; candidato, não executar sobre o banco atual.
- `legacy/supabase-contracts.json`: inventário de RPCs e políticas RLS do PostgreSQL, sem dados pessoais.
- `tests/agenda-integration.php`: fixtures sintéticas e testes de integração da agenda, catálogo e contratação.
- `../backend/src/`: conexão PDO e serviços transacionais.

O diretório legado `supabase/` permanece intacto até o corte de produção. O frontend atual usa Supabase; os serviços PHP ainda não estão conectados a todas as telas.

## Instalação isolada

Criar um banco vazio e um usuário próprio. Importar o SQL consolidado para Hostinger ou, em desenvolvimento, `mysql/migrations/001_schema.sql`, `002_auth.sql` e `003_staff_mfa.sql` em ordem, pelo cliente mysql/mariadb ou painel de administração. Nunca importar sobre o banco de produção. Usar UTF-8 e UTC. No ambiente PHP, definir `SQF_DB_DSN=mysql:host=127.0.0.1;dbname=sqf_test;charset=utf8mb4`, `SQF_DB_USER` e `SQF_DB_PASSWORD` apenas no servidor. PHP 8.1+, PDO MySQL, Argon2id e mbstring.

Executar `php database/tests/agenda-integration.php` e `php database/tests/auth-integration.php` exclusivamente em banco de testes vazio. A CI usa MySQL 8.0 e MariaDB 10.11.

## Decisões de compatibilidade

- UUID textual ASCII, JSON para jsonb/arrays, DATETIME(6) UTC, DECIMAL para valores numéricos e centavos inteiros para preços.
- Identidades de logs/eventos em AUTO_INCREMENT; IDs UUID mantidos na migração.
- Chaves estrangeiras incompatíveis com CHECK no MySQL usam RESTRICT; exclusão exige operação explícita transacional, inclusive tratamento de fotos vinculadas a serviço.
- PostgreSQL EXCLUDE convertido em serviço transacional; toda escrita de agenda deve passar por esse serviço.
- RLS não existe em MySQL/MariaDB. Não expor SQL, credenciais ou API genérica de tabelas ao navegador.
- Contas de origem precisam de migração segura de identidade e recuperação de senha; nenhum hash ou token foi exportado.

## Gates antes do corte

1. Instalação limpa e testes nos dois engines.
2. Implementar autenticação, recuperação, MFA administrativo e autorização por recurso; portar RPCs, políticas, gatilhos e views com testes de paridade.
3. Conectar todas as telas à API; substituir SDK Supabase e Storage, preservar identidade visual.
4. Exportar dados e objetos privados em ambiente autorizado, reconciliar IDs, contagens, integridade e hashes; não versionar dados pessoais.
5. Homologar catálogo, perfis, mensagens, avaliações, agenda, administração, notificações, PWA e faturamento sandbox. Checkout real permanece desabilitado.
6. Backup, restauração, teste de rollback, revisão LGPD e aceite formal. Só então desativar Supabase e publicar a versão.

Não utilizar o candidato como sistema comercial. Nenhum dado remoto foi alterado.

## API candidata e autenticação

`backend/public/index.php` expõe somente rotas explícitas. Configure o servidor para servir esse arquivo como `/api/index.php` (alias para backend/public, mantendo backend/src e database fora do document root). Não publicar o repositório inteiro. O cliente candidato `assets/mysql-api-client.js` utiliza a mesma origem e CSRF; as páginas existentes ainda não foram trocadas. `SQF_MAIL_FROM` e um transporte de e-mail funcional são necessários para cadastro, recuperação e confirmação. HTTPS obrigatório; `SQF_ALLOW_INSECURE_LOCAL=1` é exclusivo do teste loopback. As sessões exigem e-mail confirmado, cookies HttpOnly, SameSite Strict e versão de autenticação. MFA administrativo, entrega real de e-mail, migração de identidades, proteção adicional contra abuso e homologação das telas permanecem gates.

## Homologação de interface e dados públicos

- `database/seed/import-public.php`: importar categorias ativas com IDs de origem e o snapshot de municípios do IBGE já versionado. Execute após as duas migrações em ambiente isolado. Não contém contas, fotos ou outros dados pessoais.
- `assets/backend-mode.js`: definir `mysql` exclusivamente na homologação. Cadastro, login, recuperação e categorias usam a API candidata nesse modo.
- `painel-mysql.html`: painel temporário dos dois papéis; perfil, solicitações, propostas, mensagens, agenda e notificações. Ainda não equivale ao painel principal: avaliações, portfólio, verificação, favoritos e gestão administrativa não foram portados.
- A CI testa importação, autenticação, HTTP e lint dos scripts; a homologação visual e entrega real de e-mail ainda são obrigatórias.

## Módulo de serviços profissionais

`backend/src/Services.php` implementa consultas públicas de perfis aprovados, listagem privada de serviços do proprietário, cadastro/edição e ativação/desativação sem exclusão de histórico. Os endpoints da API são `GET provider?id=<uuid>` e POST `services`, `service/save`, `service/toggle`. A interface candidata fica em `painel-mysql.html` / `assets/mysql-dashboard.js`. Todas as escritas verificam a titularidade com identidade derivada da sessão, jamais por `provider_id` enviado pelo cliente. Testes de isolamento foram adicionados em `database/tests/agenda-integration.php`.

A página atual de produção permanece no modo Supabase. O painel MySQL é apenas para homologação e não substitui ainda a experiência completa dos painéis antigos.

## Moderação e MFA administrativo (homologação)

Aplique também `mysql/migrations/003_staff_mfa.sql`. `backend/src/Moderation.php` implementa avaliação vinculada a atendimento concluído, respostas, contestações e decisões auditadas. A página `admin-mysql.html` exige papel ativo, sessão válida e MFA TOTP recente (10 minutos), com limitação de tentativas e bloqueio de reutilização. Provisionamento de funcionários deve ser feito por operador autorizado, fora da aplicação, após validação da identidade; não existe conta administrativa padrão. Configure `SQF_STAFF_TOTP_SECRETS` exclusivamente no servidor como objeto JSON `{<uuid>: <segredo hexadecimal aleatório de pelo menos 20 bytes>}`; associe o mesmo segredo, convertido em Base32, ao autenticador da pessoa por canal seguro. Não versionar segredos nem dados de usuários. A configuração e rotação reais, MFA ponta a ponta no navegador, verificação de documentos e aprovação de profissionais permanecem gates antes da produção. Não habilitar aprovação automática.

## Armazenamento privado MySQL/MariaDB (candidato)

- `backend/src/PrivateMedia.php`: anexo de solicitação e documento de verificação com WebP validado, decodificado e recodificado por GD (máximo 5 MB, 4.000 × 4.000 px).
- `backend/public/index.php?route=media/upload`: POST multipart autenticado com token CSRF; campos `kind` (`verification` ou `attachment`), `context` (tipo de documento ou UUID de solicitação), `file` e legenda opcional.
- `media/list`: POST JSON autenticado com `kind` e, para anexos, `request_id`. Retorna metadados limitados à titularidade ou participantes.
- `media/read`: GET autenticado com `kind` e `id`; não entrega caminhos físicos ou URLs públicas. Documentos de verificação são acessíveis ao proprietário ou equipe autenticada com MFA administrativo recente; anexos apenas aos participantes da solicitação.
- `SQF_PRIVATE_MEDIA_ROOT` deve apontar para pasta privada existente, gravável, **fora da árvore do repositório e do document root**; recomendar diretório exclusivo com proprietário do processo PHP, permissões 0700/0600. Nunca fazer commit dos arquivos de usuários. Backups criptografados, retenção LGPD e migração/varredura de mídia legada continuam pendentes.
- `database/tests/private-media-integration.php`: teste de isolamento e integridade no MySQL e MariaDB. Não substitui teste de navegador, avaliação de segurança de uploads, privacidade e restauração real.

### Estado desta etapa

A tela candidata `painel-mysql.html` permite ao prestador enviar e consultar seus próprios documentos de verificação. Não existe aprovação automática de documentos. Ainda falta a interface administrativa de análise dos documentos, portfólio público, anexos no fluxo principal de mensagens e migração dos arquivos do Storage Supabase.

### Moderação documental com MFA

A equipe ativa com MFA recente consulta `staff/documents` e decide via `staff/document/decide` (id, status `accepted` ou `rejected`, justificativa de 20–1000 caracteres). Cada operação bloqueia a linha, impede segunda decisão, rejeita decisão pelo proprietário e grava auditoria em `sqf_staff_decision_log`. A fila de `admin-mysql.html` expõe o arquivo somente através da rota privada com autenticação e MFA. Aceitar o documento **não altera** `provider_verifications.status`; não existe aprovação automática de prestadores. A análise jurídica/operacional dos documentos, LGPD, retenção e verificação da pessoa no mundo real continuam pendentes.

### Portfólio, avatar e anexos — nova etapa

O mesmo armazenamento externo serve avatar (contexto `self`), portfólio (UUID de serviço pertencente ao prestador) e anexos (UUID de solicitação). Upload por sessão e CSRF, WebP, JPEG ou PNG até 5 MB, normalizados para WebP pelo servidor. O avatar do cliente fica restrito ao proprietário. Avatar de prestador e foto de portfólio são públicos apenas quando o profissional satisfaz a regra de publicação; portfólio exige também serviço ativo. A leitura resolve o caminho real dentro da raiz privada e não retorna caminhos físicos. Os metadados públicos são fornecidos por `provider`; `media/read` permite anonimato somente para avatar e portfólio elegíveis.

O painel candidato oferece foto de perfil, portfólio, anexos de atendimento e visualização do portfólio na busca do cliente. `database/tests/private-media-integration.php` inclui cenários de isolamento, desativação de serviços e suspensão de prestadores. Permanecem pendentes a validação ampliada dos formatos JPEG/PNG no navegador, gestão completa de exclusão/capa e retenção de arquivos antigos, limites por conta, migração do Storage legado e homologação responsiva em navegador.

### Homologação de navegador e consistência referencial

A CI MySQL/MariaDB executa `database/tests/integrity.php` antes e depois da suíte de navegador, inspecionando chaves estrangeiras reais via information_schema (nomes de colunas normalizados), procurando registros órfãos, verificando InnoDB, dados públicos e identidades. O teste é feito em banco descartável, **não** constitui reconciliação de dados reais do Supabase.

`database/tests/browser-router.php` serve somente HTML e assets copiados para uma raiz temporária e roteia a API candidata; o modo MySQL é ativado apenas nessa cópia. `browser-integration.mjs` testa Chromium nas larguras 360/390/768/1366, login, cadastro de serviço, busca e solicitação de orçamento em sessões independentes, navegação pública e logout. A CI #182 revelou diferença de caixa nos metadados MySQL e timeout do login no navegador MariaDB; normalização e diagnóstico de API/coalescência de sessão foram adicionados. Só considerar homologação do navegador após CI aprovada nos dois bancos.
