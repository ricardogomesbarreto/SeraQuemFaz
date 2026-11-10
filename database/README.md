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

## Categorias, favoritos e perfil público MySQL

`backend/src/Category.php` fornece a página de categoria por município, incluindo apenas prestadores elegíveis com serviços ativos da categoria, detalhes profissionais, avaliações publicadas e fotos de serviços ativos. `categoria.html` preserva sua apresentação e filtros no modo MySQL; o perfil candidato `prestador-mysql.html` usa a API PHP para serviços, avatar, portfólio, avaliações e orçamento. Favoritos de categoria são privados ao cliente autenticado, limitados a 30, com gravação idempotente e remoção por titular. A suíte Chromium cobre navegação, favoritos e perfil público, além dos quatro tamanhos de tela. A CI #216 aprovou a etapa anterior em ambos bancos; a nova suíte precisa passar antes do aceite.

**Regra de publicação:** nenhum deploy na Hostinger ou substituição do banco de produção antes de 100% da conversão e homologação, reconciliação de dados/arquivos reais, segurança e backup/restauração. O modo legado permanece padrão até o corte formal.

## Informações profissionais e gestão de portfólio

`backend/src/Professional.php` implementa leitura e atualização dos detalhes profissionais pelo titular prestador: título, especialidades, experiência, modalidade, cobertura, dias/período de atendimento, política de orçamento e endereço HTTPS. O perfil público elegível recebe detalhes profissionais; o painel candidato permite edição de serviços existentes e seleção/exclusão de fotos do portfólio. A escolha de capa é transacional e exclusiva por prestador; a exclusão revoga acesso pelos metadados antes de remover o arquivo gerado. A limpeza de arquivos legados e eventual falha de unlink exige procedimento operacional de reconciliação. A raiz de mídia também é validada contra o document root real.

Testes PHP de autorização, validação e capa/exclusão, e Chromium de edição de serviço e dados profissionais foram acrescentados. A CI #241 aprovou a etapa anterior; a nova suíte deve passar nos dois engines antes de declarar homologação. A Hostinger permanece fora do escopo até 100% de conversão e aceite.

## Auditoria do repositório e gate de publicação

Inventário da revisão: árvore Git completa da branch de migração, 343 entradas antes das alterações desta etapa. A CI #261 aprovou MySQL 8.0 e MariaDB 10.11. O script `database/audit/inventory.mjs` gera inventário de referências Supabase/PostgreSQL/MySQL, separando código de execução, validação e legado. A CI de migração executa também `npm run verify` e publica o inventário. O resultado é triagem textual, não prova de ausência de dependências. A CI #280 encontrou dois testes de contrato da página de categoria; a apresentação passou a carregar separadamente da lista de prestadores e o roteamento preserva os dois modos.

`backend/src/AccountCases.php` e a API implementam verificação cadastral, fila de prestadores, decisões auditadas e solicitações privadas de suporte/LGPD. O cadastro cria verificação pendente; a migration 004 preenche lacunas nas instalações candidatas sem alterar decisões. Aprovação exige identidade aceita; suspensão remove visibilidade pública. A fila de suporte/privacidade exige administrador e MFA; pedidos pertencem ao titular. Resolução de solicitação não executa automaticamente exclusão, correção ou exportação de dados. O painel e a administração candidatos foram integrados. Novos testes ainda devem ser aprovados integralmente.

### Pendências verificadas

- Paridade de `painel.html`, `prestador.html`, `admin.html`: navegação e módulos ainda carregam Supabase; candidatos MySQL não equivalem a todas as funcionalidades.
- `assets/account-security.js`, `marketplace-hub.js`, `admin-finance.js` e relatórios: segurança da conta, preferências, indicadores, notificações e financeiro ainda usam contratos legados.
- Faturamento/assinaturas, conciliação e e-mail: workflows legados e Edge Functions Supabase não foram substituídos; não ativar checkout ou serviços reais.
- Migração de identidades/dados/arquivos reais, reconciliação, testes de restauração e rollback, LGPD operacional e revisão de segurança.
- CI PostgreSQL e fontes legadas permanecem por compatibilidade durante homologação. Não removê-las antes do corte e validação de paridade; nenhum deploy na Hostinger até 100% de conversão.

