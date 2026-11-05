# SERÁ QUEM FAZ? — Painéis personalizados v3.7.0

## Definição e escopo

A versão 3.7.0 utiliza o fluxo existente de Supabase Auth e a rota autenticada `painel.html`. Após consultar `profiles.account_type`, mostra **Minha Conta** ao cliente e **Painel Profissional** ao prestador. Não existem dois bancos de usuários ou duas autenticações independentes. O frontend escolhe a apresentação; a autorização de dados permanece no PostgreSQL com RLS, grants e funções já instaladas.

### Cliente — Minha Conta

- Visão geral dos últimos 50 registros de confirmação de atendimento, até 50 avaliações e até 50 favoritos.
- Histórico de **solicitações de confirmação de atendimento** (estado `requested`) e confirmações aceitas pelo prestador (estado `confirmed`). **Não é um histórico de pedidos, agendamentos, pagamentos ou contratos concluídos.**
- Avaliações já enviadas, com pontuação informada pelo cliente e estado `pending`, `published`, `rejected` ou `hidden`, sem apresentar comentários pendentes como se fossem públicos.
- Atendimentos confirmados ainda sem avaliação vinculada; link para o perfil público, quando disponível.
- Favoritos privados, adicionados e removidos a partir do perfil de um prestador atualmente público e aprovado.
- Resumo de atualizações **derivado do estado atual dos registros** e botão de atualização manual. **Não existem notificações push, e-mail ou alerta em tempo real.**
- Histórico resumido das solicitações de privacidade já cadastradas e formulário existente para novos pedidos LGPD.
- Atualização de nome e município, sem publicar perfil pessoal de cliente no catálogo.

### Prestador — Painel Profissional

O painel existente continua como fonte de verdade para edição de dados, cidade, avatar, apresentação, serviços, portfólio, atendimento, contestação e respostas. Foram acrescentados contadores de serviços, fotos, confirmações pendentes e avaliações já publicadas, além de atalhos por seção.

### Regras de acesso

1. `profiles.account_type` é consultado após `auth.getUser()` e não é editável pelo usuário por meio do frontend.
2. Se a pessoa não estiver autenticada, o fluxo anterior a encaminha para `entrar.html`.
3. Consultas de histórico e avaliações do cliente **não filtram por `client_id` ou `reviewer_id` no frontend**: as permissões de leitura e as políticas RLS já existentes retornam apenas as linhas que pertencem ao usuário autenticado.
4. `sqf_client_favorites` inclui chave composta e regras RLS específicas. Somente a conta do cliente lê, insere ou remove seus favoritos; a inclusão exige perfil público aprovado.
5. Uma conta não pode editar o papel `account_type`, conceder a si própria status de administrador ou publicar prestador sem aprovação.
6. Solicitações LGPD não apagam automaticamente os dados. O painel administrativo continua separado, exigindo MFA.
7. O catálogo e a página pública de prestadores não são substituídos; a URL existente `painel.html` continua funcionando.

### Migração opcional e implantação

A v3.7.0 adiciona a migração `supabase/migrations/20261104_06_painel_cliente_favoritos.sql`. Execute-a **após** as migrações 01 a 05, somente em ambiente de homologação e após backup.

Sem a migração 06, o módulo de favoritos informa que está indisponível; os demais dados da conta podem continuar sendo consultados quando as migrações prévias estiverem instaladas. Nenhuma migração foi executada no Supabase remoto nesta entrega.

### Limitações atuais

- O registro de confirmação é único por relação cliente/prestador, conforme a restrição já existente. Um modelo futuro para múltiplos serviços exigirá fluxo de pedidos e evidências de serviço.
- As contagens do painel correspondem **aos registros recentes carregados** (limitados a 50) e não devem ser interpretadas como estatísticas vitalícias de alta escala.
- Favoritar não implica contratação, certificação, garantia de idoneidade ou aprovação pessoal pelo cliente.
- O fluxo não foi validado contra um banco de dados remoto nesta versão. Antes da produção, teste contas distintas, bloqueio de acessos cruzados, migração e rollback em homologação.

## Verificação local

```bash
npm run verify
python tests/browser-v370.py
```

Os testes de navegador usam dados inteiramente fictícios e não substituem ensaios reais de autorização por RLS e permissões.
