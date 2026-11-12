-- MySQL 8.0 / MariaDB 10.11: targeted indexes for frequent reads.
-- All operations are additive. Apply only once to a disposable test schema before release.
-- No personal data, provider status or payment state is modified.

-- Fast, ordered message history by request (descending scans are supported by both engines).
CREATE INDEX ix_sqf_messages_request_time
    ON sqf_request_messages(request_id,created_at,id);

-- Prevent unnecessary scans when a client has an open request for the same service.
CREATE INDEX ix_sqf_requests_open_lookup
    ON sqf_service_requests(client_id,provider_id,service_id,created_at);

-- Published reviews on a public provider profile.
CREATE INDEX ix_sqf_reviews_provider_status_time
    ON reviews(provider_id,moderation_status(16),created_at,id);

-- Pending review moderation queue.
CREATE INDEX ix_sqf_reviews_moderation_queue
    ON reviews(moderation_status(16),created_at,id);
