# Pesquisa de mercado e proposta comercial — SERÁ QUEM FAZ?

**Data da pesquisa:** 04/11/2026. **Natureza:** proposta de preços, não oferta comercial ativa.

## Referências públicas

| Plataforma | Modelo | Referência |
| --- | --- | --- |
| GetNinjas | Cadastro gratuito; profissional compra créditos para liberar contatos | [Central de Ajuda](https://www.getninjas.com.br/central-de-ajuda/profissional/anuncie/o-aplicativo-do-getninjas-e-pago) |
| Triider | Sem mensalidade; comissão sobre serviços, com faixa de 21% a 25% em determinadas modalidades | [Termos](https://www.triider.com.br/termos-e-condicoes), [Central de Ajuda](https://triidermadeira.zendesk.com/hc/pt-br/articles/37985341179539-Quanto-custa-para-eu-me-cadastrar) |
| 99Freelas | Modelo híbrido de comissão e assinatura premium, com planos mensais informados entre R$ 54,90 e R$ 89,90 | [Como funciona](https://www.99freelas.com.br/como-funciona?for=freelancer) |

Os modelos **não são diretamente equivalentes**: créditos, comissões por transação e assinaturas geram custos distintos. O SERÁ QUEM FAZ? tem proposta regional e ainda não processa contratação/pagamento. Nenhum desses preços comprova disposição a pagar local.

## Recomendação de teste comercial

- **Cliente:** gratuito.
- **Prestador mensal:** R$ 14,90 por mês.
- **Prestador anual:** R$ 149,00 pagos anualmente (equivale a R$ 12,42/mês; economia R$ 29,80/ano, ou 16,67%, arredondada para 17%).
- Assinatura pensada para exposição de perfil aprovado, cadastro de especialidades, portfólio e gestão de avaliações, **não para compra de leads, garantia de contratos ou prioridade de busca**.
- Os dois ciclos teriam as mesmas funcionalidades; não inventar planos premium adicionais antes de definir operação.

## Validação necessária antes de cobrança

1. Custear moderação, verificação de prestadores, armazenamento de imagens, autenticação, suporte, tributos, gateway, contestação de pagamentos e inadimplência.
2. Pesquisar disposição a pagar com prestadores reais da região inicial; medir conversão e churn.
3. Publicar termos comerciais definitivos (preço, renovação/cancelamento, reembolso, atendimento, taxas, direitos do consumidor) revisados por profissional habilitado.
4. Implementar backend de assinaturas com autorização no servidor, webhooks idempotentes, períodos, inadimplência e cancelamento, segregando ambiente de testes e produção.
5. Não liberar recursos pagos pelo estado do botão no navegador; controlar autorização e assinatura pelo backend.
6. Homologar a integração em sandbox e confirmar regras de LGPD/RLS antes de ativação.

**Estado v3.7.2:** somente **interface comercial indicativa**; nenhum pagamento, cadastro de assinatura, débito, desconto automático ou trial foi implementado.
