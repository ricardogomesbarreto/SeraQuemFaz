# SERÁ QUEM FAZ? — v3.9.19

## Correções
- Política de segurança PostgreSQL/Supabase corrigida para permitir a **leitura das categorias ativas por usuários autenticados**.
- Confirmação no Supabase conectado: **51 categorias ativas** visíveis pelos papéis `anon` e `authenticated`.
- Formulário de prestador com botão **Recarregar categorias**, sem descartar as demais informações preenchidas.
- Separação entre falha na consulta e ausência de categorias cadastradas.
- A alteração não concede permissão para criar, modificar ou excluir categorias aos usuários comuns.

## Arquivos para download
- `SeraQuemFaz_site_v3.9.19.zip`: versão estática do site.
- `SeraQuemFaz_codigo_v3.9.19.zip`: fontes, migração idempotente e testes.

## Observações
Release histórico de correção. A política RLS já foi aplicada no projeto Supabase conectado; em outras instâncias deve ser verificada antes de ativar o cadastro de serviços. Para continuidade do desenvolvimento, use a v3.10.0.
