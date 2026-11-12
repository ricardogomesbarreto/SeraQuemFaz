# Contribuições — Será Quem Faz?

As alterações da conversão são feitas em `feat/mysql-mariadb-migration`, por commits pequenos e revisão via PR. A branch `main` e qualquer servidor operacional não devem ser alterados durante os testes locais.

## Antes de propor alterações

1. Leia a [organização dos arquivos](docs/ESTRUTURA-DO-REPOSITORIO.md) e o [roteiro de validação local](docs/VALIDACAO-LOCAL-MYSQL-MARIADB.md).
2. Execute `npm run verify` e `bash scripts/validate-conversion-local.sh`.
3. Para alterações de schema, segurança ou integração, use somente bancos **descartáveis** MySQL 8.0 e MariaDB 10.11 com dados fictícios. Aplique todas as migrações `001–010` e registre os resultados efetivos.
4. Documente migrações incrementais sem reescrever o histórico; preserve índices, FKs e dados de avaliações anteriores. Não use comandos destrutivos em bancos existentes.
5. Verifique que o cliente e as rotas da API PHP continuam coerentes. Não introduza conexão alternativa de banco nem dependências operacionais externas.

Não versionar senhas, arquivos `.env`, configurações privadas PHP, dados pessoais, snapshots, backups, imagens privadas ou credenciais de teste reutilizáveis fora dos containers locais. Nunca ativar pagamentos reais em fixtures.

Uma nova tag/release exige evidências dos testes e autorização explícita de promoção. Criar um commit ou atualizar a versão no `package.json` não significa publicar uma release.
