-- Run in the selected database after a clean import. Read-only checks.
SELECT VERSION() AS database_version;
SELECT COUNT(*) AS active_categories FROM categories WHERE status='active';
SELECT COUNT(*) AS municipalities FROM sqf_ibge_municipalities;
SELECT COUNT(*) AS identities FROM sqf_auth_users;
SELECT COUNT(*) AS foreign_keys FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE();
SELECT COUNT(*) AS non_innodb_tables FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE' AND engine<>'InnoDB';
SELECT require_paid_subscription, checkout_enabled FROM sqf_billing_settings WHERE singleton=1;
