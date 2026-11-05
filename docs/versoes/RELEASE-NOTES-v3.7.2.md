# SERÁ QUEM FAZ? — v3.7.2

**Lançamento local da interface de planos (04/11/2026)**

## Objetivo

Exibir uma proposta acessível de assinatura na landing page e permitir comparar preço mensal e anual, sem mudar o fluxo de cadastro, a identidade visual ou a segurança existente.

## Funcionalidade entregue

- Cliente: acesso gratuito (R$ 0,00).
- Plano profissional proposto: R$ 14,90/mês ou R$ 149,00/ano.
- Economia anual de R$ 29,80, aproximadamente 17% sobre doze mensalidades.
- Texto transparente sobre caráter proposto dos valores e inexistência de checkout.
- Botões levam ao cadastro existente; **não processam pagamento nem ativam plano**.
- Estilos responsivos e testes automatizados.

## Limitações e riscos

O backend ainda não contém assinaturas, gates comerciais, cobrança recorrente, cancelamento ou processamento de pagamentos. As migrações do Supabase não foram aplicadas remotamente. Os preços precisam de validação de custos, apoio jurídico e decisão comercial antes de uso público como oferta vinculante.

Ver [`docs/financeiro/PRECIFICACAO-v3.7.2.md`](../financeiro/PRECIFICACAO-v3.7.2.md).
