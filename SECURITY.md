# Política de segurança — SERÁ QUEM FAZ?

## Estado

Este repositório inclui controles de confiança e segurança **preparados**, mas não comprova execução das migrações no Supabase de produção, validação documental nem testes de penetração. Não use o sistema com dados sensíveis antes de homologar a infraestrutura e a operação.

## Como relatar um problema

Não publique dados pessoais, tokens, senhas, URLs privadas nem provas de exploração em issues. Use o recurso privado **Security → Report a vulnerability** do repositório GitHub, se habilitado, ou o canal privado oficial definido pelo mantenedor. O canal de proteção de dados e contato do controlador devem ser divulgados antes do lançamento comercial.

## Controles da v3.4.0

- Autenticação Supabase Auth com confirmação de e-mail exigida pelo fluxo de análise de prestadores.
- RLS e grants explícitos: perfis públicos condicionados a aprovação; denúncias e pedidos LGPD sem leitura pública.
- Avaliações de atendimentos confirmados por duas contas e com moderação anterior à publicação; RPC pública sem identificador de avaliador.
- Reanálise obrigatória após mudanças relevantes no perfil, serviços e portfólio do prestador.
- Registros de mudança administrativa de aprovação e moderação.
- Recodificação local de imagens em WebP para reduzir metadados EXIF (não substitui análise de conteúdo e antivírus).
- Cabeçalhos HTTP de segurança para servidores compatíveis.

## Pendências obrigatórias antes da produção

1. Executar migrações em homologação, validar permissões reais e confirmar **negação** de acesso cruzado.
2. Configurar CAPTCHA (Turnstile/hCaptcha), rate limits de Auth, MFA para operadores, logs e monitoramento do Supabase.
3. Impedir documentos particulares em armazenamento público; idealmente, migrar conteúdos sensíveis a buckets privados.
4. Definir responsável administrativo, moderação, revisão documental/KYC quando necessário, contestação e resposta a incidentes.
5. Auditar fornecedores, transferências de dados, retenção, eliminação e bases legais conforme LGPD.
6. Executar testes de integração e testes adversariais com contas distintas e, antes do lançamento, pentest independente.

Guia detalhado: [`docs/seguranca/SEGURANCA-E-HOMOLOGACAO.md`](docs/seguranca/SEGURANCA-E-HOMOLOGACAO.md).


## Segurança administrativa v3.5.0

As operações do painel `admin.html` dependem das funções `sqf_staff_*` em PostgreSQL, da tabela fechada `sqf_admin_members` e da autenticação `aal2` do Supabase. O frontend apenas exibe dados retornados a contas já autorizadas. Não inclua chaves `service_role` no JavaScript, não conceda DML de administração a `authenticated` e nunca exponha os documentos pessoais em `storage.objects` público. Use o guia [PAINEL-ADMINISTRATIVO-SEGURANCA.md](docs/seguranca/PAINEL-ADMINISTRATIVO-SEGURANCA.md) para a instalação, segregação de funções e testes de tentativa de escalonamento de privilégios.

## Segurança das avaliações e retrato (v3.6.0)

Contestações de avaliações, respostas moderadas, verificação humana de retratos e controle de edição de objetos são preparados na migração SQL 05. É necessário executar testes reais de RLS, retenção, CAPTCHA, regras de privacidade e operação administrativa. A presença de MFA/autorizações no código **não significa** que o ambiente remoto já esteja protegido.

O bucket de avatar permanece público: fotos publicadas podem ser copiadas e compartilhadas por terceiros. Não envie documentos e não promova autenticidade documental usando apenas o retrato.


## Assinaturas e segurança financeira (v3.8.0)

- Segredos do Mercado Pago e `service_role` restritos a Edge Functions, jamais ao navegador.
- Apenas assinaturas e faturas consultadas de volta no Mercado Pago podem produzir período pago. Webhook é autenticado por HMAC e recurso é reconsultado; o próprio payload não dá acesso.
- O token Supabase determina a identidade do prestador; valor, ciclo e beneficiário são validados no servidor.
- As tabelas financeiras não concedem acesso de escrita nem leitura direta a `anon`/`authenticated`.
- Ativação comercial segue `SQF_BILLING_ENABLED=false` e `require_paid_subscription=false` por padrão.
- A homologação de antfraude, estornos, alertas de webhook, rate limiting e dados fiscais é obrigatória antes do lançamento.

## Novos controles v3.9.1 (ainda não implantados)

A migração `20261104_10_resiliencia_solicitacoes.sql` acrescenta RLS para marcação de leitura de mensagens, funções restritas ao participante e bloqueios transacionais contra corridas em limites de uso. Inclui uma política restrita para limpar apenas anexos privados órfãos do próprio remetente. **Não há criptografia ponta a ponta** e a validação efetiva de RLS só poderá ocorrer em ambiente PostgreSQL/Supabase de homologação.
