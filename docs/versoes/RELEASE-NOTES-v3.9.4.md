# SERÁ QUEM FAZ? · v3.9.4

Atualização de compatibilidade com o Supabase legado. A conta conectada mostra formulário completo de **dados básicos** e foto privada mesmo quando a tabela canônica `profiles` está ausente. O menu passa a usar uma única opção “Minha conta e perfil”; solicitações permanecem visíveis com diagnóstico das migrações necessárias. O design foi preservado.

## Segurança

A migração 12 cria uma **nova tabela privada** `sqf_account_settings` e o bucket privado `sqf-account-photos`, com RLS do titular e políticas restritivas para evitar exposição acidental. Não modifica tabelas antigas, não importa documentos, não concede aprovação de prestador e não ativa pagamentos.

## Limites de homologação

- O novo formulário salva foto/cidade após a migração 12 no projeto correto.
- Solicitações e mensagens só ficam operacionais após preparar as migrações 01–11 e testar autorizações.
- Os dados complementares são mantidos na tabela privada nova; a sincronização com módulos legados ou perfis públicos exige uma etapa posterior deliberada, não é automática.
- A validação feita aqui utiliza mock do Supabase no navegador. O Supabase real não foi acessado para gravar dados.

## Atualização de implantação

A migração privada foi aplicada e verificada em 04/11/2026 no projeto remoto: tabela `sqf_account_settings` com duas contas, bucket privado e políticas. Os módulos de mensagens e pagamentos permanecem inativos. Consulte `docs/relatorios/RELATORIO-SUPABASE-REMOTO-v3.9.4.md`.
