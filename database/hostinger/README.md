# Hostinger — MySQL/MariaDB (homologação)

Não implantar em produção. Gere `npm run build:dist` na raiz. O pacote `dist/mysql-candidate` contém public_html, sqf-private e database. Importe database/01-instalar-banco.sql em um banco novo e vazio no hPanel/phpMyAdmin; confira SHA256SUMS e execute 02-verificar-banco.sql. Matriz testada: MySQL 8.0 e MariaDB 10.11; confira a versão contratada.

PHP 8.1+, PDO MySQL, mbstring, GD/WebP, fileinfo, cURL, Argon2id e HTTPS. Copie public_html para a raiz pública; mantenha sqf-private fora dela. Copie config.example.php para config.php no diretório privado e configure DSN mysql:, usuário, senha e mídia privada. Não exponha SQL, arquivos de configuração ou snapshots. Checkout, webhook e notificações desativados por padrão.

O CLI de notificações e a pré-validação de identidades ficam em sqf-private/backend/bin. Testar somente em ambiente descartável. A implantação comercial depende dos gates descritos no README principal.
