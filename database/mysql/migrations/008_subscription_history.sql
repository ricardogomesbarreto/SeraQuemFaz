-- One current contract per provider; retain historical contracts and invoices.
-- A physical nullable key avoids generated-column restrictions on cascading FKs.
ALTER TABLE sqf_billing_subscriptions
 ADD COLUMN is_current TINYINT UNSIGNED NOT NULL DEFAULT 1,
 ADD COLUMN current_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD CONSTRAINT ck_sqf_subscription_current CHECK (is_current IN (0,1)),
 ADD INDEX ix_sqf_subscription_user (user_id);
UPDATE sqf_billing_subscriptions SET current_user_id=user_id WHERE is_current=1;
ALTER TABLE sqf_billing_subscriptions ADD UNIQUE INDEX uq_sqf_current_subscription (current_user_id);
-- Single-statement triggers work with the standard SQL client delimiter.
CREATE TRIGGER sqf_subscription_current_insert BEFORE INSERT ON sqf_billing_subscriptions
 FOR EACH ROW SET NEW.current_user_id=CASE WHEN NEW.is_current=1 THEN NEW.user_id ELSE NULL END;
CREATE TRIGGER sqf_subscription_current_update BEFORE UPDATE ON sqf_billing_subscriptions
 FOR EACH ROW SET NEW.current_user_id=CASE WHEN NEW.is_current=1 THEN NEW.user_id ELSE NULL END;
ALTER TABLE sqf_billing_subscriptions DROP INDEX sqf_billing_subscriptions_user_id_key;
