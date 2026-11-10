# SERÁ QUEM FAZ? — v3.12.0

## Novidades: busca assistida e orçamentos
- Busca de categorias aprimorada com termos do cotidiano e sinônimos mapeados para nomes de profissões reais no Supabase. Exemplos: “faxina” → **Limpeza**, “notebook” → **Técnico de Informática**, “geladeira” → **Técnico em Refrigeração** e “vazamento” → **Encanador**.
- Sugestões de grafia quando nenhuma categoria corresponde ao termo, limitadas a três opções que realmente constam do catálogo ativo; nenhuma profissão é criada automaticamente.
- Ordenação por relevância: correspondência exata do nome primeiro, seguida de prefixo, ocorrência no nome, sinônimo e descrição.
- Comparação de propostas no painel do cliente, com busca por descrição/condições/profissional, filtro por situação, ordenação por menor/maior valor e data mais recente.
- Valores e estados vêm dos registros privados da conta autenticada sob RLS. Os cartões explicam que valores de serviços com escopos diferentes não são diretamente comparáveis. Nenhum cálculo de economia ou rating é simulado.
- Layout responsivo dos novos controles, mantendo as cores azul-marinho e laranja.
- Novos testes de sinônimos, grafia, ordenação, propostas inválidas, privacidade e estrutura do HTML.

## O que não mudou
- Não houve migração de banco de dados na v3.12.0.
- A visibilidade pública continua restrita a prestadores analisados/aprovados, com serviço ativo e publicação autorizada.
- Sem alteração de assinatura, preço, Mercado Pago, Hostinger ou envio automático de e-mails.

## Pacotes oficiais
- `SeraQuemFaz_site_v3.12.0.zip` — distribuição estática do frontend.
- `SeraQuemFaz_codigo_v3.12.0.zip` — código completo, testes e documentação.

## Homologação pendente
O banco conectado ainda não possui propostas registradas nem prestadores aprovados publicamente, portanto os filtros de comparação tiveram validação automatizada, não um fluxo real de múltiplos orçamentos. Para homologar comercialmente, executar o ciclo com contas distintas e aprovação humana. As configurações de proteção da branch principal e o controle de senhas comprometidas permanecem como gates separados.
