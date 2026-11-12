# Aceite técnico local — MySQL 8.0 / MariaDB 10.11

Este roteiro é **exclusivamente local**. Não utiliza hospedagem, ambiente comercial, GitHub Actions, pagamento real nem dados pessoais. Todos os bancos abaixo ficam em containers temporários com sistema de arquivos `tmpfs` e portas vinculadas a `127.0.0.1`.

## Requisitos

- Linux com Docker e Docker Compose v2 ativos, Node.js 22+, PHP 8.1+ e as extensões `pdo_mysql`, `mbstring` (e `gd`/`fileinfo` para os testes completos de mídia).
- Portas `13306` e `13311` disponíveis no próprio computador.
- Capacidade de baixar as imagens oficiais MySQL 8.0 e MariaDB 10.11. A primeira execução pode requerer rede **para baixar essas imagens**, mas o sistema testado não usa serviços externos.
- Nenhuma configuração de banco real ou segredo deve ser reutilizada. Os nomes e as senhas desta composição são **fictícios e públicos**.

## 1. Validar o projeto e preparar os dois bancos descartáveis

```bash
git checkout feat/mysql-mariadb-migration
bash scripts/validate-conversion-local.sh
bash database/tests/run-disposable-db-matrix.sh --apply-fixtures
```

O executor só aceita o argumento explícito `--apply-fixtures`. Ele sobe dois containers isolados, gera o SQL consolidado das migrações `001–010`, exige os bancos `sqf_test` e `sqf_import_stage` vazios, instala o esquema e os dados públicos e executa, **em cada mecanismo**, verificações de integridade, autenticação, contratação/agenda/avaliações, índices e `EXPLAIN`. A execução recusa bancos não vazios; não executa `DROP DATABASE` nem desativa pagamentos reais.

Os containers usam `sqf_fixture` / `sqf_fixture_password_local_only` **apenas localmente**. O MySQL atende em `127.0.0.1:13306` e o MariaDB em `127.0.0.1:13311`. Não exponha essas portas à rede pública.

**Não considerar a matriz aprovada apenas porque os arquivos foram criados.** Registrar a saída real de cada comando, com versão de servidor, falhas e verificações de integridade.

## 2. Importação persistida sintética (separada por mecanismo)

Depois do item 1, executar para o MySQL:

```bash
export SQF_DB_USER=sqf_fixture
export SQF_DB_PASSWORD=sqf_fixture_password_local_only
export SQF_IMPORT_STAGING_ENABLED=1
export SQF_IMPORT_STAGING_DATABASE=sqf_import_stage
export SQF_LOCAL_ENGINE=mysql80
export SQF_DB_DSN='mysql:host=127.0.0.1;port=13306;dbname=sqf_import_stage;charset=utf8mb4'
export SQF_PRIVATE_MEDIA_ROOT=/tmp/sqf-import-mysql80-stage-media
bash database/tests/run-isolated-import.sh
```

Depois repetir no MariaDB, trocando **somente**:

```bash
export SQF_LOCAL_ENGINE=mariadb1011
export SQF_DB_DSN='mysql:host=127.0.0.1;port=13311;dbname=sqf_import_stage;charset=utf8mb4'
export SQF_PRIVATE_MEDIA_ROOT=/tmp/sqf-import-mariadb1011-stage-media
bash database/tests/run-isolated-import.sh
```

O script exige destino autorizado e mídia fictícia ainda inexistente. Em cada banco, verificar rollback de conteúdo inválido e de integridade referencial, contagens de todas as tabelas importadas, relações entre pessoas/solicitações/mensagens e hashes SHA-256 dos arquivos fictícios. As contas importadas permanecem sem senhas válidas e os perfis não são publicados.

## 3. Backup e restauração independentes

O banco `sqf_import_restore` é preparado **vazio** em cada container. Após uma importação sintética aprovada, exportar `sqf_import_stage` para uma cópia local e importá-la em `sqf_import_restore`. Usar `mysqldump` para MySQL ou `mariadb-dump` para MariaDB, sempre com `--single-transaction --no-tablespaces`. Manter o arquivo temporário de dump apenas na pasta ignorada `.artifacts/`.

Em cada mecanismo, copiar a mídia gerada do diretório de staging para um diretório novo independente:
- MySQL: `/tmp/sqf-import-mysql80-stage-media` → `/tmp/sqf-import-mysql80-restore-media`
- MariaDB: `/tmp/sqf-import-mariadb1011-stage-media` → `/tmp/sqf-import-mariadb1011-restore-media`

Definir `SQF_DB_DSN` como o staging do mecanismo, `SQF_RESTORE_DSN` como a instância restaurada (`dbname=sqf_import_restore`), `SQF_PRIVATE_MEDIA_ROOT`, `SQF_RESTORE_MEDIA_ROOT` e `SQF_LOCAL_ENGINE`, e executar:

```bash
bash database/tests/run-isolated-restore.sh
```

O verificador compara conteúdo de tabelas, SHA-256 da mídia referenciada e arquivos extras/órfãos. Registre o resultado. **O ensaio de backup, cópia e restauração ainda não foi executado por esta documentação.** Não aplique o procedimento em dados existentes.

## 4. Evidências adicionais obrigatórias

Executar testes de concorrência real da agenda, solicitações repetidas, mensagens, sessões, MFA, acesso a mídia privada, fluxo de avaliação e faturas apenas com simulações. Verificar compatibilidade das rotas HTTP e responsividade no navegador. Revisar a migração 010 em cópias de dados históricos: vínculos ambíguos entre `service_engagements` e `sqf_service_requests` **não devem ser corrigidos automaticamente**.

## 5. Encerrar o laboratório

Depois de guardar os resultados e somente quando as fixtures não forem mais necessárias:

```bash
docker compose -f database/tests/compose.mysql-mariadb.local.yml down
```

Este comando encerra apenas os containers nomeados nesta composição e descarta seus dados `tmpfs`. Não elimina o repositório, bancos externos ou diretórios privados locais. Os diretórios fictícios de mídia em `/tmp` são deixados intactos para inspeção; removê-los exige uma decisão separada.

**Critério de liberação:** os testes devem passar em **ambos** os mecanismos, os dados e arquivos fictícios devem ser reconciliados, a restauração deve ser comprovada e nenhuma dependência operacional de arquitetura anterior deve permanecer. Somente então considerar tag/release da candidata; hospedagem e produção continuam fora do escopo.
