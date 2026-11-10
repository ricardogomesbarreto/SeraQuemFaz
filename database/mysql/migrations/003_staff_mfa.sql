-- Staff MFA secrets are provisioned outside the repository and database.
CREATE TABLE sqf_staff_mfa_state (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 last_counter BIGINT NOT NULL DEFAULT -1,
 CONSTRAINT fk_staff_mfa_user FOREIGN KEY (user_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
