# Plano de homologação v3.12.0 — Busca e contratação

## Pesquisa e catálogo
1. Selecionar município pelo cadastro IBGE; abrir `categorias.html?cidade=<codigo>&q=notebook` e conferir **Técnico de Informática** quando a categoria estiver ativa.
2. Procurar por `faxina`, `geladeira`, `vazamento`, `advocacia` e confirmar que os resultados são categorias reais.
3. Testar `eletrissista`: sem resultado direto, a busca deve sugerir **Eletricista**, se estiver cadastrada.
4. Digitar `profissão-inexistente` e confirmar estado vazio; nunca renderizar categoria ou profissional fictício.
5. Repetir com município não selecionado: bloquear navegação para categoria e solicitar escolha explícita.
6. Conferir estado de conexão indisponível e integridade do catálogo editorial de referência sem alegar disponibilidade real.
7. Verificar responsividade em 390 px, 768 px e 1440 px, zoom de 200%, uso por teclado, Escape do filtro e foco.

## Orçamentos
1. Com um cliente de homologação e prestador aprovado manualmente, criar solicitação com descrição e data válidas.
2. Prestador responde com orçamento e condições; cliente vê preço e situação reais.
3. Repetir em outro serviço/profissional; na comparação, usar filtros por situação, busca por texto, ordenação por valor/data e abrir uma proposta.
4. Comparar apenas propostas com escopos equivalentes; a interface não atribui economia, qualidade ou prazo automaticamente.
5. Verificar que um cliente B não acessa orçamentos de A pela interface nem pela API (RLS).
6. Testar sem propostas: estado vazio sem número inventado; falha de rede: exibir aviso.
7. Validar mensagens privadas, anexos, agenda, aceitação, conclusão e avaliação moderada em contas diferentes.

## Gate
- CI Node 22 e 24 devem passar `npm run verify` e empacotamento.
- Conferência de RLS e requisitos LGPD continua necessária para a promoção comercial.
- No Supabase, os dados atuais têm zero solicitações/orçamentos, então a homologação entre usuários permanece **não executada**.
- Não ativar Mercado Pago nem Hostinger até decisão formal de liberação.
