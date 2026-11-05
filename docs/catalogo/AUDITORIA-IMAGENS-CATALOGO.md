# Auditoria de imagens originais — SERÁ QUEM FAZ?

## Fonte das imagens

A versão 3.3.5 restaurou o comportamento do ZIP de referência v3.0: as fotografias do catálogo são obtidas da coluna `public.categories.image_url` no Supabase. O pacote v3.0 não incluía as fotografias individuais em arquivos locais.

## Por que algumas áreas podem ficar sem foto?

1. `image_url` está vazio ou nulo.
2. A URL foi cadastrada com HTTP em vez de HTTPS.
3. O arquivo foi movido, apagado ou o host da imagem não permite acesso público.
4. A imagem original tem resolução insuficiente (por exemplo, 200 × 100 px) e fica borrada quando exibida em um cartão maior.

O site não reutiliza fotos de outras profissões. Na ausência de foto válida, apresenta um cartão neutro com o nome da categoria, sem falsa representação profissional.

## Consulta SQL de diagnóstico (somente leitura)

Execute no SQL Editor do Supabase conectado ao ambiente correto:

```sql
SELECT id, name, image_url
FROM public.categories
WHERE status = 'active'
  AND (image_url IS NULL OR btrim(image_url) = '' OR image_url !~* '^https://')
ORDER BY name;
```

Essa consulta mostra **apenas** os registros sem URL HTTPS. Uma URL HTTPS pode estar quebrada mesmo passando nessa consulta; verifique-a manualmente.

## Resolução ideal

Para cada categoria sem imagem, obtenha uma foto autorizada, adequada à profissão, com pelo menos 1200 × 675 px quando disponível. Preserve a proporção 16:9, evite rostos inventados como se fossem profissionais reais, use compressão WebP/JPEG de boa qualidade e mantenha a atribuição/licença em seus registros internos.

Atualize o endereço público de cada imagem em `categories.image_url` **após verificar o arquivo e sua origem**, preferindo Storage do próprio Supabase ou um CDN confiável. Não edite IDs nem os campos de avaliação para esse ajuste.

**Importante:** a aplicação não modifica `image_url`, nem envia arquivos nem executa migrações no Supabase por conta própria. Para aumentar a resolução real, é necessário o arquivo original; filtros CSS ou ampliar uma miniatura não acrescentam detalhes perdidos.
