# Banco de dados — MySQL/MariaDB

Única arquitetura de banco do candidato. MySQL 8.0 e MariaDB 10.11, InnoDB, utf8mb4, UUID ASCII, DATETIME(6) em UTC, JSON e centavos inteiros.

## Instalação

Execute `npm run build:dist`. O SQL consolidado inclui migrations 001–009, 51 categorias e cadastro nacional de municípios. Importe em banco novo e vazio. Veja [Hostinger](hostinger/README.md).

## Serviços

- API PHP: autenticação Argon2id, sessões, CSRF, consultas parametrizadas, autorização por titular/participante e MFA administrativo.
- Catálogo, serviços, agenda, solicitações, mensagens, portfólio, moderação, suporte, preferências e notificações.
- Financeiro: faturas verificadas, vigência, identificadores únicos, histórico de tentativas, webhook de homologação desativado.
- CLI privado: worker de avisos desativado; pré-validação de identidade e perfil com rollback incondicional.

## Testes e gates

CI nos dois engines: instalação, integridade, PHP, HTTP, Chromium, isolamento, dump/restauração e comparação de tabelas. Fixtures nunca em produção. A pré-validação de contas não é importação definitiva. Ainda faltam transferência integral de dados/mídia, recuperação de contas, SMTP, sandbox, checkout/cancelamento/ciclo, paridade, segurança e LGPD. Não liberar produção antes da aprovação integral. Para testes, usar apenas subdomínio de homologação com banco separado e dados fictícios após validação da CI e do preflight.

## Histórico

RC.1 segurança de conta; RC.2 faturamento; RC.3 validação financeira; RC.4 transporte e webhook; RC.5 pacote isolado e restauração; RC.6 avisos e pré-validação; RC.7 limpeza da árvore ativa e arquitetura exclusiva MySQL/MariaDB.

## RC.10 — importação normalizada

Migration 007 acrescenta índices e intenção de ciclo. `php backend/bin/import-snapshot.php snapshot.json diretorio-privado` valida 32 conjuntos operacionais ordenados, contagens, integridade e manifesto SHA256 de mídia. O JSON tem `tables` (lista completa de tabelas conforme sqfImportTables(), cada uma com lista de objetos com colunas MySQL normalizadas) e `media` (mapa caminho relativo -> SHA256). Importação experimental desfaz transação; `--commit-staging` exige SQF_IMPORT_STAGING_ENABLED=1 e destino novo vazio. Arquivos devem estar previamente copiados e normalizados em WebP no diretório privado; o CLI não extrai dados da origem, não transfere arquivos e não importa credenciais/sessões/administradores; perfis privados. Revisão de publicação e redefinição de senhas obrigatórias. Não usar em produção. Backup e restauração de mídia são testados na CI.

## RC.11

Migration 008 separa contrato atual de histórico, com índice único sobre identificador gerado do titular atual. O importador inclui solicitações de mudança de ciclo (33 conjuntos); não aceita a coluna gerada. Teste relacional inclui cliente, prestador, serviço, solicitação, mensagem e WebP com SHA256. Renovação é manual, depois de cancelamento confirmado e vigência vencida. Não há cobrança automática nem migração de dados reais.

## Validação local da conversão (sem hospedagem)

A aplicação usa PHP/PDO com DSN `mysql:`, tabelas InnoDB, migrações em `database/mysql/migrations/` e dados públicos em `database/seed/`. Não utilize dados pessoais nem bancos existentes nos ensaios.

**Importação persistida de registros fictícios:** preparar separadamente um banco novo chamado `sqf_import_stage` em MySQL 8.0 e outro em MariaDB 10.11 (executar um mecanismo por vez). Aplicar o esquema completo e popular as 51 categorias e os municípios. Configurar somente em seu terminal as variáveis `SQF_DB_DSN`, `SQF_DB_USER` e `SQF_DB_PASSWORD` para o banco descartável.

```bash
SQF_PRIVATE_MEDIA_ROOT=/tmp/sqf-import-stage-media \
SQF_IMPORT_STAGING_ENABLED=1 \
SQF_IMPORT_STAGING_DATABASE=sqf_import_stage \
bash database/tests/run-isolated-import.sh
```

O executor exige destino vazio, nome exato e um diretório de mídia de teste ainda inexistente. No modo persistido, a mídia fictícia é preservada em `/tmp/sqf-import-stage-media` para permitir a comparação posterior com uma cópia restaurada. Exercita importação transacional, rollback em erro relacional, reconciliação de contagens, relações cliente/prestador/solicitação/mensagem e SHA-256 de arquivo WebP fictício. Os perfis importados continuam não publicados e sem credenciais reutilizadas. **A execução só deve ser considerada aprovada após a saída real do terminal nos dois mecanismos; a presença do script não demonstra aprovação.**

