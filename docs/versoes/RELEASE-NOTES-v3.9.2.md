# SERÁ QUEM FAZ? — v3.9.2

## Objetivo

Corrigir a experiência de sessão em clientes e prestadores sem alterar a identidade visual ou a arquitetura comercial da v3.9.1.

## Alterações

- Cabeçalho dinâmico em todas as 10 páginas: visitante visualiza Entrar/Criar conta; sessão válida visualiza avatar (foto, quando disponível, ou iniciais), nome e menu com atalhos.
- Ação de **Sair da conta** visível e acessível pelo menu mesmo se o esquema `public.profiles` estiver indisponível.
- O usuário autenticado consegue consultar os dados básicos de Auth, editar o nome de acesso e tentar carregar novamente enquanto aguarda a implantação das migrações.
- Clientes poderão cadastrar foto privada opcional após a migração 11, sem expor a imagem em um bucket público. Prestadores mantêm o retrato e as verificações anteriores.
- Correções responsivas para o menu no celular, posicionamento de âncoras e estados de carregamento.

## Observações de segurança

- A interface autenticada **não autoriza** leitura ou escrita fora das permissões do servidor.
- Os metadados do Auth não substituem a coluna `account_type` em `public.profiles` para determinar permissões administrativas ou publicação.
- A migração 11 não cria `public.profiles`: é obrigatório aplicar a migração 01 primeiro, com as dependências necessárias, depois de preparar as tabelas de categorias.
- URLs assinadas ainda poderão ser acessadas por quem possuir o endereço enquanto não expirarem; foto privada não equivale a sigilo absoluto.
- Os testes são simulados. O Supabase remoto, o Mercado Pago e o GitHub **não foram alterados**.
