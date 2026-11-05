# Relatório de validação — SERÁ QUEM FAZ? v3.9.5

**Data:** 04/11/2026.

## Evidência da inspeção do Supabase

Consultas de leitura no projeto SeraQuemFaz: 2 contas Auth, 2 com email confirmado e 0 aguardando confirmação; última confirmação em 04/11/2026. A tabela `public.sqf_account_settings` e o bucket privado `sqf-account-photos` foram criados na migração anterior v3.9.4 e permanecem disponíveis. Nenhuma alteração adicional ao banco nesta etapa.

## Testes locais

- `npm run verify`: 158/158 testes Node aprovados.
- Navegador Chromium com HTML/CSS/JS injetados e Supabase simulado: fluxos de código de seis dígitos e retorno ao formulário, em 1440 × 900 e 390 × 844, sem erros de JavaScript nem rolagem horizontal.
- Teste de HTTP local em Chromium com URL 127.0.0.1 bloqueado por política deste ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR`); usou-se harness isolado de DOM. Não foi testada a emissão de OTP ou redirecionamento pelo Supabase remoto.
- A estratégia de redirecionamento não gera URLs `file://` nem `localhost` para o e-mail; depende de HTTPS público ou Site URL configurado no painel do Supabase.
- Checkout Mercado Pago permanece desabilitado. Não houve mudança no banco, no template de e-mail remoto, nas URLs de Auth, nem publicação no GitHub.

## Pendências

1. Configurar domínio HTTPS e Auth → URL Configuration no Supabase quando houver URL oficial.
2. Para usar a confirmação por código, aplicar o template `docs/contas/TEMPLATE-CONFIRMACAO-EMAIL.html` no Supabase; a confirmação de contas atuais **já está completa**.
3. Validar login de um usuário real no frontend atualizado. Não foram utilizados senhas ou tokens reais nos testes.
4. Homologar e migrar, com segurança e em separado, os módulos ainda ausentes de perfis profissionais, solicitações e mensagens.
