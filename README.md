# SERÁ QUEM FAZ? — v3.13.1

<p align="center">
  <img src="assets/brand/logo-horizontal.png" alt="Logomarca do Será Quem Faz?" width="380">
</p>
<p align="center">
  <strong>Encontre profissionais da sua cidade. Organize serviços, propostas e atendimentos em um só lugar.</strong>
</p>
<p align="center">
  <a href="https://github.com/ricardogomesbarreto/SeraQuemFaz/releases/latest"><img src="https://img.shields.io/github/v/release/ricardogomesbarreto/SeraQuemFaz?label=release" alt="Última release"></a>
  <a href="https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/ci.yml"><img src="https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <img src="https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-e34f26" alt="HTML CSS JavaScript">
  <img src="https://img.shields.io/badge/PostgreSQL-4169e1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Supabase-3ecf8e?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Node-22%20%7C%2024-339933" alt="Node 22 e 24">
</p>
<p align="center">
  <a href="#proposta-de-valor">Sobre</a> · <a href="#funcionalidades-e-estágio-atual">Funcionalidades</a> · <a href="#executar-localmente">Executar</a> · <a href="#arquitetura">Arquitetura</a> · <a href="#roadmap-proposto">Roadmap</a>
</p>

## Proposta de valor

O **Será Quem Faz?** aproxima clientes e prestadores de serviços locais. O projeto começou em Santa Inês (MA) e utiliza um cadastro nacional de municípios para facilitar a descoberta de profissionais. O catálogo com sidebar permite pesquisar cidade e categoria, consultar perfis publicados, serviços, portfólio e avaliações. O cliente solicita orçamento, acompanha a conversa e a agenda; o prestador organiza propostas e atendimentos no seu painel.

A plataforma não presta o serviço, não certifica idoneidade ou qualificação e não garante preços ou resultados. A publicação depende de análise administrativa. A operação comercial ainda não foi homologada.

## Última versão · v3.13.1

A v3.13.1 acrescenta proteção transacional contra sobreposição de atendimentos confirmados, por cliente e por prestador. Propostas não reservam horários; duas confirmações concorrentes não podem ocupar o mesmo intervalo. A CI executa Node 22, Node 24 e um teste PostgreSQL 16 com sessões concorrentes.

