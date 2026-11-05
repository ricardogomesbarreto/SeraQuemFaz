# Autenticação e confirmação por e-mail — v3.9.5

## Diagnóstico confirmado em 04/11/2026

O banco do projeto `SeraQuemFaz` possui 2 contas no Auth e **ambas com `email_confirmed_at` preenchido**. O link que desemboca em `localhost:3000` pode ter confirmado o endereço antes de falhar a abertura do site. Nenhum novo envio de confirmação é necessário para essas duas contas.

## Corrigir definitivamente o endereço de retorno

1. Publique o frontend em um **domínio real HTTPS**, acessível pelo computador e pelo telefone (por exemplo, o endereço de hospedagem que você efetivamente contratar). Não invente domínio nem use `localhost` para links enviados ao celular.
2. No painel do projeto Supabase, abra **Authentication → URL Configuration** (endereço: `https://supabase.com/dashboard/project/ujrzbwoqcgygaizxnyhl/auth/url-configuration`). Configure **Site URL** para esse domínio HTTPS e em **Redirect URLs** adicione exatamente `https://SEU-DOMINIO/entrar.html` e `https://SEU-DOMINIO/entrar.html?recuperar=1`, adaptando para o endereço real. Se usar outra rota no deploy, ajuste os caminhos.
3. No arquivo `assets/supabase-config.js`, preencha `publicSiteUrl` com o mesmo domínio HTTPS. Não inclua barra ou segredo; é uma URL pública. Em HTTPS público, o frontend pode também inferir o `location.origin`.
4. Confirme os links com uma conta **de teste**, sem solicitar repetidamente novos e-mails da conta existente.

## Testes locais

Na pasta do projeto, execute `python3 -m http.server 8080 --bind 127.0.0.1` e abra `http://127.0.0.1:8080/entrar.html` no **mesmo computador**. `localhost:3000` não funcionará se não houver um serviço na porta 3000. No celular, `localhost` aponta para o telefone; use o domínio HTTPS público.

Não desative a confirmação de e-mail e não eleve limites de envio apenas para contornar o erro.

## Confirmação por código (opcional, funciona mesmo sem link público)

1. No Supabase Dashboard → Authentication → Email Templates → **Confirm sign up**, utilize o exemplo pronto [`TEMPLATE-CONFIRMACAO-EMAIL.html`](TEMPLATE-CONFIRMACAO-EMAIL.html) (ou acrescente no corpo existente): `<p>Seu código de confirmação é: <strong>{{ .Token }}</strong></p>` sem remover o link `{{ .ConfirmationURL }}`. Faça backup do template anterior.
2. Quando receber novo e-mail, acesse a página **Entrar** da aplicação que estiver aberta no computador; clique **Tenho um código de confirmação de e-mail**; insira o endereço e os seis dígitos; o frontend chama `auth.verifyOtp({ email, token, type: 'email' })`.
3. Um código inválido ou expirado não deve ser reutilizado. Respeite limites de taxa do Auth.
4. As duas contas atualmente existentes já estão confirmadas e não precisam do procedimento.

A v3.9.5 não altera automaticamente o template remoto. A interface por código é um recurso **preparado**, dependente da configuração acima.

## Perfil do usuário

A migração `sqf_account_settings` já está aplicada e o bucket `sqf-account-photos` está privado. Se o painel ainda exibir somente “Sua sessão está ativa”, verifique a pasta aberta e atualize o frontend para v3.9.5; a v3.9.3 continha a tela antiga. O editor de foto/cidade/UF é exibido pela nova tela de recuperação quando a tabela `profiles` ainda não existe.

O cadastro de solicitações e mensagens depende de migrações adicionais (01–11), ainda não aplicadas; não forçar operações em produção.
