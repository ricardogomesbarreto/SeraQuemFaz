# Edge Function `sqf-billing`

Backend de pagamentos do SERÁ QUEM FAZ?. Este diretório **não contém credenciais** e não processa cartões: o checkout ocorre no domínio do Mercado Pago.

| Rota (`/functions/v1/sqf-billing/…`) | Método | Permissão | Ação |
| --- | --- | --- | --- |
| `status` | GET | Token Supabase de prestador | Situação local da assinatura |
| `checkout` | POST | Token Supabase de prestador | Cria autorização pendente para ciclo validado no servidor |
| `refresh` | POST | Token Supabase de prestador | Confere assinatura e faturas na API, limitada a 1/min |
| `cancel` | POST | Token Supabase de prestador | Solicita cancelamento da recorrência no Mercado Pago |
| `webhook` | POST | HMAC SHA-256 do Mercado Pago | Reconsulta evento e reconcilia a fatura |
| `reconcile` | POST | Segredo de agendamento | Recupera faturas e mudanças não notificadas (lotes de 50) |

A função deve ser publicada com `--no-verify-jwt` para receber o Webhook. **As rotas de usuário verificam a sessão individualmente com `auth.getUser()`**; o webhook exige assinatura e o reconciliador exige segredo próprio.

**Operação comercial deliberadamente desativada:** `SQF_BILLING_ENABLED` precisa ser `true` no servidor e `enabled:true` no `assets/billing-config.js` somente após homologação.

Leia `docs/financeiro/INTEGRACAO-MERCADO-PAGO-v3.8.0.md` para um checklist de configuração e testes.
