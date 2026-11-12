-- MySQL 8.0 / MariaDB 10.11: one engagement per completed service request.
-- Additive columns/indexes; preserve all existing engagements and reviews.
-- Historical rows retain a NULL source_request_id until explicitly reconciled.
-- Apply on a disposable database first. Never run on production without backup.

ALTER TABLE service_engagements
 ADD COLUMN source_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD UNIQUE KEY uq_service_engagement_source_request (source_request_id),
 ADD INDEX ix_service_engagement_pair_history (client_id,provider_id);

-- The old pair-level uniqueness prevented separate reviews for repeat services.
-- Pair-based lookup remains supported by the non-unique index above.
ALTER TABLE service_engagements
 DROP INDEX service_engagements_client_id_provider_id_key;
