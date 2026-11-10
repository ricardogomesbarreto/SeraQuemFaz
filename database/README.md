# Banco de dados — MySQL/MariaDB

Única arquitetura de banco do candidato. MySQL 8.0 e MariaDB 10.11, InnoDB, utf8mb4, UUID ASCII, DATETIME(6) em UTC, JSON e centavos inteiros.

## Instalação

Execute `npm run build:dist`. O SQL consolidado inclui migrations 001–006, 51 categorias e cadastro nacional de municípios. Importe em banco novo e vazio. Veja [Hostinger](hostinger/README.md).

## Serviços

- API PHP: autenticação Argon2id, sessões, CSRF, consultas parametrizadas, autorização por titular/participante e MFA administrativo.
- Catálogo, serviços, agenda, solicitações, mensagens, portfólio, moderação, suporte, preferências e notificações.
- Financeiro: faturas verificadas, vigência, identificadores únicos, histórico de tentativas, webhook de homologação desativado.
- CLI privado: worker de avisos desativado; pré-validação de identidade e perfil com rollback incondicional.

## Testes e gates

CI nos dois engines: instalação, integridade, PHP, HTTP, Chromium, isolamento, dump/restauração e comparação de tabelas. Fixtures nunca em produção. A pré-validação de contas não é importação definitiva. Ainda faltam transferência integral de dados/mídia, recuperação de contas, SMTP, sandbox, checkout/cancelamento/ciclo, paridade, segurança e LGPD. Não liberar hospedagem antes da aprovação integral.

## Histórico

RC.1 segurança de conta; RC.2 faturamento; RC.3 validação financeira; RC.4 transporte e webhook; RC.5 pacote isolado e restauração; RC.6 avisos e pré-validação; RC.7 limpeza da árvore ativa e arquitetura exclusiva MySQL/MariaDB.
