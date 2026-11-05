# SERÁ QUEM FAZ? v3.9.6 — Recuperação das imagens reais de categoria

- Fontes verificadas: 51 `public.categories` ativas, todas com `image_url` no Supabase.
- O Storage tem 0 objetos de categoria; as fotografias são URLs externas, não assets do banco.
- Corrigido o modo de referência que descartava 51 URLs históricas e exibia blocos vazios.
- Adicionado instantâneo público dos 51 nomes e links de imagens, carregado somente como contingência.
- Adicionada segunda tentativa de leitura de categorias por REST pública quando a biblioteca supabase-js falha.
- Página de detalhe em modo contingência volta a exibir a fotografia correspondente à categoria.
- Preservados os 51 registros, usuários, autenticação, profissionais, avaliações e preços. Nenhuma alteração SQL remota.

## Limites

A sincronização real depende de acesso ao Supabase pelo navegador. O instantâneo não permite listar prestadores como se fossem atuais. URLs de terceiros podem falhar ou ter restrições de licença. Um teste com fotos servidas pelo domínio externo e uma homologação de produção são necessários.
