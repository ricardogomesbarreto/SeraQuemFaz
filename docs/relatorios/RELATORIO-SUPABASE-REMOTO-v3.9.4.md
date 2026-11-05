# SERÁ QUEM FAZ? — Confirmação de implantação parcial no Supabase real

Data: 2026-11-04.
Projeto: `SeraQuemFaz` (`ujrzbwoqcgygaizxnyhl`, região sa-east-1).

## Migração aplicada com sucesso

- Identificador da migração: `20261104232630`.
- Nome: `sqf_account_settings_private_20261104`.
- `public.sqf_account_settings`: criada; 2 linhas para 2 contas no Supabase Auth.
- RLS habilitado; grants de `anon` para leitura: não. `authenticated`: SELECT e UPDATE habilitados, com políticas de titularidade por `auth.uid()`.
- Oito políticas de acesso da tabela (quatro permissivas e quatro restritivas) confirmadas.
- Bucket `sqf-account-photos`: confirmado **privado**, limite de 1.572.864 bytes, somente WebP.
- Políticas de arquivos privados: SELECT/INSERT/DELETE e guardas restritivas confirmadas; UPDATE bloqueado para o bucket.

## Não alterado

- 51 categorias ativas, 77 serviços legados, tabelas `public.users`, `public.user_profiles` e `public.providers`.
- Não foi instalado `public.profiles`, `public.provider_services`, `public.sqf_service_requests`, nem `public.sqf_request_messages`.
- Nenhuma assinatura ou cobrança foi ativada.

## Pendências reais

- Teste de upload de foto com conta autenticada no navegador e prova de isolamento entre contas.
- Compatibilização segura dos módulos `profiles` e `provider_services` com a base anterior, antes de instalar solicitações/mensagens.
- Auditoria da view `public.public_user_profiles` marcada como `SECURITY DEFINER` e da proteção de senha vazada no Auth.
- Publicar este frontend em hospedagem de homologação ou instalá-lo localmente para conferir a nova interface; a migração do banco, sozinha, não altera a aplicação aberta no navegador.

## Verificações realizadas

Leituras de catálogo, existência de tabelas, buckets, políticas RLS, privilégios de `anon/authenticated` e histórico da migração. Não houve teste autenticado de gravação de foto pelo navegador neste momento.
