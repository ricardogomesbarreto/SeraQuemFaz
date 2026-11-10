-- Local identity lifecycle; apply after 001_schema.sql.
ALTER TABLE sqf_auth_users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1;
CREATE TABLE sqf_auth_tokens (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 purpose VARCHAR(16) NOT NULL,
 expires_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT ck_auth_token_purpose CHECK (purpose IN ('verify','reset')),
 CONSTRAINT fk_auth_token_user FOREIGN KEY (user_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE,
 INDEX ix_auth_token_user (user_id,purpose)
) ENGINE=InnoDB;
CREATE TABLE sqf_auth_limits (
 bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 expires_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
