# Administração de confiança e moderação — v3.5.0

## Objetivo

O painel `admin.html` permite administrar pedidos de revisão de prestadores, avaliações, denúncias e solicitações LGPD, **desde que** o usuário tenha sido autorizado no PostgreSQL e concluído MFA. Não existe cadastro de administradores pela interface pública. Todas as consultas e decisões usam funções RPC com verificação server-side de papel e nível de autenticação (AAL2). O HTML não constitui barreira de segurança.

## Requisitos e ordem de implantação

1. Faça backup integral, incluindo schema, políticas, funções e conteúdo (em homologação primeiro).
2. Aplique as migrações `20261103_01_profissionais_avaliacoes.sql`, `20261103_02_cidades_ibge.sql`, `20261103_03_confianca_seguranca.sql` e por último `20261103_04_painel_admin_mfa.sql`, sem pular etapas.
3. No Supabase Dashboard, habilite Auth MFA/TOTP (com fatores autenticadores). Configure confirmação de e-mail e limites de autenticação; use CAPTCHA, proteção de abuso e monitoramento conforme o plano.
4. Crie uma conta de responsável usando o fluxo normal de autenticação. Confirme o e-mail da conta e **não distribua credenciais compartilhadas**.
5. No **SQL Editor**, sob acesso autorizado de mantenedor, localize o UUID exato do responsável e crie a associação administrativa. Exemplo somente ilustrativo:

```sql
-- Conferir a conta antes de autorizar o acesso:
select id, email, email_confirmed_at
from auth.users
where email = 'EMAIL_DO_RESPONSAVEL@EXEMPLO.COM';

-- Substituir o UUID abaixo pelo ID realmente conferido:
insert into public.sqf_admin_members(user_id, role)
values ('00000000-0000-0000-0000-000000000000'::uuid, 'admin');
```

**Atenção:** o UUID `00000000-0000-0000-0000-000000000000` é fictício e não deve ser executado como está. Não conceda `INSERT`/`UPDATE`/`DELETE` na tabela de membros para `anon` ou `authenticated`; não crie RPCs de autoconcessão de papel.

6. Abra `admin.html` com a conta administrativa, ative o segundo fator no aplicativo autenticador TOTP e confirme o código. O acesso às filas requer JWT com `aal2` — uma conta com e-mail e senha, mesmo autorizada, não deve conseguir executar decisões.
7. Execute testes de autorização com usuários **anônimo**, **cliente**, **prestador**, **moderador AAL1**, **moderador AAL2**, **admin AAL1** e **admin AAL2**. Teste também chamada direta de RPC pelo cliente HTTP, sem a tela.
8. Reveja no Dashboard as policies existentes para garantir que não haja políticas permissivas herdadas em `public` e `storage.objects`. As policies restritivas da migração reforçam SELECT de perfis, serviços, fotos, avaliações, denúncias e solicitações LGPD, mas não substituem auditoria de todas as tabelas e buckets.

## Papéis e privilégios

| Operação | Administrador | Moderador |
| --- | --- | --- |
| Aprovar, rejeitar, suspender ou reabrir solicitação de prestador | Sim | Não |
| Publicar, rejeitar, ocultar ou restaurar avaliação | Sim | Sim |
| Analisar, resolver ou descartar denúncia | Sim | Sim |
| Acompanhar ou concluir solicitação LGPD | Sim | Não |
| Ver justificativas e trilha completa de decisões | Sim | Não |
| Cadastrar/alterar membro administrativo no frontend | Não | Não |

A concessão de papel é realizada somente por operador autorizado via SQL Editor, com controles da organização Supabase.

## Fluxo de decisão

O responsável deve escolher a ação, informar uma justificativa de **20 a 1.000 caracteres** e confirmar a decisão. O PostgreSQL valida o papel, AAL2, o estado atual do registro e as transições permitidas. A atualização e o registro em `sqf_staff_decision_log` são executados numa única transação da RPC. Justificativas não devem incluir CPF, RG, endereço ou documentação sensível.

- **Prestador:** aprovação exige perfil de prestador, e-mail confirmado, cidade IBGE, foto, apresentação e pelo menos um serviço. Esses requisitos **não comprovam a identidade civil ou competência profissional**. Profissões regulamentadas exigem verificação externa adequada.
- **Avaliação:** só é publicável se o banco reconhecer atendimento bilateral confirmado. Isso **não constitui evidência independente** de prestação do serviço; fraudes coordenadas entre contas ainda são possíveis.
- **Denúncia:** a conclusão exige análise real; encerrar uma denúncia não suspende automaticamente o prestador. Uma eventual suspensão precisa de decisão específica de administrador.
- **LGPD:** marcar como resolvido **não executa** exclusão, exportação ou correção automática. A equipe deve cumprir a operação efetiva no serviço e em seus processadores, registrar evidência interna e respeitar direitos, prazos e base legal aplicáveis.

## Segurança operacional complementar

- Aplicar limitação de requisições por IP/conta na borda e nos endpoints autenticados. Não assumir que `maxlength` no HTML é controle de segurança.
- Não hospedar service role no navegador, nem publicar documentos em buckets de avatar/portfólio.
- Considerar buckets privados para imagens sensíveis, se introduzidas. Mudar `sqf-avatars` e `sqf-portfolios` sem adaptar a aplicação fará imagens deixarem de carregar.
- Definir política de retenção e resposta a incidentes com responsáveis, prazos e processo de revogação de acesso.
- Monitorar eventos suspeitos de autenticação, abuso de avaliações, mudanças em permissões e aprovações atípicas.
- Formalizar verificação documental por fornecedor especializado, com consentimento ou outra base legal adequada, retenção mínima e possibilidade de contestação.
- Evitar selos do tipo “100% seguro”; usar “Cadastro analisado” e explicar o escopo da análise.

## Comandos de validação local

```bash
npm run verify
```

Esses testes validam a estrutura do código, não executam o Supabase hospedado. A homologação real exige testes contra um banco de testes com dados fictícios e diferentes papéis, mais revisão de um especialista em segurança antes de ativar no ambiente de produção.

## Fontes técnicas de referência

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Database functions e SECURITY DEFINER](https://supabase.com/docs/guides/database/functions)
- [Supabase: Auth MFA](https://supabase.com/docs/guides/auth/auth-mfa)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