**[Notas da release](docs/versoes/RELEASE-NOTES-v3.13.1.md)** · [Histórico completo](CHANGELOG.md) · [Todas as releases](https://github.com/ricardogomesbarreto/SeraQuemFaz/releases)

| Download | Finalidade |
| --- | --- |
| [Site v3.13.1](https://github.com/ricardogomesbarreto/SeraQuemFaz/releases/download/v3.13.1/SeraQuemFaz_site_v3.13.1.zip) | Frontend estático para testar ou hospedar |
| [Código v3.13.1](https://github.com/ricardogomesbarreto/SeraQuemFaz/releases/download/v3.13.1/SeraQuemFaz_codigo_v3.13.1.zip) | Desenvolvimento, SQL, testes, CI e documentação |

## Funcionalidades e estágio atual

| Módulo | Recursos | Estado |
| --- | --- | --- |
| Catálogo | Busca por município/categoria, sinônimos, sugestões, filtros, avaliações e portfólio | Implementado; depende de perfis aprovados |
| Cliente | Perfil, favoritos, atividades, comparação de orçamentos, agenda, configurações e LGPD | Implementado; homologação multiusuário pendente |
| Prestador | Perfil, serviços ativos e estimativas, portfólio por serviço, verificação, propostas e métricas | Implementado; publicação depende de análise |
| Contratação | Solicitações, conversas, anexos privados, orçamento, eventos, aceite e conclusão | Implementado; ciclo completo pendente |
| Agenda | Propor, confirmar, recusar, cancelar; filtros e conflito transacional | Migração aplicada; teste concorrente isolado aprovado |
| Confiança | Avaliações moderadas, respostas, contestação, documentos privados e suporte | Implementado; operação administrativa pendente |
| Administração | Filas de moderação, decisões, MFA, indicadores e CSV | Implementado; designação de operador pendente |
| PWA | Manifesto, instalação em HTTPS/localhost, cache de conteúdo público | Implementação básica; atualização/offline a homologar |
| Notificações | Avisos internos, preferências e fila de e-mail | Estrutura disponível; envio externo desativado |
| Assinaturas | Fluxos e regras de Mercado Pago, faturamento e reconciliação | Checkout desativado; homologação financeira pendente |

### Como funciona

**Cliente:** escolher município e categoria → consultar perfil publicado → solicitar orçamento → conversar e comparar propostas → aceitar → agendar → confirmar conclusão → avaliar.

**Prestador:** criar conta → preencher perfil e cadastrar serviços → enviar documentação/análise quando exigida → aprovação administrativa → receber solicitações → propor orçamento → acompanhar atendimento.

**Administração:** acessar `admin.html` com uma conta designada e MFA, revisar solicitações de publicação, moderação, suporte e indicadores. O frontend não concede privilégios administrativos por si só.

## Estado técnico — auditoria de 10/11/2026

- 16 releases oficiais (v3.9.11–v3.13.1), 32 arquivos ZIP; CI da main aprovada com 226 testes Node e o teste PostgreSQL de agenda.
- Supabase: 40 tabelas públicas com RLS habilitada, 51 categorias ativas e 5.571 municípios. Há 2 clientes, 2 prestadores, nenhum profissional elegível para publicação e nenhuma solicitação registrada.
- Não há membros administrativos designados nem Edge Functions implantadas. A cobrança obrigatória está desativada.
- RLS e CI não equivalem a homologação real. Ainda são necessários testes com contas distintas, revisão de privilégios, proteção da main e operação administrativa.

A evidência, os riscos e os critérios de conclusão estão no [relatório de auditoria e roadmap](docs/operacao/AUDITORIA-ROADMAP-20261110.md).

## Arquitetura

| Camada | Tecnologia e responsabilidade |
| --- | --- |
| Interface | HTML, CSS, JavaScript modular; páginas estáticas e navegação por tela em `painel.html` |
| Identidade | Supabase Auth, confirmação de e-mail e MFA administrativo |
| Dados | PostgreSQL, RLS, RPCs, constraints e transações |
| Arquivos | Supabase Storage; buckets privados para conta, cliente, anexos e documentos |
| Integrações | Edge Functions TypeScript para Mercado Pago e notificações; segredos exclusivamente no servidor |
| Qualidade | GitHub Actions, Node 22/24, testes Node, fixture PostgreSQL e testes browser existentes |
| Distribuição | ZIP do site e ZIP do código; hospedagem estática em HTTPS |

O navegador usa chave **publicável** do Supabase; autorização e regras decisivas ficam no banco, não no JavaScript. A chave service_role, tokens de pagamento e segredos de webhook jamais devem integrar o frontend. A arquitetura estática é intencional: não exige servidor Node para servir as páginas.

## Executar localmente

Requisitos: navegador moderno, Git, Node.js 22 ou 24, Python 3 para servidor HTTP e zip/unzip para empacotar.

```bash
git clone https://github.com/ricardogomesbarreto/SeraQuemFaz.git
cd SeraQuemFaz
python3 -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080/`. No Windows, execute `py -m http.server 8080 --bind 127.0.0.1`. Se baixar o ZIP do site, entre na pasta extraída que contém `index.html`. Não abra por file://: login, redirecionamentos e PWA dependem de um contexto HTTP/HTTPS adequado.

**Atenção:** a configuração atual aponta para o Supabase conectado. Para desenvolvimento, use um projeto de homologação separado, ajuste URL/chave publicável em `assets/supabase-config.js` e configure as URLs autorizadas do Auth. Não use dados pessoais reais para testes.

### Testes e empacotamento

```bash
npm run verify       # Sintaxe e testes Node
npm test             # Suíte Node
npm run build:dist   # Dois arquivos ZIP
```

O job PostgreSQL executa `bash tests/postgres/appointment-concurrency.sh` em banco descartável; **não execute a fixture no banco conectado**. Os testes browser em Python/Playwright precisam de ambiente próprio e não fazem parte da CI atual. Veja [homologação](docs/operacao/HOMOLOGACAO-v3.12.0.md) e [CI](https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/ci.yml).

Os ZIPs são versionados a partir de package.json; somente o pacote do site deve ir para o diretório público. O build não implanta serviços, migra o Supabase ou ativa pagamentos.

## Organização do repositório

```text
SeraQuemFaz/
├── index.html, categorias.html, categoria.html, prestador.html
├── cadastro.html, entrar.html, painel.html, admin.html
├── ajuda.html, termos.html, privacidade.html
├── assets/           # JS, CSS, marcas, imagens e cadastro municipal
├── supabase/
│   ├── migrations/   # Histórico SQL incremental
│   ├── applied/      # Registros de consolidação já aplicada
│   ├── diagnostics/  # Diagnósticos de leitura
│   ├── functions/    # Integrações server-side
│   └── tests/        # Testes SQL
├── tests/            # Node, browser e PostgreSQL isolado
├── scripts/          # Build, municípios e publicação
├── docs/             # Guias, relatórios, versões, roadmap
├── .github/workflows/
├── manifest.webmanifest, service-worker.js
└── package.json, version.txt
```

## Banco de dados e privacidade

O banco consolidado inclui perfis, `sqf_account_settings`, serviços, verificações, solicitações, mensagens, agenda, avaliações, suporte e faturamento. **Não repita o histórico SQL** de migrations/ no projeto consolidado. A migração histórica 03 possui assinatura incompatível de `sqf_request_verification()`; novas mudanças devem partir de um diff do banco, backup e ambiente de homologação. Consulte [Supabase](supabase/README.md).

- RLS protege dados por papel e titularidade; funções privilegiadas exigem auditoria de autorização por objeto.
- Fotos de cliente/conta e anexos/documentos são privados. Avatares profissionais e portfólio possuem buckets públicos: links diretos conhecidos podem continuar acessíveis independentemente da publicação no catálogo. Não armazenar documentos pessoais nesses buckets.
- LGPD: fluxos de acesso, correção e exclusão de dados; definir retenção, responsáveis e operação de atendimento antes do lançamento.
- O cadastro municipal versionado contém 5.571 registros; origem e SHA-256 em `assets/municipios-br.meta.json`. `npm run cities:update` consulta o IBGE; não significa sincronização contínua. Revisar mudanças antes de publicar.
- As imagens externas históricas exigem auditoria: direitos de uso não estão garantidos. Confirmar licenças e substituir recursos quando necessário.
- A PWA não disponibiliza contas, mensagens, anexos ou administração offline.

Leia [SECURITY.md](SECURITY.md), [segurança administrativa](docs/seguranca/PAINEL-ADMINISTRATIVO-SEGURANCA.md) e [auditoria de imagens](docs/catalogo/AUDITORIA-IMAGENS-CATALOGO.md).

## Modelo comercial

O modelo prevê mensalidade do prestador, mantendo a conta do cliente e o acompanhamento de contratações. **Nenhuma cobrança real está ativada.** Quando habilitada após homologação, a vigência verificada condicionará novas oportunidades e publicação, preservando o acesso autorizado a atendimentos existentes. Cancelar renovação preserva o período pago; estornos e contestações requerem reconciliação.

O checkout, os webhooks, a conciliação, o envio automático de e-mail e a hospedagem definitiva ficam para a etapa final. Consulte [homologação financeira](docs/financeiro/HOMOLOGACAO-FINANCEIRA-v3.9.0.md).

## Roadmap proposto

| Versão | Prioridade |
| --- | --- |
| v3.13.2 | Baseline de banco reproduzível, governança, segurança e contas de homologação |
| v3.14.0 | Contratação ponta a ponta, propostas detalhadas e testes multiusuário |
| v3.14.1 | Disponibilidade semanal, bloqueios e reagendamento sem perder reserva confirmada |
| v3.15.0 | Busca regional, portfólio, acessibilidade, responsividade e PWA |
| v3.16.0 | Suporte, notificações em sandbox, métricas, monitoramento e recuperação |
| v3.17.0 | Mercado Pago em sandbox e homologação financeira |
| v4.0.0-rc.1 | Candidata em staging HTTPS, segurança e aceite formal |
| v4.0.0 | Liberação comercial condicionada aos gates anteriores |

O [roadmap detalhado](docs/operacao/AUDITORIA-ROADMAP-20261110.md) define evidências e critérios de aceite. Estas versões são propostas de planejamento, não releases existentes. Não promover a v4.0.0 apenas porque o código passou na CI.

## Documentação e contribuição

[Índice da documentação](docs/README.md) · [Como contribuir](CONTRIBUTING.md) · [Segurança](SECURITY.md) · [Notas por versão](docs/versoes/) · [Histórico](CHANGELOG.md)

**Licenciamento:** a licença do código e os direitos de distribuição das imagens devem ser formalizados pelo mantenedor. Repositório público não significa licença aberta automática.
