# SERÁ QUEM FAZ? — v3.9.19

<p align="center">
  <img src="assets/brand/logo-horizontal.png" alt="Logomarca do Será Quem Faz?" width="380">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-e34f26" alt="Frontend HTML, CSS e JavaScript">
  <img src="https://img.shields.io/badge/Banco-PostgreSQL-4169e1?logo=postgresql&logoColor=white" alt="Banco PostgreSQL">
  <img src="https://img.shields.io/badge/Backend-Supabase-3ecf8e?logo=supabase&logoColor=white" alt="Backend Supabase">
  <a href="https://github.com/ricardogomesbarreto/SeraQuemFaz/releases"><img src="https://img.shields.io/badge/vers%C3%A3o-v3.9.19-8b3a45" alt="Versão v3.9.19"></a>
  <a href="https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/ci.yml"><img src="https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/ci.yml/badge.svg?branch=main" alt="Status da integração contínua"></a>
</p>

## Proposta de valor

O **Será Quem Faz?** conecta quem precisa contratar um serviço a profissionais da sua região. O catálogo com sidebar permite pesquisar por município e categoria, consultar perfis e solicitar orçamentos. Clientes e prestadores conversam pelo painel e acompanham cada atendimento até a conclusão. O projeto começou em Santa Inês (MA) e usa o cadastro nacional de municípios do IBGE.

## Última versão · v3.9.19

- **Categorias do prestador corrigidas:** o acesso autenticado à lista de categorias ativas foi liberado mediante política RLS de somente leitura.
- **Cadastro de serviços mais resiliente:** os 51 itens ativos podem ser consultados e recarregados sem abandonar o formulário.
- **Erros esclarecidos:** conexão e bloqueios de acesso não são mais apresentados como ausência de categorias.
- **Segurança preservada:** a correção não concede permissão de criar ou alterar categorias.
- **Verificação:** consultas do Supabase como `anon` e `authenticated` retornaram 51 categorias ativas; CI Node 22/24 a validar neste PR.

[Histórico de versões](CHANGELOG.md)

## Funcionalidades e estágio atual

| Área | O que fazer |
| --- | --- |
| Catálogo | Escolha o município e a categoria. Abra o perfil publicado para consultar serviços, portfólio e avaliações moderadas. |
| Central do cliente | Encontre profissionais, salve favoritos, consulte orçamentos, acompanhe atendimentos e avalie serviços confirmados. |
| Central do prestador | Cadastre serviços, atualize o portfólio, acompanhe a análise cadastral, responda a solicitações e envie orçamentos. |
| Administração | Modere cadastros e avaliações com uma conta administrativa designada e MFA. |

Depois do login, `painel.html` apresenta atalhos conforme o tipo de conta. A caixa de solicitações permite filtrar por situação ou mensagens não lidas e pesquisar por palavras da descrição nas 40 solicitações mais recentes. Os indicadores de solicitações usam toda a atividade que a conta pode consultar. Se o resumo estiver indisponível, a caixa ainda pode exibir as solicitações recentes.

As conversas e os anexos de solicitações ficam restritos aos participantes. Envie apenas as informações necessárias ao atendimento. A publicação de um perfil profissional depende da análise cadastral.

## Supabase e estágio da implantação

A interface é estática, com HTML, CSS e JavaScript. O Supabase fornece autenticação, PostgreSQL, Storage e regras de acesso por linha (RLS). A tabela `sqf_account_settings` guarda configurações privadas. O banco consolidado já contém 5.571 municípios IBGE, 51 categorias ativas e estruturas de prestação de serviços, avaliações e mensagens.

A migração incremental `sqf_dashboard_request_summary` foi aplicada ao banco conectado. A função usa as permissões do usuário autenticado e a RLS da tabela de solicitações. A verificação no banco executou a função com papel autenticado simulado e confirmou o bloqueio para visitantes.

**Não repita o histórico SQL** de `supabase/migrations/` no projeto consolidado. A migração histórica 03 tem uma assinatura incompatível com a versão instalada de `sqf_request_verification()`. Consulte o [guia do Supabase](supabase/README.md) e o [relatório da implantação anterior](docs/operacao/STATUS-SUPABASE-v3.9.8.md).

A homologação ponta a ponta com contas reais de cliente, prestador e administrador está pendente. O checkout permanece desativado e a cobrança real depende da homologação do Mercado Pago.

