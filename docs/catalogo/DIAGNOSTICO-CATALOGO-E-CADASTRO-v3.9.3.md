# Diagnóstico de catálogo e cadastro — SERÁ QUEM FAZ? v3.9.3

## 1. O que as capturas demonstram

- Cidade corretamente selecionada, mas **zero categorias públicas**: `categories.js` filtra exclusivamente `status = 'active'`. A cidade é usada para encontrar profissionais na etapa seguinte; não remove categorias. A origem mais provável é uma tabela vazia, nenhum registro com status ativo, projeto Supabase diferente ou RLS/política de leitura ausente.
- Cadastro de prestador com **HTTP 429 / `email rate limit exceeded`**: o Supabase Auth atingiu o limite do envio de e-mails no projeto. **Isso não pode ser resolvido alterando o JavaScript nem repetindo o envio.**
- No teste local, o navegador abriu o arquivo por `file:///.../cadastro.html`. Para confirmação de e-mail e redirecionamentos de Auth, prefira servir o frontend por HTTP/HTTPS e configurar os URLs permitidos no Supabase.

## 2. Diagnosticar primeiro no SQL Editor do projeto CORRETO

Essas consultas são **somente leitura**:

```sql
select
  to_regclass('public.categories') as categories,
  to_regclass('public.profiles') as profiles,
  to_regclass('public.provider_services') as provider_services;
```

Se `categories` for `NULL`, a tabela não existe. **Antes de aplicar as migrações 01–11**, revise a preparação opcional `supabase/bootstrap/00_categorias_publicas.sql`. Faça backup e teste primeiro em homologação.

Se `categories` existir:

```sql
select status, count(*) as quantidade
from public.categories
 group by status order by status;

select id, name, status, image_url
from public.categories
order by name limit 20;
```

A interface real deve mostrar apenas categorias marcadas explicitamente como `active`.

Revisar permissões (somente leitura):

```sql
select n.nspname as esquema, c.relname as tabela, c.relrowsecurity as rls_ativo
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'categories';

select policyname, roles, cmd, permissive, qual
from pg_policies where schemaname='public' and tablename='categories';

select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='categories' and grantee in ('anon','authenticated');
```

A ausência de linhas para o papel `anon` indica que o visitante não conseguirá listar as categorias. Confira também o projeto Supabase em `assets/supabase-config.js`; a chave exibida no frontend é **publicável**, não deve ser trocada por `service_role`.

### Inicialização opcional do catálogo

`supabase/bootstrap/00_categorias_publicas.sql` foi preparado para criar a tabela se estiver ausente e preencher **apenas uma tabela inteiramente vazia** com 51 áreas básicas (sem fotos, profissionais, estrelas ou avaliações inventadas). Não sobrescreve registros, fotos ou estados já existentes. Se `categories.id` não aceitar geração automática, o script não importa registros. Revise a política RLS existente, pois políticas permissivas se somam.

A migração original 01 depende de `public.categories` e deve ser aplicada **somente depois de uma tabela compatível** existir. Aplicar a migração 01 sem o catálogo prepara um erro de referência. Se a tabela já existir, preserve os registros e as imagens originais.

O frontend v3.9.3 também fornece 51 **áreas de referência**, em memória, caso o Supabase não devolva dados. O usuário verá um aviso claro. Essas áreas não podem servir como identificadores para cadastro de serviços profissionais nem simulam disponibilidade na cidade.

## 3. Resolver `email rate limit exceeded` (HTTP 429)

Conforme a documentação Supabase em 04/11/2026, o provedor padrão de e-mail tem limite de **2 mensagens por hora em todo o projeto**, pode enviar somente para endereços autorizados da equipe e não é indicado para produção. Esse limite pode mudar. Fonte: https://supabase.com/docs/guides/auth/auth-smtp e https://supabase.com/docs/guides/auth/rate-limits.

Siga este procedimento no **painel do Supabase**:

1. Abra **Authentication → Logs** e confirme o erro/código (`over_email_send_rate_limit` ou `email_address_not_authorized`). Não exponha tokens de acesso nem e-mails dos usuários nos logs compartilhados.
2. Em **Authentication → SMTP Settings**, configure um provedor transacional (por exemplo Resend, Brevo, AWS SES, Postmark), com domínio próprio e SPF/DKIM/DMARC. Coloque credenciais SMTP **somente no servidor/painel Supabase**, nunca no HTML, JS ou GitHub.
3. Em **Authentication → Rate Limits**, ajuste o limite de envio conforme o serviço contratado e a política de segurança, mantendo proteção contra abuso e CAPTCHA.
4. Em **Authentication → URL Configuration**, configure `Site URL` e `Redirect URLs` do endereço HTTP/HTTPS que realmente hospeda o SERÁ QUEM FAZ?. Não use `file://` em produção.
5. Faça o cadastro de uma conta **de teste**, com e-mail acessível, e confirme o link. Depois faça login, selecione conta de prestador e verifique que `public.profiles` foi criado corretamente pelo trigger da migração 01.
6. Para desenvolvimento no Ubuntu, execute `python3 -m http.server 8000` na raiz extraída e abra `http://localhost:8000/`, registrando essa URL temporária na lista permitida do Supabase.

**Não** desative confirmação de e-mail, proteção contra robôs ou RLS para tentar contornar o 429. Não aumente limites indiscriminadamente. A correção da UI mostra uma mensagem objetiva e evita duas submissões simultâneas, mas **não remove o limite remoto**.

## 4. Homologação mínima após configurar o backend

- Conta visitante: lista apenas categorias `active`, imagens originais `image_url` se disponíveis.
- Cliente cadastrado com e-mail confirmado: login, painel privado, nenhuma permissão de alterar serviços ou perfil de outro usuário.
- Prestador cadastrado e ainda não aprovado: painel e edição restritos ao próprio usuário, sem perfil público antes de aprovação administrativa.
- Prestador aprovado: aparece apenas na cidade e categoria compatíveis; dados confidenciais nunca publicados.
- E-mail: confirmação, recuperação de senha, limite de envio e proteção antiabuso funcionam sem 429 em fluxo normal.
- Testes negativos: consultar dados privados de terceiros deve falhar (RLS), tentar usar id `ref-...` como categoria de serviço deve ser recusado.

**Estado da entrega:** código e scripts são locais; nenhuma consulta remota autenticada, execução SQL em produção ou envio real de e-mails foi realizado. O projeto permanece em homologação; checkout Mercado Pago desativado.
