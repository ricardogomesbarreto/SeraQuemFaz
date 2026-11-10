<?php
declare(strict_types=1);
// Copy outside public_html to sqf-private/config.php. Never commit actual values.
putenv('SQF_DB_DSN=mysql:host=HOST_DO_HPANEL;dbname=NOME_COMPLETO_DO_BANCO;charset=utf8mb4');
putenv('SQF_DB_USER=USUARIO_COMPLETO_DO_HPANEL');
putenv('SQF_DB_PASSWORD=SUBSTITUA_PELA_SENHA_REAL');
putenv('SQF_PRIVATE_MEDIA_ROOT='.__DIR__.'/media');
putenv('SQF_MAIL_FROM='); // Set verified sender after mail transport validation.
putenv('SQF_ALLOW_INSECURE_LOCAL=0');
// Configure SQF_STAFF_TOTP_SECRETS only with securely provisioned unique secrets.
