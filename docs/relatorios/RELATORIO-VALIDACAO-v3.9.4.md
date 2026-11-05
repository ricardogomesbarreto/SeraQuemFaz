# SERÁ QUEM FAZ? · Relatório de validação v3.9.4

**Data:** 04/11/2026 · **Escopo:** integração com esquema de contas anterior, foto privada, navegação da conta e falhas do módulo de mensagens.

## Testes executados

- `npm run verify`: **153/153 testes Node aprovados**, incluindo validação de sintaxe e sete testes novos de compatibilidade (leitura legado, isolamento do caminho de foto, salvamento, falha de permissão, script SQL e integração do menu).
- Chromium com dados simulados: interface da conta testada em **1440 × 900** e **390 × 844**, com edição de nome, cidade, UF e envio de foto de teste processada localmente; sem exceções JavaScript e sem rolagem horizontal nas duas resoluções.
- Solicitações: com `profiles` ausente, o painel aparece e informa o bloqueio real, em vez de ocultar a seção. Não foram enviados pedidos ou mensagens a servidores reais.
- O frontend não acessou contas reais nem dados privados externos no teste de navegador.

## Segurança e limitações

- Migração 12 **executada no Supabase remoto**: tabela, 2 contas, policies, privilégios e bucket privado confirmados por consultas administrativas. O isolamento por sessão real e o upload de foto ainda precisam de teste com contas de homologação.
- As tabelas legadas (`users`, `user_profiles`, `providers`, `services`, `categories`) **não são alteradas** pela migração 12; as políticas atuais dessas tabelas devem ser auditadas.
- O módulo de solicitações continua dependente das migrações 01–11 e de mapeamento seguro do esquema legado.
- Mercado Pago permanece desativado. Nenhum pagamento, evento financeiro, release ou push GitHub foi realizado.

## Arquivos centrais

- `assets/account-compat.js` e `assets/account-fallback-ui.js`;
- `supabase/migrations/20261104_12_conta_compatibilidade_legada.sql`;
- `supabase/diagnostics/diagnostico_projeto_existente.sql`;
- `docs/contas/COMPATIBILIDADE-SUPABASE-v3.9.4.md`.
