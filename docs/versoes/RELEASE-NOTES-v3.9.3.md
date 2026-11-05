# SERÁ QUEM FAZ? v3.9.3 — Correção do catálogo e cadastro

- Catálogo público real continua baseado em `public.categories` e `status = 'active'`.
- Quando o Supabase retorna vazio ou falha, uma lista **editorial** de 51 áreas identificadas como não cadastradas mantém a navegação funcional, sem fingir que existem profissionais na cidade.
- Página de referência exibe a descrição do serviço, mas não busca nem mostra prestadores fictícios.
- Cadastro e login exibem erros mais específicos de limites do Supabase e impedem duplicação simultânea de solicitações de cadastro.
- Incluído script opcional de criação inicial de categorias **sem sobrescrever dados existentes**, mais diagnóstico SQL/RLS e procedimento SMTP.
- Nenhum banco remoto foi atualizado, nenhuma cobrança ativada, e nenhum repositório GitHub publicado.
