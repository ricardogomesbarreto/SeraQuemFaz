# SERÁ QUEM FAZ? — v3.11.0

## Perfis de cliente e prestador
- Painéis com o mesmo shell visual (sidebar azul-marinho, conteúdo organizado, status e perfil).
- Exibição do tipo de conta abaixo do nome: **Perfil de cliente** ou **Perfil de prestador de serviço**.
- Navegação por telas independentes com `painel.html?pagina=cliente/...` e `painel.html?pagina=prestador/...`, preservando a sessão e os controles existentes.
- Cliente: visão geral, edição, atividades e orçamentos, favoritos, agenda e configurações.
- Prestador: visão geral, edição, solicitações e mensagens, serviços, portfólio, agenda, desempenho, verificação, assinatura e configurações.

## Serviços e catálogo
- Cadastro de serviços com estimativas de preços opcionais e possibilidade de pausar a exposição pública.
- Fotos do portfólio organizadas por serviço, com capa definida via função segura do banco.
- Favoritos por categorias com RLS; buscas recentes armazenadas somente na sessão da aba.
- Catálogo: filtros por avaliações reais e portfólio, ordenação por completude e data do cadastro, contagem de fotos existentes e estado sem resultados.
- Landing page com busca por município e serviço, apresentação dos passos para cliente e prestador e seção de confiança sem números fictícios.

## Qualidade e segurança
- Correção de controle duplicado no carregamento de categorias.
- Configurações permitem alteração autenticada de senha sem salvamento local.
- Migração aditiva `20261109_18_paineis_servicos_portfolio.sql` aplicada ao projeto Supabase conectado; políticas de acesso revisadas.
- Testes automatizados Node 22 e 24 aprovados no PR #8 e no commit da `main` `26cb8731016a4fd5f8fb18a830336de6a7a951c8`.

## Arquivos
- `SeraQuemFaz_site_v3.11.0.zip`: pacote estático do site.
- `SeraQuemFaz_codigo_v3.11.0.zip`: código completo, migrações, testes e documentação.

## Limites
A integração à `main` e a aprovação da CI não equivalem à homologação visual em navegadores com contas reais. Ainda é necessário testar cliente, prestador e administrador separadamente, conferir responsividade, permissões e a persistência das operações. Envio automático de e-mail e checkout comercial continuam sujeitos a configuração e homologação independente. Esta release não declara prontidão comercial.
