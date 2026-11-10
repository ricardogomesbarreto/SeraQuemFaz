-- One current contract per provider, retain all historical contracts and invoices.
ALTER TABLE sqf_billing_subscriptions
 ADD COLUMN is_current TINYINT UNSIGNED NOT NULL DEFAULT 1,
 ADD COLUMN current_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN is_current=1 THEN user_id ELSE NULL END) STORED,
 ADD CONSTRAINT ck_sqf_subscription_current CHECK (is_current IN (0,1)),
 ADD INDEX ix_sqf_subscription_user (user_id),
 ADD UNIQUE INDEX uq_sqf_current_subscription (current_user_id);
ALTER TABLE sqf_billing_subscriptions DROP INDEX sqf_billing_subscriptions_user_id_key;
