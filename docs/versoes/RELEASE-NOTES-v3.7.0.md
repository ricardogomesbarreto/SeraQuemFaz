# SERÁ QUEM FAZ? v3.7.0 — Painéis de cliente e prestador

**Disponibilidade:** código local preparado para homologação, sem atualização do GitHub ou aplicação no Supabase remoto.

## Novidades

- O cadastro existente de cliente ou prestador agora determina qual painel autenticado é apresentado automaticamente em `painel.html`.
- **Minha Conta:** cartões de atendimento, avaliações realizadas/pendentes, favoritos, atualizações de status e solicitações de privacidade; identidade e estilos existentes preservados.
- **Painel Profissional:** resumo de serviços, galeria, avaliações e confirmações pendentes, com links de acesso às funcionalidades que já existiam.
- Favoritos privados via tabela PostgreSQL `sqf_client_favorites`, com RLS e verificação de perfil público aprovado.
- Link para salvar/remover um profissional diretamente em seu perfil público (somente clientes autenticados).
- Cabeçalho adaptado à conta autenticada, sem repetir links de entrar/cadastrar no painel.
- Ajuste de dados pessoais do cliente sem exigir retrato profissional ou oferecer campo de publicação.
- Mensagens explícitas quando não houver registros ou quando as migrações não estiverem disponíveis.

## Segurança e limites

- A autorização real depende das políticas do Supabase; esconder um painel não é autorização suficiente.
- Dados mostrados ao cliente são limitados às linhas permitidas pelas políticas já existentes. Favoritos têm política própria.
- A lista de atendimentos são **confirmações pós-serviço**, não pedidos/contratações concluídas.
- As atualizações exibidas são derivadas do banco ao abrir ou atualizar a página. Não há notificação automática.
- Não foram modificadas regras antigas de avaliação, moderação, cadastro de prestadores, fotografia, MFA ou administração.

## Dependências

Migrações 01–05 aplicadas e homologadas antes de aplicar `20261104_06_painel_cliente_favoritos.sql`. Não ativar diretamente em produção sem backup e testes com contas reais.

## Testes

`npm run verify` e `python tests/browser-v370.py`; os testes de interface usam dados simulados.
