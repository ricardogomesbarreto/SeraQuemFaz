# Histórico de mudanças

## v3.14.0-rc.15 — pós-merge, PWA e Hostinger Unlimited (12/11/2026)

- PR #15 integrado à main como base da homologação; PR #16 integrado com arquitetura PHP/MySQL/MariaDB, migrações e pacote Hostinger.
- Cache PWA sincronizado com versão do projeto; atualização correspondente do teste de regressão.
- Pacotes segregados site-public_html.zip e sqf-private.zip, instalação SQL, SHA-256, PHP 8.2+, checkout e cron reais desativados.
- Tag e pré-release novas, sem substituir o histórico da v3.14.0-rc.14; a homologação comercial permanece pendente.


## v3.14.0-rc.14 — candidata Hostinger Unlimited (12/11/2026)

- Geração de **dois ZIPs segregados** para envio manual pelo Gerenciador de Arquivos: frontend/API pública em `site-public_html.zip` e backend privado em `sqf-private.zip`. Arquivos de instalação SQL e hashes SHA-256 separados, sem credenciais no pacote.
- API PHP/PDO MySQL; fluxo cliente/prestador/admin, catálogo, busca por cidade, solicitações, agenda, mensagens, avaliações, portfólio e PWA protegidos por testes de regressão. Nenhuma funcionalidade foi intencionalmente removida.
- Correção do teste de importação que modificava chaves fora de `snapshot.tables`; validação explícita de mensagens importadas por participante e bloqueio de campos desconhecidos.
- Migrations 001–010, PHP 8.2+ no preflight para o hPanel e matriz MySQL 8.0/MariaDB 10.11.
- GitHub Actions com auditoria de pacote, testes PHP/API/Chromium/responsividade e restauração descartável. **Publicação da tag e pré-release condicionada à aprovação integral dos jobs do commit candidato**.
- **Não é liberação comercial:** dados reais, SMTP real, pagamentos sandbox/produção, isolamento efetivo no hPanel, backup operacional, segurança/LGPD e rollback ainda exigem homologação no ambiente contratado.


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