## Mensalidade e expiração

A mensalidade é do prestador. Clientes podem continuar usando o catálogo, a conta e os atendimentos. A cobrança está desativada e o bloqueio abaixo passa a valer quando o controle comercial for ativado após homologação.

| Ação | Prestador sem vigência paga, com a cobrança obrigatória ativa |
| --- | --- |
| Aparecer no catálogo, abrir perfil, serviços, portfólio e avaliações pela vitrine | Indisponível ao público. Fotos em buckets públicos podem continuar acessíveis por links diretos já conhecidos. |
| Receber novas solicitações de orçamento | Bloqueado pelo banco. |
| Aceitar um orçamento ainda pendente | Bloqueado até regularizar a assinatura. |
| Iniciar ou finalizar um serviço com orçamento já aceito | Permitido ao prestador com perfil público e aprovado. O cliente pode confirmar a conclusão. |
| Entrar, editar a conta, preparar serviços e portfólio | Disponível ao titular. |
| Acessar conversas, orçamentos e atendimentos existentes | Disponível aos participantes, sujeito às regras de cada atendimento. |
| Consultar cobranças e regularizar a assinatura | Disponível quando a integração financeira estiver operante. |

O período mensal começa na aprovação do pagamento e vence no horário registrado no servidor, um mês calendário depois. Um pagamento pendente ou recusado não prorroga a vigência. Cancelar a renovação automática preserva o período já pago. Estornos e contestações retiram a vigência da fatura afetada quando reconciliados. Após novo pagamento confirmado, o perfil volta ao catálogo se continuar aprovado e marcado como público.

## Executar no Ubuntu ou em outro ambiente de desenvolvimento

Requer navegador moderno, **Node.js 22 ou 24** para testes e **Python 3** opcional para o servidor local.

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080/`. Não abra as páginas diretamente com `file://`, pois a autenticação por e-mail e o retorno do Supabase podem falhar. `localhost` no celular aponta para o próprio telefone; para testar em aparelhos externos, use **um endereço HTTPS válido** com redirecionamentos permitidos no Supabase.

```bash
npm run verify       # Sintaxe dos scripts e suíte Node
npm test             # Somente os testes Node
```

Por padrão, `assets/supabase-config.js` aponta para o projeto conectado. Para homologação isolada, configure a URL e a chave publicável do projeto de testes. No Supabase Auth, defina a URL HTTPS do site e autorize a rota de retorno usada pela aplicação. Use credenciais privadas apenas no servidor ou nas Edge Functions.

## Organização das pastas

```text
SeraQuemFaz-v3.9.16/
├── index.html                 # Landing page
├── cadastro.html / entrar.html
├── painel.html / admin.html
├── categorias.html / categoria.html / prestador.html
├── termos.html / privacidade.html
├── assets/
│   ├── brand/                 # Logotipos, ícones e favicon
│   ├── images/                # Imagens da interface
│   ├── category-fallbacks/    # Ilustrações locais de contingência
│   ├── site.css               # Estilos unificados
│   └── *.js                   # Módulos carregados pelos caminhos HTML existentes
├── docs/
│   ├── contas/ catalogo/ financeiro/ interface/
│   ├── seguranca/ operacao/
│   ├── relatorios/ versoes/
│   └── README.md              # Índice da documentação
├── scripts/                   # Rotinas de manutenção, municípios e GitHub
├── supabase/
│   ├── migrations/            # SQL histórico, NÃO executar indiscriminadamente
│   ├── applied/ bootstrap/ diagnostics/
│   └── functions/             # Edge Functions de pagamentos
├── tests/                     # Testes Node e Playwright
├── .github/workflows/         # CI, release e conciliação desativada
└── package.json
```

**Por que HTML e JavaScript continuam nesses caminhos?** A aplicação usa arquivos estáticos e links `categorias.html`, `assets/*.js` em produção. Movê-los sem uma etapa separada de migração de rotas quebraria sites, bookmarks e testes. A reorganização concentra-se no histórico e nos artefatos descartáveis, sem regressão funcional.

Os relatórios, notas antigas e guias estão indexados em [docs/README.md](docs/README.md). As imagens de testes de interface são geradas em `.artifacts/previews/` e **não fazem parte do código publicado**.


## Empacotar para hospedagem e GitHub

