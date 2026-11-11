<?php
declare(strict_types=1);

function sqfDatabase(): PDO {
    $dsn = getenv('SQF_DB_DSN');
    $user = getenv('SQF_DB_USER');
    $password = getenv('SQF_DB_PASSWORD');
    if (!$dsn || !str_starts_with($dsn, 'mysql:') || !preg_match('/(?:^|;)charset=utf8mb4(?:;|$)/i', $dsn) || !$user || $password === false) {
        throw new RuntimeException('Configuração do banco indisponível.');
    }
    $db = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) !== "mysql") {
        throw new RuntimeException("Driver de banco incompatível.");
    }
    $db->exec("SET time_zone='+00:00'");
    return $db;
}
