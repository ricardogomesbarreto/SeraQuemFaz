# Histórico de mudanças

## Em desenvolvimento — migração MySQL/MariaDB (ainda sem tag/release)

- **Organização do repositório:** documentação do layout e dos endereços compatíveis, proteção de arquivos privados por `.gitignore` e remoção da imagem duplicada `simbolo-dark.png`, mantendo `simbolo.png`.
- **SQL 001–010:** consolidação das migrações da arquitetura PHP/PDO MySQL e novo esquema de atendimentos recorrentes por solicitação (migração 010), sem excluir avaliações históricas.
- **Desempenho:** migração 009 com índices de consultas e auditoria `EXPLAIN` somente leitura; consulta de mensagens sem bloqueio desnecessário.
- **Segurança:** recuperação de conta, MFA, controle de acesso, mídia privada e validações estáticas e negativas ampliadas.
- **Aceite local preparado:** testes de integridade, contratação recorrente, simulação de importação, hashes SHA-256, restauração e rollback documentados.
- **Ainda não homologado:** aplicação de 001–010 e testes com MySQL 8.0/MariaDB 10.11 instalados localmente, reconciliação de dados e mídias, concorrência real e recuperação integral. **Nenhum tag/release ou deploy foi criado por esta etapa.**

## 3.14.0-rc.7 — homologação

- Arquitetura exclusiva MySQL/MariaDB e PHP.
- Remoção de instaladores, workflows e documentação da arquitetura anterior da árvore ativa.
- README, distribuição, CI e verificações atualizados.
- Histórico anterior preservado no Git.

## 3.14.0-rc.9 — homologação

- Runtime exclusivamente PHP/MySQL/MariaDB, sem caminhos alternativos de autenticação, catálogo ou mídia.
- Auditoria de referências reforçada; PWA e funcionalidades RC.8 preservadas.
- Hostinger Unlimited; produção bloqueada até homologação.

## 3.14.0-rc.11 — homologação

- Histórico de contratos e renovação manual após vigência; restrição única de contrato atual.
- Importação relacional com mídia e testes adicionais de integridade.
- Produção, SMTP real e pagamentos reais continuam desativados.
