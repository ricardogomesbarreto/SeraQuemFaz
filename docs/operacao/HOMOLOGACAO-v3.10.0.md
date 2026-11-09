# SERÁ QUEM FAZ? — Homologação da v3.10.0

## Escopo e limites
Esta versão amplia a experiência visual e o fluxo operacional, mas **não comprova homologação de dados reais**. A migração aditiva, o endurecimento dos gatilhos e a migração de auditoria/índices foram aplicados ao projeto Supabase conectado em 09/11/2026; todas as tabelas novas estão com RLS habilitada, e a leitura anônima foi negada. Os testes com contas distintas e o navegador autenticado permanecem pendentes. A CI Node cobre sintaxe, contratos de código e testes locais, não substitui o navegador autenticado nem tentativas de acesso cruzado com usuários diferentes.

A agenda não representa reserva automática. Visualizações são contabilizadas **somente para visitantes autenticados** (máximo de uma por prestador/dia). A comparação de orçamentos mostra propostas independentes e não garante equivalência de escopo. O envio de e-mails fica desativado até configurar a integração externa. O Mercado Pago permanece desligado.

## 1. Ambiente
1. Fazer backup e testar restauração em ambiente de homologação **separado**. Não compartilhar usuários ou tokens de produção nos testes.
2. Confirmar esquema consolidado do Supabase, `profiles`, `sqf_service_requests`, `sqf_request_messages`, `sqf_admin_members`, `portfolio_photos`, `provider_services` e suas políticas.
3. No projeto conectado, verificar que as migrações `sqf_marketplace_experience_20261109`, `sqf_marketplace_trigger_hardening_20261109` e `sqf_marketplace_support_audit_indices_20261109` já constam do histórico; **não reaplicá-las**. Para outro projeto, aplicar o SQL aditivo e garantir revogação de EXECUTE das funções de gatilho. Não reaplicar migrações históricas.
4. Executar Security Advisor, confirmar todas as tabelas novas com RLS, grants e execução explícita de funções apenas por `authenticated`.
5. Publicar os arquivos HTML, CSS, JS, manifesto e Service Worker em origem HTTPS dedicada. Não validar PWA em `file://`.

## 2. Contas necessárias
- Cliente A e cliente B, sem dados pessoais reais.
- Prestador P aprovado e prestador Q não aprovado ou suspenso.
- Administrador e moderador explicitamente designados, com MFA/TOTP.
- Dados de teste separados e marcados como homologação.

## 3. Matriz operacional
| Caso | Resultado esperado |
| --- | --- |
| Cliente A abre perfil publicado | Acessa serviços, fotos e avaliações públicas somente |
| Cliente A abre perfil não publicado | Perfil indisponível |
| Cliente A envia solicitação a P | Apenas A e P veem solicitação e mensagens |
| Cliente B tenta consultar solicitação de A | Negado pelo RLS / RPC |
| Prestador responde com orçamento | Cliente recebe aviso interno sem conteúdo sensível |
| Cliente aceita orçamento | Solicitação muda de status pelo RPC existente |
| P propõe data, A confirma | Horário confirmado; ambas as contas conseguem consultar |
| P confirma a própria proposta | Negado no banco |
| Cliente tenta marcar horário de outro pedido | Negado |
| Agendamento após pedido cancelado ou concluído | Negado |
| Prestador organiza portfólio por serviço de outro usuário | FK rejeita a referência |
| Cliente compara propostas recebidas | Apenas propostas visíveis na conta; escopos não equiparados |
| Usuário A lê aviso privado de B | Negado |
| Usuário A altera destinatário de aviso | Negado; UPDATE restrito a `read_at` |
| Suporte envia pedido e lista histórico | Apenas o titular vê os próprios registros |
| Admin sem MFA consulta relatório/suporte | Negado |
| Admin com MFA consulta fila e resolve ticket | Permitido; dono recebe aviso interno |
| Visualização pública anônima | Não cria registro pessoal de visualização |
| Visualização autenticada repetida no mesmo dia | Um registro por visitante e prestador por dia |

## 4. Avisos por e-mail (opt-in)
A Edge Function `sqf-notifications` usa um provedor HTTP de e-mail e nunca é acessada diretamente pelo navegador. **Não ativar antes de testar**, configurar no Supabase:
- `SQF_NOTIFICATIONS_ENABLED=true`
- `SQF_NOTIFY_SECRET` forte e exclusivo
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (somente segredo da função)
- `RESEND_API_KEY`, `SQF_EMAIL_FROM` validado pelo provedor
- `SQF_SITE_URL` com HTTPS da origem publicada

A Edge Function precisa estar implantada para receber a chamada da rotina. No GitHub, definir `SQF_NOTIFY_URL` e `SQF_NOTIFY_SECRET` como secrets e só então habilitar `SQF_NOTIFICATIONS_ENABLED=true` como variável do workflow. O endpoint é protegido por segredo interno. Desabilitado por padrão. Revisar idempotência, reenvio, quotas, opt-in/opt-out e registros de envio antes de qualquer disparo a usuários reais.

## 5. Interface e dispositivos
- Chrome, Firefox e navegadores móveis em 390 px, 768 px e 1440 px.
- Formulário de perfil profissional, zoom e recorte; confirmar que não há campos escondidos por CSS.
- Navegação por teclado, zoom de página, foco visível e leitores de tela.
- Imagens acima de 5 MB são rejeitadas; dimensões em pixels não são critério.
- Cache offline serve somente arquivos públicos. Tentar abrir `painel.html` sem rede não deve expor dados antigos.
- Testar atualização de versão para evitar Service Worker servir recursos de versão anterior.

## 6. Publicação e rollback
- CI Node 22/24, empacotamento ZIP e testes de interface verdes.
- Conferir as funções no Supabase e política de RLS com sessões reais.
- Publicar versão com manifesto e Service Worker; validar atualização do cache.
- Registrar SHA, release, banco/migração, testes e plano de reversão.
- Não ativar checkout, notificações por e-mail ou escalar prestadores sem os gates acima.

**Estado de entrega:** código da versão preparado para revisão. A homologação funcional e as dependências externas são procedimentos separados, não resultados presumidos.
