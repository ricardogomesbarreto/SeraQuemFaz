# Proposta de pré-release v3.14.0-rc.14 — ainda NÃO publicada

**Produto:** Será Quem Faz?  
**Branch de origem:** `feat/mysql-mariadb-migration`  
**PR:** #16 (rascunho; não foi integrado na `main`)  
**Natureza:** candidata local MySQL/MariaDB, sem produção nem cobrança real

> Este arquivo é uma **proposta de publicação**. Não é uma tag, uma GitHub Release ou um certificado de homologação. Não atribuir a ela o status de release enquanto os testes obrigatórios não forem executados e aprovados.

## Alterações para a próxima candidata

- Runtime exclusivo PHP 8.1+ / PDO MySQL; compatibilidade-alvo MySQL 8.0 e MariaDB 10.11.
- Migrações SQL 001–010 e dados públicos de categorias/municípios.
- Migração 009: índices para consultas frequentes, mensagens e avaliações.
- Migração 010: atendimento independente por solicitação concluída, permitindo avaliar contratações recorrentes sem apagar históricos; validação de associações antigas necessária.
- RBAC, MFA, isolamento de mídia privada, tokens de autenticação, limites de tentativas e faturamento simulado mantidos.
- Auditoria de compatibilidade entre as chamadas do cliente e rotas PHP; testes para importação, reconciliação e recuperação de mídia.
- Repositório reorganizado: documentação central, exclusão da marca duplicada comprovada, `.gitignore` e `.gitattributes` atualizados.
- Laboratório local opcional com MySQL e MariaDB descartáveis, `tmpfs` e portas restritas a `127.0.0.1`.

## Checklist de liberação da pré-release

- [ ] `npm run verify` e validação de sintaxe PHP sem falhas no HEAD escolhido
- [ ] Migrações `001–010` instaladas e verificadas em **MySQL 8.0**
- [ ] Migrações `001–010` instaladas e verificadas em **MariaDB 10.11**
- [ ] Contratações recorrentes e avaliações independentes verificadas nos dois mecanismos
- [ ] Concorrência na agenda, mensagens e solicitações duplicadas verificada
- [ ] Autenticação, MFA, autorização e mídia privada testadas em API e navegador
- [ ] Importação persistida de registros fictícios concluída e contagens reconciliadas
- [ ] Hashes de todos os arquivos fictícios reconciliados, sem arquivos órfãos
- [ ] Backup, restauração independente e rollback ensaiados em ambos os mecanismos
- [ ] Revisão de segurança e regressões aprovada
- [ ] SHA de destino verificado antes de criar tag; notas e resultados anexados à pré-release

## Publicação — somente após os itens acima

Usar um único SHA aprovado da branch e uma tag **nova** `v3.14.0-rc.14`, sem promover automaticamente para `main`. A GitHub Release correspondente deverá ser marcada como **Pre-release**, indicar claramente que é uma candidata **não autorizada para produção** e informar quais testes foram executados. Se algum gate falhar, manter este documento como proposta e não publicar.

A disponibilização na Hostinger Unlimited, migração de dados pessoais e operação financeira continuam etapas posteriores, fora desta pré-release.