**Restauração e recuperação:** depois de copiar manualmente o banco descartável para outro banco novo, `sqf_import_restore`, e copiar os arquivos fictícios para um diretório privado independente, definir `SQF_RESTORE_DSN` para `sqf_import_restore`, `SQF_PRIVATE_MEDIA_ROOT=/tmp/sqf-import-stage-media` e `SQF_RESTORE_MEDIA_ROOT=/tmp/sqf-import-restore-media`; executar:

```bash
bash database/tests/run-isolated-restore.sh
```

A rotina de recuperação é somente leitura e compara inventários de tabelas, conteúdo linha a linha por resumo SHA-256 e hashes de mídia. Ela não cria, apaga ou substitui bancos e arquivos. A criação e restauração inicial do banco de teste são atividades manuais separadas, que precisam ser comprovadas por evidências.

**Critério de conclusão:** exigir validação efetiva em ambos os mecanismos, paridade funcional, ausência de dependências operacionais de outra arquitetura, dados e mídias reconciliados e recuperação aprovada. Hospedagem e liberação comercial permanecem fora desta etapa.

## Controles adicionais da conversão

Os executores locais permanecem independentes da hospedagem e de pipelines remotos:

- `npm run verify`: audita dependências legadas, construções SQL incompatíveis, erros de sintaxe JavaScript e a correspondência entre rotas da API PHP e chamadas do cliente.
- `bash database/tests/run-isolated-import.sh`: exige MySQL 8.0 ou MariaDB 10.11, PDO MySQL, `utf8mb4`, sessão UTC, InnoDB, banco descartável vazio e catálogo público instalado. Testa falhas transacionais antes do commit sintético e concilia todas as tabelas da lista de migração.
- `bash database/tests/run-isolated-restore.sh`: valida a recuperação das tabelas e seus conteúdos, confere os hashes SHA-256 e rejeita arquivos órfãos, alterados ou ausentes em ambas as cópias de mídia.
- Revisão funcional: além da presença de rotas, validar autorização por perfil, métodos HTTP, erros, desempenho, agenda concorrente, mensagens, avaliações, dados privados e fluxos de login em ambos os bancos.

A restauração pressupõe backup e cópia **de um banco de testes criado previamente**, não os executa automaticamente. Não transportar dados reais para os ensaios sintéticos. Concluir a migração exige evidências de execução, além da presença de código de teste.

## Validação totalmente local, sem hospedagem e sem CI

Execute `bash scripts/validate-conversion-local.sh` para conferir a auditoria de código, testes unitários Node.js e sintaxe dos arquivos PHP. Essa execução não precisa de um banco de dados e não modifica dados ou arquivos existentes.

Para acrescentar **somente** o inventário de índices e `EXPLAIN` em um banco **descartável**, configure `SQF_DB_DSN`, `SQF_DB_USER`, `SQF_DB_PASSWORD` e execute `SQF_WITH_DB=1 bash scripts/validate-conversion-local.sh`. Importação persistida, testes de concorrência, recuperação e comparação de mídia exigem os executores isolados documentados acima, com consentimento explícito e dados fictícios. Não interpretar teste estático como aceite funcional.

## Otimização de consultas MySQL/MariaDB — migração 009

A migração `009_marketplace_read_indexes.sql` acrescenta índices não destrutivos para listagem de mensagens por solicitação, identificação de solicitações semelhantes, avaliações públicas por prestador e fila de moderação. As consultas permanecem parametrizadas; a leitura do histórico de mensagens valida a participação na solicitação sem manter bloqueios de escrita.

Para examinar índices e planos de consulta em um banco **descartável**, depois de aplicar todas as migrações e configurar `SQF_DB_DSN`, `SQF_DB_USER` e `SQF_DB_PASSWORD`:

```bash
php database/tests/index-inventory.php
```

A rotina usa apenas `information_schema` e `EXPLAIN`, não grava dados nem presume desempenho a partir de tabelas vazias. Execute separadamente em MySQL 8.0 e MariaDB 10.11. Registre os planos e meça consultas com volume fictício representativo antes de considerar a otimização homologada.

## Pendência de integridade: avaliações em atendimentos recorrentes

A migração 001 contém `UNIQUE(client_id,provider_id)` em `service_engagements`. Na conclusão de uma solicitação, `sqfRequestAction()` reutiliza esse vínculo, enquanto `reviews` possui uma avaliação única por `engagement_id`. Isso limita avaliações independentes de **duas contratações concluídas entre as mesmas pessoas**.

Antes de declarar 100%, revisar uma migração que represente cada atendimento individual sem perder os vínculos e avaliações existentes. Executar casos com dois atendimentos concluídos do mesmo par, avaliações distintas, tentativa de avaliação duplicada e restauração de dados legados em MySQL 8.0 e MariaDB 10.11. Nenhum ajuste destrutivo de índice ou relacionamento deve ser promovido antes da reconciliação.

