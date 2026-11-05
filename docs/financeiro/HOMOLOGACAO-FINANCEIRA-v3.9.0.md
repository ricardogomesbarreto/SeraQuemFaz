# SERÁ QUEM FAZ? — Checklist de homologação financeira v3.9.0

**Estado desta entrega:** implementação local; pagamentos reais e ambiente externo **não homologados**. Checkout permanece `enabled: false` no frontend e `SQF_BILLING_ENABLED=false` no servidor por padrão. A cobrança de serviço entre cliente e prestador não existe.

## Configuração segura

1. Implantar em **Supabase de homologação** depois de testar migrações 01–09 e políticas RLS.
2. Configurar o Mercado Pago em **ambiente de teste** usando segredos privados gerenciados pelo provedor. Não colar credenciais em arquivos `.js`, repositórios ou chat.
3. Implantar `sqf-billing` com autenticação por sessão para endpoints de usuário e HMAC para Webhooks (validar `x-signature`, ID, timestamp e ID de requisição quando aplicável). O corpo recebido nunca confirma pagamento diretamente.
4. Configurar `SQF_SITE_URL` HTTPS, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SQF_RECONCILE_SECRET`, `SQF_BILLING_ENABLED` e demais configurações de runtime.
5. Configurar em repositório próprio as secrets `SQF_RECONCILE_URL` e `SQF_RECONCILE_SECRET` e a variável `SQF_FINANCIAL_RECONCILIATION_ENABLED=true` **somente após** a homologação. O workflow agendado chama o endpoint a cada 6 h, sem publicar seus segredos. Jobs agendados dependem da execução do GitHub Actions; implementar monitoramento de falha e reconciliação alternativa antes de produção.

## Matriz mínima de testes reais (Mercado Pago Sandbox)

| Cenário | Resultado esperado |
| --- | --- |
| Cliente tenta checkout | 403, sem assinatura |
| Prestador não confirmado por e-mail | Bloqueado |
| Assinatura mensal R$ 14,90 | Valor e recorrência do servidor, não do navegador |
| Assinatura anual R$ 149,00 | Mesmo princípio |
| URL de retorno forjada | Nunca ativa assinatura |
| Webhook inválido ou ID divergente | HTTP 401/400, sem efeito financeiro |
| Webhook duplicado e fora de ordem | Sem faturas duplicadas ou vigência dupla |
| Fatura pendente ou recusada | Sem ativação |
| Fatura aprovada e valor conferido | Vigência calculada no servidor |
| Cancelamento da recorrência | Sem novas cobranças; preservar `paid_until` já aprovado |
| Reembolso/contestação | Ajustar vigência somente após conferência autoritativa |
| Falha de comunicação | Recuperar por reconciliação, com log e alerta |
| Renovação | Vigência correta, sem superposição incorreta |
| Alteração de preço no navegador | Sem efeito no processador |
| Consulta histórica por outra conta | 403/RLS/sem divulgação de faturas |
| Sem assinatura paga com flag comercial inativa | Não ocultar prestador já aprovado |
| Flag comercial ativada após aprovação formal | Somente prestadores aprovados e com período pago vigente |

## Histórico e comprovantes

O painel apresenta o **histórico de faturas reconciliadas** com situação, valor e datas. Isso não equivale a comprovante fiscal. O recibo oficial deve ser obtido no Mercado Pago; não foi gerado link fictício de nota fiscal.

## Autorizações e falhas

- Avaliar regras do Banco Central, CDC, LGPD, política de reembolso e termos aplicáveis com assessoria profissional.
- Definir retenção de dados financeiros, rota de contestação, prazos de suporte, alerta de chargeback e suporte a cancelamento.
- Não ativar `require_paid_subscription` automaticamente por uma migração. Planejar comunicação prévia aos prestadores.
- Não há teste real neste pacote, pois o ambiente atual não inclui acesso autorizado ao projeto Supabase e a credenciais do Mercado Pago. 

Referências: [Mercado Pago — Gerenciamento de assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management), [Webhooks de assinatura](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
