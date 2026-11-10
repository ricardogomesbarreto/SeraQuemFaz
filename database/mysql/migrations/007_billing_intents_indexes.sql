-- Renewal preference never modifies paid invoices or triggers an immediate charge.
CREATE TABLE sqf_billing_cycle_requests (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 next_cycle VARCHAR(16) NOT NULL,
 requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 effective_after DATETIME(6) NULL,
 CONSTRAINT ck_cycle_request CHECK(next_cycle IN ('monthly','yearly')),
 CONSTRAINT fk_cycle_request_user FOREIGN KEY(user_id) REFERENCES sqf_auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX ix_sqf_requests_client_created ON sqf_service_requests(client_id,created_at);
CREATE INDEX ix_sqf_requests_provider_created ON sqf_service_requests(provider_id,created_at);
CREATE INDEX ix_sqf_notifications_recipient_created ON sqf_notifications(recipient_id,created_at);
CREATE INDEX ix_sqf_outbox_due ON sqf_notification_outbox(status(16),next_attempt_at,created_at);
CREATE INDEX ix_sqf_tokens_expiry ON sqf_auth_tokens(expires_at);
CREATE INDEX ix_sqf_limits_expiry ON sqf_auth_limits(expires_at);
