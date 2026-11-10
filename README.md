# SERÁ QUEM FAZ? — v3.14.0-rc.10

<p align="center"><img src="assets/brand/logo-horizontal.png" alt="Será Quem Faz?" width="380"></p>
<p align="center"><strong>Encontre profissionais da sua cidade. Organize serviços, propostas e atendimentos em um só lugar.</strong></p>
<p align="center">
<a href="https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/mysql-mariadb.yml"><img src="https://github.com/ricardogomesbarreto/SeraQuemFaz/actions/workflows/mysql-mariadb.yml/badge.svg?branch=feat/mysql-mariadb-migration" alt="CI MySQL/MariaDB"></a>
<img src="https://img.shields.io/badge/PHP-8.1%2B-777BB4" alt="PHP">
<img src="https://img.shields.io/badge/MySQL-8.0-4479A1" alt="MySQL">
<img src="https://img.shields.io/badge/MariaDB-10.11-003545" alt="MariaDB">
</p>

## Sobre

O Será Quem Faz? conecta clientes a prestadores de serviços locais. Pesquisa por município e categoria, perfis profissionais, orçamento, mensagens privadas, agenda, portfólio e avaliações compõem a plataforma. A publicação de prestadores depende de análise administrativa.

## Arquitetura oficial — Hostinger Unlimited

HTML, CSS e JavaScript; API PHP 8.1+; PDO MySQL; MySQL 8.0 ou MariaDB 10.11, InnoDB e UTC. Identidades e sessões próprias, RBAC administrativo com MFA, mídia privada fora da raiz web e fila de notificações. Mercado Pago com checkout desativado durante homologação. Destino futuro: Hostinger Unlimited (não Premium). PHP permanece por reaproveitar o backend homologado; Node.js é suportado pelo plano, mas uma reescrita não é necessária. Node 22+ é usado no build e nos testes, não como runtime obrigatório.

## v3.14.0-rc.10

Candidato exclusivo MySQL/MariaDB. Distribuição isolada, instalação SQL consolidada, testes PHP/HTTP/Chromium, integridade e restauração de banco descartável. O código histórico foi preservado no histórico Git; não faz parte do caminho de instalação atual.

| Módulo | Estado |
|---|---|
| Catálogo, perfil, solicitações, mensagens, agenda | Implementação candidata; CI obrigatória |
| Serviços, portfólio, avaliações, moderação | Implementação candidata; CI obrigatória |
| Segurança de conta, preferências, avisos | Implementação candidata; entrega real pendente |
| Assinaturas e faturamento | Leitura e reconciliação preparadas; checkout e sandbox pendentes |
| Migração de contas | Pré-validação sem persistência; transferência integral pendente |

## Executar e testar

Requisitos: Node 22+, PHP 8.1+ (PDO MySQL, mbstring, GD/WebP, cURL, fileinfo, Argon2id), MySQL 8.0 ou MariaDB 10.11.

```bash
npm run verify
npm run build:dist
```

O pacote fica em `dist/mysql-candidate/`. Importe `database/01-instalar-banco.sql` em banco novo e vazio. Configure `sqf-private/config.php` fora de `public_html`. Consulte [guia de instalação](database/hostinger/README.md) e [banco de dados](database/README.md).

## Homologação e publicação

Não é release comercial. Nenhuma implantação na Hostinger Unlimited antes de 100% de conversão e homologação. CI nos dois engines, paridade funcional, checkout/cancelamento/ciclo, sandbox, SMTP, migração de dados e arquivos, recuperação de contas, backup/restauração e LGPD são gates obrigatórios. Não publicar dados pessoais, credenciais ou snapshots no repositório.

## Preparação para o Unlimited

O pacote inclui perfil de hospedagem, regras de cache restritas a imagens públicas e diagnóstico CLI privado `php sqf-private/backend/bin/hostinger-preflight.php`. Confira os limites contratados no hPanel, configure HTTPS/CDN apenas para recursos públicos, backups diários, cron privado e transporte de e-mail após homologação. O diagnóstico não autoriza produção.

## Recursos recuperados na RC.8

PWA instalável com fallback offline genérico e cache exclusivo de imagens estáticas; favoritos de profissionais; comparação de propostas abertas; indicadores de visualizações autenticadas, solicitações, propostas e atendimentos. Todos os dados e permissões são consultados pela API PHP/MySQL/MariaDB. Node.js permanece disponível para build, CI e aplicações complementares, sem duplicar o backend. Novos testes precisam confirmar a homologação.

A administração recupera também indicadores agregados e exportação CSV sem dados pessoais; testes de concorrência do catálogo em CI registram latência local, não desempenho no hPanel.

## RC.9 — exclusividade do runtime

Autenticação, navegação, catálogo, detalhes, favoritos e imagens utilizam apenas a API PHP/MySQL/MariaDB. Removidos caminhos de compatibilidade inativos; auditoria bloqueia referências ao banco anterior e SDK legado no runtime. PWA e recursos recuperados da RC.8 preservados. A nova CI deve confirmar a regressão completa. Hostinger Unlimited permanece o destino; produção bloqueada.

## RC.10 — consolidação operacional

SMTP autenticado Hostinger com TLS; checkout inicial e cancelamento via API de teste, desativados por padrão; solicitação de mudança de ciclo preserva vigência sem cobrança imediata (renovação automática ainda pendente). Migration 007: índices e solicitação de ciclo. Importador privado de snapshot normalizado com contagem, FK, hashes de mídia e rollback; persistência apenas em staging explicitamente habilitado. Testes simulados e restauração de arquivos em CI. Nenhum dado real importado ou pagamento/e-mail enviado. CI e homologação real obrigatórias.

Exportação resumida dos dados da própria conta e [plano de recuperação e corte](database/hostinger/RECOVERY.md) adicionados. A resposta integral a direitos do titular e o ensaio de rollback real ainda exigem validação.
