# Relatório de validação — SERÁ QUEM FAZ? v3.9.6

**Fonte:** consulta somente de leitura à conexão Supabase do projeto `SeraQuemFaz` em 04/11/2026.

- `public.categories`: 51 registros, 51 ativos, 51 com `image_url` HTTPS.
- As imagens não estão em `storage.objects` (0 objetos). Os links são externos, incluindo miniaturas do Google.
- O frontend prioriza consulta ao Supabase, tenta API REST pública se `supabase-js` falhar e apresenta instantâneo histórico apenas quando o banco não responde ou retorna vazio.
- O modo histórico continua identificado como **referência**: não há perfis, avaliações nem vínculos de serviço fictícios.
- O modo histórico agora exibe o endereço original por categoria.
- Testes Node: **163 aprovados**.
- Testes Chromium simulados do catálogo: 1440 px e 390 px, em modos banco vazio/erro/real e fallback REST. Nenhum erro JavaScript relatado nesses testes.
- **Limite:** não foi possível verificar disponibilidade e qualidade de cada URL externa no navegador real deste ambiente. Como não são arquivos locais/Storage, podem expirar, bloquear hotlink ou não ter licença de uso comercial.
- **Implantação:** arquivo pronto para distribuição local. Não foi alterado Supabase SQL, configuração de autenticação nem GitHub.