```bash
npm run verify
npm run build:dist
```

- **`dist/SeraQuemFaz_site_v3.9.16.zip`** — publicar somente os arquivos HTML e `assets/` no servidor, junto dos cabeçalhos aplicáveis.
- **`dist/SeraQuemFaz_codigo_v3.9.16.zip`** — documentação, testes, CI e migrações para desenvolvimento/GitHub.

A separação evita expor SQL, testes e relatórios no diretório público da hospedagem. O script não altera o Supabase, não habilita pagamento e não executa deploy.

Para enviar o código ao GitHub, use `bash scripts/publicar-github.sh` com o GitHub CLI autenticado na conta `ricardogomesbarreto`. O script valida o código, usa o repositório `SeraQuemFaz` e cria o destino como privado se ele ainda não existir. O ZIP do site serve para hospedagem estática. Configure a URL HTTPS e os redirecionamentos de autenticação antes de abrir o cadastro ao público.

## Segurança, privacidade e operação

- LGPD: clientes e prestadores podem registrar pedidos de acesso, correção ou exclusão de dados pela central autenticada.

- Supabase Auth e RLS: operar com credenciais publicáveis no cliente, testar isolamento de usuários no banco real.
- Fotografias privadas: `sqf-account-photos` está configurado como bucket privado, com caminhos por usuário.
- O catálogo usa links externos históricos: disponibilidade, qualidade e direitos de uso **não estão garantidos**. Substitua-os progressivamente por imagens próprias/licenciadas.
- Avaliações, aprovação de prestadores e mensagens dependem das migrações e de uma operação de moderação real.
- **Cobranças permanecem desabilitadas** até testes reais de Webhooks, cancelamentos, estornos e reconciliação.

Consulte [SECURITY.md](SECURITY.md), [autenticação por e-mail](docs/contas/AUTENTICACAO-EMAIL-v3.9.5.md), [auditoria de imagens](docs/catalogo/AUDITORIA-IMAGENS-CATALOGO.md), [integração financeira](docs/financeiro/INTEGRACAO-MERCADO-PAGO-v3.8.0.md) e [publicação no GitHub](docs/operacao/PUBLICACAO-GITHUB.md).

## Roadmap proposto

1. **Consolidar Supabase:** validar as políticas RLS com clientes, prestadores e administradores; compatibilizar dados legados sem perder registros.
2. **Homologar solicitações e mensagens:** autorização por participante, anexos privados, auditoria e confirmação bilateral do atendimento.
3. **Homologar pagamentos:** credenciais privadas, testes Mercado Pago, Webhooks e reconciliação antes de habilitar a cobrança.
4. **Melhorar distribuição e operação:** revisar imagens com direitos de uso, SEO, acessibilidade e monitoramento; publicar uma release versionada após aprovação.

## Desenvolvimento e histórico

- [Como contribuir](CONTRIBUTING.md)
- [Histórico resumido](CHANGELOG.md)
- [Notas por versão](docs/versoes/)
- [Validações e diagnóstico do Supabase](docs/relatorios/)

**Licenciamento:** antes de tornar público o código ou imagens de terceiros, confirmar a licença de cada recurso e o direito de distribuição. Não presuma que URLs de buscadores concedem licença de uso.

## Cadastro municipal versionado

O código IBGE de sete dígitos identifica cada cidade. `assets/municipios-br.json` inclui 5.571 registros copiados do cadastro do projeto, cuja origem registrada é “IBGE (espelho público)”, importado em 05/11/2026. A API oficial estava indisponível durante o empacotamento: esta versão não afirma uma nova sincronização oficial. O arquivo `.meta.json` registra origem, data, quantidade e SHA-256.

Execute `npm run cities:update` com acesso à API oficial para atualizar a lista. O processo verifica códigos únicos, correspondência entre código e UF e presença das 27 UFs antes de substituir o arquivo. Revise e publique juntos os dados e seus metadados. O navegador valida cache e arquivo local; usa a API oficial como alternativa, com limite de tempo e opção de tentar novamente. A cópia local permite selecionar cidades quando o IBGE está fora do ar; os serviços e contas continuam dependendo da conexão com o backend.

Esta versão melhora a descoberta de serviços e não altera tabelas, pagamentos ou regras de acesso. Modernizações adicionais dos painéis e dos cartões de profissionais continuam como próximas etapas.
