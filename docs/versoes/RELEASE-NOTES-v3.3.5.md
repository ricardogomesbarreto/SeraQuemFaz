# SERÁ QUEM FAZ? — v3.3.5

**Correção principal:** restauração das imagens originais de `public.categories.image_url` existentes no Supabase, como no ZIP de referência v3.0.

- Removidas fotografias artificiais associadas por palavras-chave, responsáveis por imagens repetidas e profissões erradas.
- Imagens do catálogo e das páginas de categoria agora usam exatamente o mesmo URL de cada registro.
- Fotos ausentes ou URLs inválidas produzem um cartão acessível com nome da categoria, não imagens aleatórias.
- Melhoria de apresentação: proporção 16:9, recorte central, atributos de carregamento e regras responsivas.
- Sem mudanças em dados do Supabase remoto, perfis, avaliações, esquemas, RLS ou autenticação.

**Importante:** o ZIP de referência v3.0 não continha as fotografias do catálogo como arquivos locais; elas eram carregadas do Supabase. Esta entrega restaura as URLs, mas não faz upscaling das imagens remotas. Para qualidade de origem superior, são necessários arquivos de alta resolução e atualização de `image_url` no banco.

**Publicação:** ZIP local, sem publicação GitHub confirmada. Homologação Supabase remoto pendente.
