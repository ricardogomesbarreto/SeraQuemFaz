-- Only for disposable local Docker fixtures. Never use in production.
CREATE DATABASE IF NOT EXISTS sqf_import_stage CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE DATABASE IF NOT EXISTS sqf_import_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
GRANT ALL PRIVILEGES ON sqf_import_stage.* TO 'sqf_fixture'@'%';
GRANT ALL PRIVILEGES ON sqf_import_restore.* TO 'sqf_fixture'@'%';
