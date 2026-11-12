-- One current contract per provider; retain historical contracts and invoices.
-- The generated marker depends only on is_current, never on the cascading FK.
-- UNIQUE(user_id, marker) permits multiple NULL historical rows.
ALTER TABLE sqf_billing_subscriptions
 ADD COLUMN is_current TINYINT UNSIGNED NOT NULL DEFAULT 1,
 ADD COLUMN current_user_id TINYINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN is_current=1 THEN 1 ELSE NULL END) STORED,
 ADD CONSTRAINT ck_sqf_subscription_current CHECK (is_current IN (0,1)),
 ADD INDEX ix_sqf_subscription_user (user_id),
 ADD UNIQUE INDEX uq_sqf_current_subscription (user_id,current_user_id);
ALTER TABLE sqf_billing_subscriptions DROP INDEX sqf_billing_subscriptions_user_id_key;
