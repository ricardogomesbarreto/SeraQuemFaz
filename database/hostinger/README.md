# Hostinger — instalação MySQL/MariaDB (homologação)

**Não é uma release de produção.** O banco antigo e a operação Supabase permanecem intactos.

## Arquivo de importação

Na raiz do repositório execute:

```bash
node database/hostinger/build-install.mjs
```

Resultado: `dist/hostinger/01-instalar-banco.sql` e `SHA256SUMS`. A CI também gera um artefato para baixar. O SQL consolida 001, 002, 003 e os dados públicos de categorias e municípios; sem contas reais, dados privados, criação/exclusão de banco, GRANT ou DEFINER. O checksum permite conferir o arquivo. Não editar o arquivo gerado: modificar as migrations e gerar novamente.

## hPanel — passo a passo

1. Sites → Gerenciar → Bancos de dados → Gerenciamento. Crie um banco **novo e vazio** para homologação e um usuário próprio, usando os nomes completos exibidos no painel.
2. Abra phpMyAdmin no banco novo. Importe somente `01-instalar-banco.sql`. Alternativamente, use Importar banco de dados no hPanel quando disponível.
3. Confirme se a importação terminou sem erros. Não reimporte em banco parcialmente criado. Se falhar, investigue e use outro banco vazio.
4. Confirme a versão com `SELECT VERSION();`. Matriz suportada nesta homologação: MySQL 8.0 e MariaDB 10.11. Não presumir a versão do servidor contratado.
5. Confira `SELECT COUNT(*) FROM categories WHERE status='active';` (51), `SELECT COUNT(*) FROM sqf_ibge_municipalities;` (mais de 5.500), `SELECT COUNT(*) FROM sqf_auth_users;` (0 no banco recém-instalado). Confira os logs de importação e a integridade.
6. Nunca importe SQL ou arquivos de configuração em public_html; o arquivo SQL é enviado ao phpMyAdmin, não ao gerenciador de arquivos.

## Configuração segura da aplicação candidata

Use PHP 8.1+ com PDO MySQL, mbstring, GD com WebP, fileinfo, Argon2id e HTTPS. O endereço do banco, nome e usuário devem ser copiados do hPanel; não adivinhar o prefixo da conta.

```text
diretorio-do-dominio/
  public_html/             HTML, assets e api/index.php (entrada)
  sqf-private/             fora do acesso HTTP
    backend/               src/ e public/index.php do repositório
    config.php             credenciais reais (não versionar)
    media/                 imagens e documentos privados
```

Copie `database/hostinger/config.example.php` para `sqf-private/config.php` e preencha os campos no servidor. Copie a pasta `backend/` para `sqf-private/backend/`. A entrada `public_html/api/index.php` deve carregar `dirname(__DIR__, 2).'/sqf-private/config.php'` e depois `dirname(__DIR__, 2).'/sqf-private/backend/public/index.php'`. Ajuste caminhos se o layout real do hPanel for diferente. O backend usa variáveis de ambiente, não o navegador. Crie `media/` com permissões restritas ao processo PHP; jamais usar public_html.

Ative `window.SQFDataMode = 'mysql'` somente na cópia de homologação. A versão principal continua Supabase até todos os gates passarem. Configure transporte de e-mail real, MFA administrativo individual e backups; não use credenciais de exemplo. Não habilite checkout real.

## Validação e corte

O instalador é testado em banco descartável nos dois engines, com conta limitada ao banco e sem privilégios globais. Os testes PHP/HTTP/Chromium e de integridade referencial continuam gates. A conta real, dados pessoais, objetos do Storage, autenticação de origem, reconciliacão, SMTP, backup/restauração e todas as páginas ainda precisam de homologação. Não executar fixtures de teste em banco comercial.

Referência oficial: https://www.hostinger.com/br/support/1884149-como-importar-um-banco-de-dados-com-o-phpmyadmin-no-hostinger/
