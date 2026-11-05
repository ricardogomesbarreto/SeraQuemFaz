# SERÁ QUEM FAZ? — v3.8.0

**Marco: gateway de assinaturas preparado, não homologado remotamente.**

## Entregue

- Plano mensal de R$ 14,90 e anual de R$ 149,00, com preços fixos no servidor.
- Edge Function para iniciar checkout de assinatura pendente pelo Mercado Pago.
- Área de assinatura no painel, consulta de período pago, atualização e pedido de cancelamento.
- Webhook autenticado por HMAC-SHA256 e consultas autoritativas antes de registrar faturas.
- Migração com RLS e revogação de acessos diretos de cliente, proteção de plano e mecanismo de vigência comercial independente da aprovação cadastral.
- Reconciliação de faturas e preservação do período pago após cancelar renovação.

## Não ativado

Credenciais, serviços remotos, Webhooks, Edge Function de produção e controle comercial de publicação **não foram implantados**. A flag de cobrança do backend e a configuração do frontend estão desativadas.

## Operação

Leia `docs/financeiro/INTEGRACAO-MERCADO-PAGO-v3.8.0.md`.