## v3.14.0-rc.1 — segurança da conta e notificações

Versão candidata de homologação, identificada em `candidate-version.json`; não é release de produção. `backend/src/AccountSecurity.php` fornece leitura de e-mail confirmado, alteração de senha com verificação da senha atual, revogação de todas as sessões por incremento de auth_version, preferências de e-mail e marcação de notificações próprias como lidas. As operações de senha têm limite de tentativas; hashes Argon2id, tokens de recuperação invalidados na troca de senha e novo login obrigatório. O painel MySQL integra os formulários. A preferência de e-mail não ativa entrega real; SMTP e notificações assíncronas seguem pendentes.

A CI #289 aprovou integralmente a etapa anterior, incluindo a auditoria geral. Os testes novos de PHP e Chromium devem ser aprovados nos dois bancos. A versão do frontend legado permanece inalterada. Nenhum deploy, tag comercial ou corte de produção antes de 100% de conversão e homologação.

## v3.14.0-rc.2 — financeiro candidato

`backend/src/Billing.php` implementa leitura da assinatura e histórico pelo prestador, resumo agregado para administrador com MFA, vigência derivada de faturas aprovadas e reconciliação transacional interna de snapshots verificados. O método de reconciliação não é exposto em rota HTTP; não há integração externa ativa. O checkout permanece indisponível, sem cobrança real. Testes sintéticos cobrem preço divergente, repetição de fatura, cancelamento com preservação de vigência, estorno, expiração e autorização. O painel candidato e a administração mostram dados do banco. Preços existentes preservados: R$ 14,90 mensal e R$ 149,00 anual.

Pendências: cliente Mercado Pago e validação da assinatura de webhook, consulta autenticada de pagamento/fatura, idempotência/reconciliação externa, mudança de ciclo conforme contrato, testes sandbox, e-mail, paridade e migração real. Nenhum deploy antes de 100% de conversão e homologação. CI #307 aprovada na RC.1; nova suíte precisa passar.

## v3.14.0-rc.3 — validação de eventos financeiros

`backend/src/MercadoPago.php` valida HMAC-SHA256, timestamp de até 10 minutos, ID do recurso e da requisição. O serviço consulta fatura, preapproval e pagamento por transporte injetado, verifica referências, moeda, valor e frequência; calcula vigência em UTC com ajuste de fim de mês e reconcilia somente snapshots validados. A migration 005 torna mp_payment_id único (nulos permitidos); a importação de dados históricos precisa verificar duplicidades antes da aplicação. A CI testa assinatura inválida/expirada, adulteração, preço e referência divergentes, replay, reaproveitamento de pagamento, chargeback e datas de fim de mês/ano bissexto.

Referências: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks e https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/overview. Transporte de testes injetado, sem chamada real; ainda não há endpoint webhook HTTP ativo, credenciais sandbox homologadas, checkout, cancelamento remoto ou mudança de ciclo. CI #323 aprovada na RC.2; a nova suíte deve ser confirmada. Nenhuma hospedagem antes de 100%.

## v3.14.0-rc.4 — transporte e webhook HTTP

CI #339 aprovou integralmente a RC.3. O candidato inclui transporte HTTPS cURL para endpoints fixos do Mercado Pago, sem redirecionamentos, com limite de resposta, timeout e credencial TEST- exclusiva. O endpoint `/api/index.php?route=billing/webhook` está desativado por padrão; aceita POST do tópico subscription_authorized_payment, verifica HMAC, data.id, request ID e correspondência do corpo; rejeita live_mode e exige resposta de pagamento não-live. Não recebe credenciais do navegador. A migration 006 preserva identificadores de tentativas anteriores de pagamento; uma tentativa nova pode substituir fatura pendente/recusada, mas não pagamento aprovado, estornado ou contestado. Novos testes de retry, histórico, HMAC/HTTP, parâmetros duplicados e bloqueio de produção usam dados fictícios e não acessam a rede externa.

