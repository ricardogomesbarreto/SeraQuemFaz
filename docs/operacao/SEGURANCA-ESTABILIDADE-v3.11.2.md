# SERÁ QUEM FAZ? — Segurança e homologação da v3.11.2

## Mudanças confirmadas e limite da revisão
- `provider_services`: as políticas `sqf_provider_services_read` e `sqf_services_approval_guard` tinham **o mesmo predicado** e os mesmos papéis; a migração 19 preserva a primeira e elimina apenas a segunda, recusando executar se as expressões divergirem.
- `sqf_notification_outbox` e `sqf_profile_views`: RLS está habilitada, sem políticas públicas; nem `anon` nem `authenticated` têm `SELECT` nas tabelas. **Não adicionar políticas permissivas** apenas para eliminar um aviso informativo.
- Funções públicas `sqf_provider_public`, `sqf_provider_completed_count`, `sqf_public_reviews` e `sqf_public_review_responses`: continuam deliberadamente executáveis por visitantes para alimentar perfis e avaliações publicadas. Os corpos consultados restringem dados conforme publicação e moderação. Dependências/uso de privilégios requerem revisão contínua; **um aviso de advisor não prova exploração**.
- Funções administrativas `SECURITY DEFINER`: têm acesso a papéis autenticados para permitir verificação de autorização interna, não a qualquer usuário de forma irrestrita. É necessário revisar controle de proprietário, MFA (aal2), papéis administrativos, taxas e argumentos em testes de integração com diferentes JWTs. Esta versão não revoga funções legitimamente usadas pelos fluxos.
- A aprovação de prestadores, o controle de visibilidade e as regras de assinatura não foram relaxados.
- As correções no catálogo e mensagens tratam indisponibilidade de serviços opcionais, sem mascarar falhas de autenticação ou autorização das consultas essenciais.

## Verificações reproduzíveis
1. Conferir a política restante:
   ```sql
   SELECT policyname,roles,cmd,qual FROM pg_policies
   WHERE schemaname='public' AND tablename='provider_services'
   ORDER BY policyname;
   ```
2. Confirmar que o acesso público não alcança perfis não aprovados:
   ```sql
   SELECT count(*) AS eligible FROM public.profiles p
   WHERE p.account_type='prestador' AND public.sqf_provider_public(p.id);
   ```
3. Verificar que o indicador de políticas duplicadas sumiu do Supabase Advisor; políticas ausentes em tabelas privadas são esperadas.
4. Testar em navegador com usuário anônimo, cliente, prestador pendente e administrador MFA: o catálogo só publica prestadores aprovados.
5. Simular falha temporária de `sqf_public_reviews` sem bloquear a consulta a `profiles`: cartões continuam carregando, nota não é inventada e filtro de avaliações fica indisponível.
6. Abrir `painel.html#%GG` com sessão de teste: o painel abre a visão geral sem travar.
7. Em solicitações, testar filtro “não lidas” indisponível e botão correspondente desabilitado.
8. Rodar `npm run verify` em Node 22 e Node 24 e testar empacotamento.

## Controles de configuração ainda dependentes de administração
- **Branch main:** a API reportou `protected=false`. A integração GitHub atual não concede permissão administrativa para alterar as regras. Definir no GitHub: Settings > Rules > Rulesets, exigir PR, checks da CI Node 22/24, impedir force-push e exclusão. Regras de revisão devem ser compatíveis com o número de revisores.
- **Senhas vazadas:** o Supabase Advisor apontou a proteção desativada. Verificar disponibilidade do recurso na assinatura do Supabase; a documentação informa que a proteção contra senhas vazadas exige Pro ou superior. Em Supabase Dashboard > Authentication > Settings, habilitar onde elegível.
- **Segurança E2E:** executar matriz de autorização de `sqf_staff_*`, solicitações, mensagens, agenda e avaliações entre dois usuários diferentes, incluindo tokens sem MFA.
- **Operação comercial:** não antecipar pagamentos Mercado Pago ou deploy Hostinger antes da aprovação formal.

## Evidências técnicas
- Auditoria de políticas e funções via Supabase em 09/11/2026 (timezone local).
- Testes Node e empacotamento via GitHub Actions.
- Logs da CI e arquivos migrados são referência de implementação; não comprovam testes visuais com usuários reais.
