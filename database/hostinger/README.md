# Hostinger Unlimited — MySQL/MariaDB (homologação)

Não implantar em produção. Gere `npm run build:dist` na raiz. O pacote `dist/mysql-candidate` contém public_html, sqf-private e database. Importe database/01-instalar-banco.sql em um banco novo e vazio no hPanel/phpMyAdmin; confira SHA256SUMS e execute 02-verificar-banco.sql. Matriz testada: MySQL 8.0 e MariaDB 10.11; confira a versão contratada.

PHP 8.2+ (8.3 ou superior recomendado para a Hostinger), PDO MySQL, mbstring, GD/WebP, fileinfo, cURL, Argon2id e HTTPS. Copie public_html para a raiz pública; mantenha sqf-private fora dela. Copie config.example.php para config.php no diretório privado e configure DSN mysql:, usuário, senha e mídia privada. Não exponha SQL, arquivos de configuração ou snapshots. Checkout, webhook e notificações desativados por padrão.

O CLI de notificações e a pré-validação de identidades ficam em sqf-private/backend/bin. Testar somente em ambiente descartável. A implantação comercial depende dos gates descritos no README principal.

## Recursos do Unlimited e configuração prevista

- Destino oficial: Hostinger Unlimited. A oferta atual inclui 50 GB NVMe no Brasil, CDN, backups diários e suporte Node.js; confirme os recursos e limites exatos no hPanel da conta, pois variam por geração e região. Não confundir sites ilimitados com recursos computacionais ilimitados.
- PHP 8.3 ou superior, conforme opções efetivas do hPanel, com extensões indicadas acima; Node 22+ apenas build/CI. O backend atual não necessita processo persistente.
- Execute `php sqf-private/backend/bin/hostinger-preflight.php` via SSH/CLI no diretório do domínio, com config.php e media provisionados. O diagnóstico verifica PHP, extensões, diretórios, conexão, versão testada, catálogo e bloqueios comerciais; não imprime segredos.
- CDN/cache: cacheie exclusivamente arquivos públicos estáticos; exclua /api/*, páginas de login/painel/admin, cookies/sessões e mídia servida pela API. O pacote inclui .htaccess; validar cabeçalhos no servidor real. Não habilitar cache de respostas privadas.
- Backups: habilitar/verificar backups diários do hPanel, retenção e restauração de arquivos e banco. Manter cópia externa cifrada e testar restauração separada; backup da hospedagem não substitui esse teste.
- Cron Jobs: executar CLI privado de notificações com intervalo conservador, respeitando quotas de e-mail e CPU; conciliação financeira e manutenção só após implementação/homologação. Não ativar cron antes do gate.
- E-mail: provisionar caixa do domínio, SPF/DKIM/DMARC; confirmar SMTP no hPanel (normalmente smtp.hostinger.com, TLS 465 ou STARTTLS 587). O código usa SMTP autenticado via TLS; a entrega real precisa ser homologada. Evitar usar quota de caixas como quota de envio; limite publicado de envio pelo servidor 10/min e 100/dia, conferir plano/serviço.
- Staging: subdomínio separado, banco e credenciais próprios, sem cópia de dados privados sem autorização. SFTP/SSH e integração Git apenas com pacote revisado; nunca publicar sqf-private em public_html.

Referências oficiais: https://www.hostinger.com/br/hospedagem-php ; https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/ ; https://www.hostinger.com/support/1665153-how-to-activate-daily-backups-in-hostinger/ ; https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/ .

### Rotina de manutenção

Após homologação, configure um Cron Job PHP para `sqf-private/backend/bin/maintenance.php` (por exemplo, a cada hora), habilitando `SQF_MAINTENANCE_ENABLED=1` no config privado. Remove somente tokens de autenticação e limites de tentativas expirados, em lotes de até 200 por execução e com bloqueio concorrente. Não modifica contas, pedidos, faturas ou mídia. Por padrão permanece desativado. Não agendar antes da aprovação do ambiente.

## PWA e paridade funcional

RC.8 recupera instalação PWA, favoritos de profissionais, comparação de propostas e métricas. O service worker não armazena páginas de conta, API, mensagens ou mídia privada. CDN deve respeitar a exclusão de API e páginas autenticadas. Node.js é usado no build e nos testes Chromium; o PHP continua sendo o runtime da API. Não há segunda aplicação Node obrigatória.

## RC.10

SMTP por TLS 465: SQF_SMTP_ENABLED, SQF_SMTP_USER, SQF_SMTP_PASSWORD e SQF_MAIL_FROM (mesma caixa), desativado por padrão. Homologue confirmação, recuperação e avisos com caixa autorizada. Checkout sandbox exige SQF_MP_CHECKOUT_ENABLED=1, credencial TEST-, SQF_SITE_URL HTTPS e flag checkout_enabled no banco descartável; não ativar em produção. A solicitação de ciclo não dispara renovação automática. Importador privado em backend/bin/import-snapshot.php, use dry-run e compare inventários antes de staging; rollback de produção ainda requer ensaio e plano de corte. Valide índices por EXPLAIN e latência no hPanel.

A instalação limpa desta pré-release inclui as migrações 001–010. Testar índice único de contrato atual em ambos os engines; renovar apenas depois de cancelamento confirmado e fim do período pago. Histórico preservado. A renovação exige novo checkout explícito; não há renovação automática de ciclo. Importação normalizada inclui 33 conjuntos, com teste relacional e mídia. Não liberar produção sem CI e homologação real.

## Pré-release v3.14.0-rc.15 e hospedagem real

A tag e a release de homologação são publicadas **somente se** auditoria e jobs MySQL/MariaDB da mesma revisão passarem. Os arquivos da release são os ZIPs de instalação, scripts SQL e SHA256SUMS; o arquivo ZIP do repositório não é instalador. Na Hostinger selecione **site PHP/HTML personalizado**; não use o assistente que espera um backup de outro site. Se a versão MySQL/MariaDB disponível no hPanel divergir das versões exercitadas na CI, homologar novamente antes do uso.

Configure PHP 8.3 no hPanel quando disponível (mínimo suportado pelo preflight: 8.2), HTTPS, extensões necessárias, banco exclusivo de staging e credenciais fora da raiz web. Nunca desative o WAF ou afrouxe permissões de mídia para contornar erros. A release permanece proibida para produção até os ensaios reais documentados.

## Como criar os arquivos de upload do hPanel

Execute `npm run build:hostinger` com Node.js 22+ na sua máquina ou baixe o artefato `hostinger-unlimited-staging-uploads` da execução **repository-audit** no GitHub Actions. A rotina gera `dist/hostinger-upload/` com:

- `site-public_html.zip`: **somente** HTML, CSS, JS, imagens, PWA, regras `.htaccess` e entrada PHP da API. Extraia o conteúdo **dentro de** `public_html` do subdomínio de homologação.
- `sqf-private.zip`: código PHP privado (dentro da pasta `sqf-private/`). Extraia no **diretório pai** de `public_html`, nunca dentro dela.
- `01-instalar-banco.sql` e `02-verificar-banco.sql`: instalação **somente em banco novo/vazio** e conferência no phpMyAdmin.
- `SHA256SUMS` e `LEIA-ME-HPANEL.txt`: hashes e sequência de instalação.

**Não envie o ZIP gerado pelo botão Code → Download ZIP do GitHub ao assistente de migração de backups da Hostinger.** Ele contém arquivos de desenvolvimento e não preserva a separação obrigatória entre a raiz pública e o código privado. Use o Gerenciador de Arquivos do hPanel e configure o site como PHP/HTML. `config.php` com as credenciais reais não é fornecido pelos artefatos: crie-o manualmente a partir de `config.example.php` no diretório privado. O processo não instala automaticamente, não apaga arquivos existentes, não mexe em produção e não habilita cobranças.

Na hospedagem, o caminho resolvido por `public_html/api/index.php` exige esta estrutura:

```text
dominio-ou-subdominio/
├── public_html/
│   ├── index.html
│   ├── api/index.php
│   ├── assets/
│   └── .htaccess
└── sqf-private/
    ├── config.php                 # criado no hPanel, nunca enviado ao GitHub
    ├── media/                     # criar com permissões restritas
    └── backend/{src,bin,public}/
```

O ZIP público não contém bancos SQL, arquivos de testes, arquivos de configuração real ou código PHP privado. Antes de copiar arquivos sobre um site existente, faça backup, confirme o domínio/subdomínio de destino e homologue os fluxos, incluindo login, API, mídias e responsividade. A aprovação da CI, por si só, **não libera a implantação comercial**.