Requer PHP cURL e configuração privada do sandbox. Nenhuma credencial real configurada; ainda faltam teste com sandbox efetivo, checkout, cancelamento remoto, mudança de ciclo, reconciliação periódica, notificação por e-mail, paridade, migração de dados e homologação final. A restrição TEST- e live_mode=false é deliberadamente conservadora e deve ser verificada com a conta de teste do Mercado Pago antes de habilitar. Não publicar Hostinger antes de 100%.

## v3.14.0-rc.5 — distribuição isolada e restauração

CI #361 aprovou integralmente RC.4. `database/hostinger/build-candidate.mjs` gera public_html, sqf-private e database, com MySQL fixo, páginas canônicas candidatas, sem SDK/config Supabase, sem painel legado e sem service worker legado. A CI passa a testar esse pacote, incluindo a entrada PHP real, detecção de tentativas de acesso Supabase e validação do diretório privado de mídia. Corrigido o bloqueio incorreto do diretório sqf-private/media; a raiz pública continua proibida. A CI também gera dump de banco descartável, restaura em segundo schema e compara inventário, contagens e hashes de conteúdo de todas as tabelas, além de integridade referencial. Não é backup de produção nem migração de dados reais.

Gates remanescentes: CI completa da RC.5, paridade integral (incluindo financeiro e notificações), SMTP real e sandbox Mercado Pago, exportação/importação/reconciliação de identidades, dados e arquivos reais, testes de restauração de mídia, segurança e LGPD operacional, ensaio de rollback, conferência do ambiente Hostinger. Não autorizar produção antes de 100% de conversão e homologação. Nenhum deploy realizado.

## v3.14.0-rc.6 — avisos e pré-validação de identidades

Notificações MySQL: Marketplace.php cria item da fila junto à notificação para quem optou por e-mail; Notifications.php processa até 15 itens por execução (bloqueio GET_LOCK por banco, rechecagem do opt-in, e-mail confirmado, isolamento do destinatário, retry exponencial até oito tentativas). Mensagem genérica sem conteúdo privado. O CLI privado backend/bin/notifications.php exige SQF_NOTIFICATIONS_ENABLED=1; padrão desativado. Transporte usa mail() do PHP, não SMTP homologado; entrega aceita pelo transporte não equivale a recebimento e uma queda após envio antes do commit pode repetir o aviso. Testes usam transporte simulado, sem rede. Não ativar workflow Supabase legado nem cron real nesta etapa.

Pré-validação: backend/bin/preflight-identities.php recebe JSON privado {identities:[{id,email,email_confirmed_at,created_at}],profiles:[{id,full_name,account_type,city_ibge,bio,created_at,updated_at}]}. Apenas banco novo vazio com catálogo instalado. Valida UUID, e-mail, correspondência, datas ISO-8601 e município; rejeita credenciais e campos desconhecidos; insere temporariamente identidades sem senha, perfis privados e verificações pendentes, então rollback incondicional. Nenhum dado real importado. Não preservar publicação automaticamente. Ainda faltam exportação autorizada, importação efetiva, vínculos, arquivos, reconciliação e recuperação das contas; a pré-validação não é conversor completo. Testes de rollback, duplicação, perfil órfão e cidade inválida foram acrescentados.

CI #386 ainda precisa confirmar a restauração da RC.5; RC.6 possui nova CI. Nenhuma hospedagem, cobrança ou alteração de produção. Pendem checkout/cancelamento/mudança de ciclo, conciliação periódica, sandbox, SMTP real, paridade e migração completa, mídia, LGPD e rollback.
