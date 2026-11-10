-- Repair candidate accounts registered before verification initialization.
-- Idempotent; preserves existing decisions and timestamps.
INSERT INTO provider_verifications(provider_id,status)
SELECT p.id,'pending' FROM profiles p
LEFT JOIN provider_verifications v ON v.provider_id=p.id
WHERE p.account_type='prestador' AND v.provider_id IS NULL;
