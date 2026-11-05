# SERÁ QUEM FAZ? — Integração de assinaturas v3.8.0

**Estado:** implementada no código; não implantada no Supabase nem ativada para cobranças. Sem credenciais reais e sem testes de pagamentos reais ou simulados no ambiente de teste Mercado Pago.

## 1. Modelo comercial

O acesso de clientes é gratuito. O plano profissional possui dois ciclos, **R$ 14,90 por mês** e **R$ 149,00 por ano**. São valores de referência definidos no código do servidor, não valores aceitos livremente de um navegador. A assinatura nunca substitui o processo de aprovação do prestador.

A mudança de ciclo não é feita com cobrança imediata: enquanto existir período pago vigente, o sistema bloqueia outra contratação. Para alterar o ciclo, o usuário precisa cancelar a recorrência e contratar novamente após o término do período já pago. A troca automática na data do vencimento **não está implementada**.

A cobrança se refere à assinatura de **visibilidade profissional**, e não à contratação dos serviços de terceiros. A plataforma não processa pagamentos entre cliente e prestador.

## 2. Arquitetura

- **Site:** HTML/CSS/JS existente, em hospedagem HTTPS. `assets/billing.js` só envia o token da sessão e o ciclo escolhido.
- **Servidor:** Supabase Edge Function `sqf-billing`, sem token Mercado Pago exposto ao cliente.
- **Dados:** migração `20261104_08_assinaturas_mercado_pago.sql`, com tabelas protegidas para assinaturas, faturas e flag comercial.
- **Mercado Pago:** `POST /preapproval` com status `pending`; usuário é redirecionado ao `init_point` HTTPS permitido; confirmação por `GET /preapproval/{id}`, fatura por `GET /authorized_payments/{id}` e pagamento por `GET /v1/payments/{id}`.
- **Webhooks:** `subscription_preapproval`, `subscription_authorized_payment` e `payment`, com comparação HMAC-SHA256 do cabeçalho `x-signature` e verificação posterior na API.
- **Reconciliação:** `POST /reconcile` com segredo separado. Para mais de 50 contas, agendar várias execuções e observar registros em erro. A implementação percorre 10 páginas de 20 faturas por assinatura; volumes superiores exigem paginação estendida.

### Estados e vencimento

| Estado | Conduta |
| --- | --- |
| `creating`/`pending` | Sem benefício pago; autorização em andamento |
| `authorized` sem fatura aprovada | Sem benefício pago |
| Pagamento validado e aprovado | `paid_until` calculado pelo servidor para um ciclo de 1 ou 12 meses |
| `canceled` | Sem novas cobranças; mantém a vigência paga até `paid_until` |
| Reembolso/contestação | Fatura deixa de contar como aprovada após reconciliação; vigência é recalculada |
| Vencido, sem período pago | Sem visibilidade paga quando o controle comercial estiver ativo |

O retorno `?pagamento=retorno` **nunca** confirma pagamento, por si só. A plataforma não armazena número de cartão, CVV ou tokens de cartão.

## 3. Implantação segura — executar primeiro em projeto de homologação

1. Fazer backup do PostgreSQL e revisar a migração junto às 7 anteriores. Aplicar `20261104_08_assinaturas_mercado_pago.sql` somente após a sequência anterior.
2. Criar a aplicação de teste em **Mercado Pago Developers**, revisar a modalidade de assinaturas disponível para a conta e obter credenciais de teste, não de produção.
3. Instalar o [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) e fazer login na conta que administra o projeto, com autorização. Vincular explicitamente o projeto correto. Não colocar chaves no GitHub ou no ZIP preenchidas.
4. Configurar **segredos privados da Edge Function** (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SQF_SITE_URL`, `SQF_BILLING_ENABLED`, `SQF_RECONCILE_SECRET`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são lidos do ambiente de Edge Functions. Use uma URL pública HTTPS para a plataforma, com `/` no final.
5. Publicar a função com `supabase functions deploy sqf-billing --no-verify-jwt` (sem JWT na borda para receber Webhooks; autenticação de usuários e webhook dentro da função).
6. Configurar URL do webhook na integração suportada pela sua conta e produto. URL: `https://<PROJECT_REF>.supabase.co/functions/v1/sqf-billing/webhook`. Verificar no painel do Mercado Pago como associar notificações à modalidade de assinaturas utilizada — a documentação pública tem orientações distintas sobre configuração pelo painel ou no ato da criação.
7. Testar com duas contas de **homologação**: cliente não pode contratar; prestador confirmado pode solicitar checkout; token inválido dá 401; pagamentos pendentes não liberam acesso; somente fatura/pagamento aprovado e valor correto podem ativar vigência; webhook assinado é aceito e o adulterado é negado; duplicatas não duplicam créditos; cancelamento não apaga vigência já paga; reembolso revoga crédito correspondente; alteração dos preços no navegador não modifica o valor cobrado.
8. Fazer teste de reconciliação com `POST /sqf-billing/reconcile` e o cabeçalho `x-sqf-reconcile-secret`. Proteger o segredo em um agendador; nunca colocar em scripts enviados ao cliente nem em parâmetros públicos. Monitorar falhas e garantir que a tarefa execute de forma recorrente.
9. Somente depois dos testes, em **produção**, configurar credenciais produtivas, ativar `SQF_BILLING_ENABLED=true` no servidor e `enabled:true` em `assets/billing-config.js` do site. Não habilitar cobrança automaticamente só por aplicar SQL.
10. A flag `require_paid_subscription` fica **false** por padrão. Após homologar o controle de vigência, decidir a data de entrada em vigor e comunicar aos prestadores atuais. Só então, se a operação comercial estiver pronta, habilitar pelo SQL Editor administrativo:

```sql
update public.sqf_billing_settings
set require_paid_subscription = true, updated_at = now()
where singleton = true;
```

**Impacto:** quando a flag estiver ativa, um prestador precisa ter cadastro aprovado, perfil público **e** período pago vigente para aparecer no catálogo. Não aplique a flag em produção antes de comunicar os usuários existentes.

## 4. Proteção adicional antes da operação real

- Monitorar falhas de Webhook e filas de reconciliação; reprocessar eventos perdidos com consulta autoritativa ao Mercado Pago.
- Conferir o endpoint `authorized_payments/search` e os status exatos apresentados à conta de teste antes de aceitar pagamentos reais.
- Implementar proteção de rate limit no gateway/Edge (além de limites de UX), trilha de eventos com retenção limitada, alertas de disputa e processo de atendimento financeiro.
- Atualizar **Termos de Uso**, **Política de Privacidade** e procedimentos de atendimento de solicitações, cancelamento e cobrança conforme legislação aplicável antes de abrir a oferta ao público.
- Para pagamento cancelado com disputa aberta, confirmar a fonte autoritativa; esta integração não garante estorno imediato nem consulta automática a todas as contestações sem Webhooks e reconciliação.
- Auditar toda configuração RLS e responsabilidades antes da primeira cobrança. Testes Node/Chromium não substituem homologação com o banco remoto e API real.

## 5. Referências oficiais

- Mercado Pago — [Assinaturas sem plano e pagamento pendente](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
- Mercado Pago — [Gerenciamento de assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management)
- Mercado Pago — [Webhooks de assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
- Mercado Pago — [Faturas recorrentes](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/authorized-payment-search/get)
- Supabase — [Edge Functions](https://supabase.com/docs/guides/functions)
