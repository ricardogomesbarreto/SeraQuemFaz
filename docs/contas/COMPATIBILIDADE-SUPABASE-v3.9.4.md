**Atualização em 04/11/2026:** a migração privada 12 foi executada e verificada no projeto Supabase remoto. A sequência abaixo permanece como documentação de instalação, homologação e testes com usuários reais.

# Compatibilidade entre o esquema atual e o SERÁ QUEM FAZ? v3.9.4

## 1. O que foi comprovado pela captura

Seu Supabase tem `public.categories`. A consulta anterior retornou `NULL` para `public.profiles` e `public.provider_services`. A tela do Table Editor mostra tabelas com outros nomes: `public.users`, `public.user_profiles`, `public.providers`, `public.services`. O código moderno não pode presumir que `user_profiles` e `profiles` sejam a mesma estrutura. Além disso, o texto `CREATE TABLE` que você copiou traz o aviso **“for context only and is not meant to be run”**: é uma representação do esquema, não um script de instalação.

`to_regclass(...)` é uma **consulta de leitura** e não cria tabela. O valor `NULL` é o resultado esperado quando a tabela não existe. `NOTIFY pgrst, 'reload schema'` só atualiza o cache de metadados: **não cria tabelas ausentes**. Veja a [documentação do Supabase](https://supabase.com/kb/troubleshooting/refresh-postgrest-schema).

## 2. Preparar e diagnosticar (nenhuma alteração)

1. Confirme o projeto Supabase utilizado pelo site em `assets/supabase-config.js`. Não copie segredos nem tokens nesta conversa.
2. **Antes de executar migrações, faça backup e trabalhe em um projeto de homologação**, com cópia controlada dos dados quando for permitido.
3. No SQL Editor, rode `supabase/diagnostics/diagnostico_projeto_existente.sql`. Esse arquivo retorna as tabelas existentes, políticas RLS e buckets de fotos. Não grava nada.
4. Revise especialmente as políticas existentes de `users`, `user_profiles`, `providers` e `public_user_prof...` (a tela indica ao menos uma tabela sem restrição). As políticas antigas não são automaticamente alteradas por esta versão.

## 3. Habilitar a edição privada da conta

Depois de revisar o diagnóstico e o backup, abra e execute **inteiro** o arquivo `supabase/migrations/20261104_12_conta_compatibilidade_legada.sql` **no ambiente de homologação**. Ele é independente das migrações 01–11, embora seu número seja 12:

- Cria `public.sqf_account_settings` para nome, cidade, UF e caminho privado da foto; só o titular consulta/altera seus próprios dados.
- Copia apenas campos básicos da conta antiga para a nova tabela, **sem remover ou modificar `users`, `user_profiles`, `providers`, `services` ou `categories`**.
- Cria `storage.buckets` com `sqf-account-photos` privado, limitado a WebP e a 1,5 MiB, e políticas RLS restritivas por `auth.uid()`.
- Não cria `profiles`/`provider_services`, não libera perfil público e não altera assinaturas.

Depois de executar o SQL, confirme:

```sql
SELECT to_regclass('public.sqf_account_settings') AS conta_privada;
SELECT id, public FROM storage.buckets WHERE id='sqf-account-photos';
SELECT count(*) AS contas_importadas FROM public.sqf_account_settings;
NOTIFY pgrst, 'reload schema';
```

O resultado esperado inclui `sqf_account_settings`, um bucket com `public = false` e contagem coerente com as contas de `auth.users`. Faça logout/login no site e teste nome/cidade/UF/foto com **duas contas distintas**. A foto de um usuário nunca deve ser lida pelo outro. O nome pode ser sincronizado com metadados de Auth; dados de conta privados não aparecem como aprovação profissional.

## 4. Solicitações e mensagens — dependências necessárias

O botão de solicitações não pode operar no banco atual enquanto não existirem:

- `public.profiles` e `public.provider_services` (migração **01**, mais ajustes subsequentes);
- aprovação de prestadores, confirmações de atendimento e RLS (migrações **02–08**);
- `sqf_service_requests`, `sqf_request_messages`, `sqf_request_attachments`, `sqf_request_events` e as funções RPC (migração **09**);
- proteção contra concorrência, leitura e contagens de não lidas (migração **10**);
- bucket privado para fotos do cliente, se necessário (migração **11**).

**Não aplique essas migrações cegamente no banco principal.** Sua estrutura anterior pode conter relacionamentos e tipos diferentes. Em homologação, execute uma de cada vez na ordem, confirme o resultado e ajuste a migração de dados do legado quando necessário. A tabela `services` antiga, por exemplo, **não tem `provider_id`** no esquema que você mostrou; não há como associar automaticamente cada serviço a um prestador. Não invente vínculos.

Após a implantação, teste: cliente A envia solicitação ao prestador aprovado B, ambos podem ler somente suas mensagens, cliente C não consegue consultar a conversa, prestador suspenso não recebe novos aceites, e a confirmação do atendimento respeita o fluxo de avaliações.

## 5. Teste no seu Ubuntu (sem `file://`)

Na pasta descompactada do projeto:

```bash
npm run verify
python3 -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080/`. O navegador precisa ter Internet para conectar ao Supabase. Em Auth → URL Configuration, use URLs adequadas para homologação (não indiscriminadamente todas as origens). Isso não deve ser confundido com a habilitação de SMTP para os cadastros. Revise os limites de e-mail separadamente.

## 6. O que NÃO foi feito aqui

Nenhum SQL foi executado no seu Supabase remoto, nenhuma credencial privada foi solicitada, nenhuma conta foi criada ou aprovada, nenhum pedido ou pagamento foi lançado, e o repositório remoto não foi modificado. O ZIP contém código e scripts auditáveis, não uma implantação remota concluída.
