# Relatório técnico — SERÁ QUEM FAZ? v3.9.8

**Verificação em 05/11/2026 UTC** • Projeto Supabase `SeraQuemFaz`, `sa-east-1`, PostgreSQL 17.

## Banco disponível

- 3 contas Auth e 3 perfis modernos.
- 51 categorias ativas, 77 serviços do catálogo legado e 1.199 registros de lugares preservados.
- 5.571 municípios IBGE cadastrados.
- Tabelas de prestadores, especialidades, áreas atendidas, portfólio, verificação cadastral/documental, avaliação moderada e contestação, solicitações, orçamentos, conversas privadas, favoritos e contas financeiras.
- Tabelas financeiras vazias, controle de assinatura obrigatória `false`; nenhuma cobrança habilitada.
- Nenhum prestador cadastrado no modelo novo e nenhum administrador designado.

## Melhorias executadas nesta consolidação

- As migrações históricas de profissionais e cidade (01 e 02) foram registradas, mas a 03 falhou por incompatibilidade com uma função `void` já instalada. **Não insistimos no script conflitante**.
- Aplicada migração `sqf_consolidated_hardening_legacy_policy_cleanup` removendo policies permissivas antigas que se somavam às políticas consolidadas de verificação e moderação.
- Removido trigger redundante de inscrição `sqf_new_user`, permanecendo `sqf_new_auth_profile` como mecanismo principal de inclusão de perfis novos.
- Adicionadas regras restritivas sobre leitura de perfis, serviços, portfólio e avaliações.
- Teste simulado de RLS: sessão autenticada teve acesso a 1 perfil próprio e 1 configuração de conta; visitante anônimo leu 51 categorias, mas 0 perfis não aprovados e 0 avaliações diretas.

## Restrições e dependências

1. O backend existe, mas não houve homologação com três sessões reais (cliente/prestador/administrador). Os dados de prestação de serviço ainda estão vazios.
2. As funções financeiras Edge Function não foram implantadas, pois não há credenciais de sandbox nem URL HTTPS definitiva. Mercado Pago permanece indisponível.
3. Supabase Auth ainda precisa de configuração do controle de senhas vazadas, URL HTTPS de retorno, template SMTP/OTP, e validação operacional. Essas opções não estão expostas pelas ferramentas de administração conectadas nesta sessão.
4. Admin/MFA: somente um administrador designado explicitamente por pessoa autorizada pode receber papel; não atribuí privilégios a nenhuma das três contas existentes.
5. Alertas do Supabase ainda incluem funções SECURITY DEFINER intencionalmente expostas por RPC. Cada uma precisa auditoria de autorização por caminho; não é seguro revogar tudo automaticamente.
6. O Storage tem buckets públicos de avatares/portfólios e buckets privados para fotos da conta, documentos e anexos. Não enviar documentos pessoais aos buckets públicos.
7. O histórico local de SQL 01–12 diverge da linha remota consolidada. Não repetir scripts legados; crie migrations incrementais a partir do banco real.
8. Os 51 links de imagens de categorias dependem de fontes externas e carecem de curadoria/licenciamento para produção.

## Próximos gates de produção

- Snapshot/backup verificável e ambiente de homologação isolado.
- 3 contas dedicadas a testes e revisão dos fluxos de perfil, upload, aprovações, orçamentos, mensagens, anexos e avaliações.
- Auditoria de todas as RPC `SECURITY DEFINER` e análise de ataques IDOR/BOLA, limites de escrita e status.
- Ativar proteção de senhas comprometidas e SMTP em Supabase Auth.
- Definir membro administrativo explicitamente, MFA/TOTP e testes de segregação de papéis.
- Deploy e homologação da função Mercado Pago com segredos em ambiente de sandbox; simular cobrança aprovada, recusada, recorrência, webhook repetido, cancelamento, reembolso e contestação.
- Publicação versionada somente após gates verdes e verificação de backups.

**Não se afirma que o aplicativo esteja liberado para produção comercial.** Esta foi uma implantação e verificação parcial do backend real, com pagamentos desligados.
