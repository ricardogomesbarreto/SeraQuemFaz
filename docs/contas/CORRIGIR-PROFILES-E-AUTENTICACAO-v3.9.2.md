# Corrigir erro `public.profiles` e validar o menu de conta — v3.9.2

## Diagnóstico

A mensagem `PGRST205: Could not find the table 'public.profiles' in the schema cache` indica que o projeto Supabase configurado no site não expõe a tabela `public.profiles` por sua API. As causas mais comuns são: migração não aplicada, projeto Supabase diferente do configurado no site ou cache de esquema ainda desatualizado após a criação. O erro de rede 404 nessa consulta não significa que o usuário esteja deslogado.

1. Entre no painel do projeto Supabase cujo endereço corresponda a `assets/supabase-config.js` e confirme que está no ambiente correto. **Não compartilhe tokens privados**.
2. No **SQL Editor** do projeto de homologação, execute somente consultas de leitura:

```sql
select to_regclass('public.categories') as categories,
       to_regclass('public.profiles') as profiles,
       to_regclass('public.provider_services') as provider_services;
```

3. Se `categories` não existir, o catálogo original ainda não foi implantado. Prepare o esquema do catálogo conforme o projeto original **antes** da primeira migração, sem inventar registros ou sobrescrever dados.
4. Se `profiles` for nulo, **faça backup** e aplique na ordem `supabase/migrations/20261103_01_profissionais_avaliacoes.sql` até `20261104_10_resiliencia_solicitacoes.sql`, testando cada etapa em homologação. A migração 01 cria `public.profiles` e o gatilho de cadastro. Se as tabelas já existirem, examine os conflitos antes de reaplicar; não execute uma cadeia de migrações às cegas em produção.
5. Para foto de cliente privada, aplique **por último** `20261104_11_foto_privada_cliente.sql`. A foto do prestador continua pública conforme as políticas atuais.
6. Se `profiles` existir mas a API continuar retornando PGRST205, verifique o esquema exposto e atualize o cache do PostgREST (somente após conferir as migrações):

```sql
notify pgrst, 'reload schema';
```

7. Verifique o acesso com **três contas de homologação separadas**: cliente, prestador e administrador. Um usuário não pode ver informações privadas de outro, e clientes não devem publicar serviços profissionais.

## Testes de aceite

- Sem login: aparecem os botões Entrar e Criar conta, sem mostrar dados de uma sessão anterior.
- Com sessão válida e `profiles` disponível: o cabeçalho mostra nome e foto (ou iniciais), menu Minha conta, Editar meu perfil, Solicitações e mensagens e Sair.
- Com sessão válida e `profiles` ausente: mantém nome e botão Sair no cabeçalho, mostra dados básicos no painel e informa a necessidade de configurar o banco.
- Ao editar o nome de acesso na recuperação, a operação atualiza **somente** metadados do Auth. Não representa atualização do perfil público.
- Com foto privada de cliente: somente o titular pode ler e alterar a imagem; o visitante não acessa o bucket. Validar com URLs assinadas e regras RLS reais.
- Encerrar a sessão elimina o menu autenticado e restaura o menu de visitante.
- Mobile 390 px e desktop 1440 px sem transbordamento horizontal.

## Importante

Não habilite o Mercado Pago enquanto as migrações e os testes de homologação de autenticação, dados, políticas RLS e pagamentos não estiverem aprovados.
