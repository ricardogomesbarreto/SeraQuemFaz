# Banco de dados — Será Quem Faz?

## Estrutura

- `mysql/migrations/001_schema.sql`: instalação limpa em MySQL 8.0.16+ e MariaDB 10.11; candidato, não executar sobre o banco atual.
- `legacy/supabase-contracts.json`: inventário de RPCs e políticas RLS do PostgreSQL, sem dados pessoais.
- `tests/agenda-integration.php`: fixtures sintéticas e testes de integração da agenda, catálogo e contratação.
- `../backend/src/`: conexão PDO e serviços transacionais.

O diretório legado `supabase/` permanece intacto até o corte de produção. O frontend atual usa Supabase; os serviços PHP ainda não estão conectados a todas as telas.

## Instalação isolada

Criar um banco vazio e um usuário próprio. Importar `mysql/migrations/001_schema.sql` pelo cliente mysql/mariadb ou painel de administração. Nunca importar sobre o banco de produção. Usar UTF-8 e UTC. No ambiente PHP, definir `SQF_DB_DSN=mysql:host=127.0.0.1;dbname=sqf_test;charset=utf8mb4`, `SQF_DB_USER` e `SQF_DB_PASSWORD` apenas no servidor. PHP 8.1+, PDO MySQL e mbstring.

Executar `php database/tests/agenda-integration.php` exclusivamente em banco de testes vazio. A CI usa MySQL 8.0 e MariaDB 10.11.

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
