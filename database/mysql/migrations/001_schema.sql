-- MySQL/MariaDB schema for clean installation; no personal records.
-- MySQL 8.0.16+ / MariaDB 10.6+. UTC database sessions required.
SET time_zone = '+00:00';
-- MySQL disallows referential actions on columns used in CHECK constraints.
-- Affected foreign keys use default RESTRICT; explicit transactional deletion is required.

CREATE TABLE `sqf_auth_users` (`id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY, `email` VARCHAR(254) NOT NULL UNIQUE, `password_hash` VARCHAR(255) NULL, `email_confirmed_at` DATETIME(6) NULL, `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `categories` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NULL DEFAULT 'active',
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `image_url` TEXT NULL,
  CONSTRAINT `categories_pkey` PRIMARY KEY (id),
  CONSTRAINT `categories_name_key` UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `places` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `google_place_id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `address` TEXT NULL,
  `latitude` DECIMAL(10,7) NULL,
  `longitude` DECIMAL(10,7) NULL,
  `phone` VARCHAR(30) NULL,
  `website_url` TEXT NULL,
  `rating` DECIMAL(2,1) NULL,
  `user_rating_count` INT NULL DEFAULT 0,
  `primary_type` VARCHAR(100) NULL,
  `types` JSON NULL,
  `business_status` VARCHAR(50) NULL,
  `google_maps_url` TEXT NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `places_pkey` PRIMARY KEY (id),
  CONSTRAINT `places_google_place_id_key` UNIQUE (google_place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `portfolio_photos` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `storage_path` VARCHAR(300) NOT NULL,
  `caption` TEXT NOT NULL DEFAULT (''),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `is_cover` TINYINT(1) NOT NULL DEFAULT false,
  CONSTRAINT `portfolio_photos_caption_check` CHECK ((char_length(caption) <= 160)),
  CONSTRAINT `portfolio_photos_storage_path_check` CHECK ((char_length(storage_path) <= 300)),
  CONSTRAINT `sqf_portfolio_owner_path` CHECK ((SUBSTRING_INDEX(storage_path, '/', 1) = (provider_id))),
  CONSTRAINT `portfolio_photos_pkey` PRIMARY KEY (id),
  CONSTRAINT `portfolio_photos_storage_path_key` UNIQUE (storage_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `privacy_requests` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `request_type` TEXT NOT NULL,
  `details` TEXT NOT NULL DEFAULT (''),
  `status` TEXT NOT NULL DEFAULT ('pending'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `privacy_requests_details_check` CHECK ((char_length(details) <= 500)),
  CONSTRAINT `privacy_requests_request_type_check` CHECK ((request_type IN ('access', 'correction', 'deletion', 'portability'))),
  CONSTRAINT `privacy_requests_status_check` CHECK ((status IN ('pending', 'reviewing', 'resolved'))),
  CONSTRAINT `privacy_requests_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `profiles` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `full_name` TEXT NOT NULL DEFAULT ('Usuário'),
  `account_type` TEXT NOT NULL DEFAULT ('cliente'),
  `city` TEXT NOT NULL DEFAULT (''),
  `city_ibge` VARCHAR(7) NULL,
  `bio` TEXT NOT NULL DEFAULT (''),
  `avatar_path` TEXT NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT false,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `profiles_account_type_check` CHECK ((account_type IN ('cliente', 'prestador'))),
  CONSTRAINT `profiles_bio_check` CHECK ((char_length(bio) <= 1500)),
  CONSTRAINT `profiles_check` CHECK (((avatar_path IS NULL) OR ((char_length(avatar_path) <= 300) AND (SUBSTRING_INDEX(avatar_path, '/', 1) = (id))))),
  CONSTRAINT `profiles_city_check` CHECK ((char_length(city) <= 120)),
  CONSTRAINT `profiles_city_ibge_check` CHECK (((city_ibge IS NULL) OR (city_ibge REGEXP '^[0-9]{7}$'))),
  CONSTRAINT `profiles_full_name_check` CHECK (((char_length(TRIM(full_name)) >= 2) AND (char_length(TRIM(full_name)) <= 120))),
  CONSTRAINT `sqf_profiles_city_ibge_format` CHECK (((city_ibge IS NULL) OR (city_ibge REGEXP '^[0-9]{7}$'))),
  CONSTRAINT `sqf_public_only_provider` CHECK (((NOT is_public) OR (account_type = 'prestador'))),
  CONSTRAINT `profiles_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `provider_professional_details` (
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `professional_title` TEXT NOT NULL DEFAULT (''),
  `specialties` TEXT NOT NULL DEFAULT (''),
  `experience_years` SMALLINT NULL,
  `service_mode` TEXT NOT NULL DEFAULT ('nao_informado'),
  `coverage_area` TEXT NOT NULL DEFAULT (''),
  `workdays` JSON NOT NULL DEFAULT ('[]'),
  `work_period` TEXT NOT NULL DEFAULT ('nao_informado'),
  `quote_policy` TEXT NOT NULL DEFAULT ('sob_consulta'),
  `professional_website` TEXT NOT NULL DEFAULT (''),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `provider_professional_details_coverage_area_check` CHECK ((char_length(coverage_area) <= 240)),
  CONSTRAINT `provider_professional_details_experience_years_check` CHECK (((experience_years >= 0) AND (experience_years <= 60))),
  CONSTRAINT `provider_professional_details_professional_title_check` CHECK ((char_length(professional_title) <= 100)),
  CONSTRAINT `provider_professional_details_professional_website_check` CHECK (((professional_website = '') OR (professional_website REGEXP '^https://[^[:space:]]{3,300}$'))),
  CONSTRAINT `provider_professional_details_quote_policy_check` CHECK ((quote_policy IN ('sob_consulta', 'orcamento_gratuito', 'orcamento_pago'))),
  CONSTRAINT `provider_professional_details_service_mode_check` CHECK ((service_mode IN ('nao_informado', 'presencial', 'remoto', 'hibrido'))),
  CONSTRAINT `provider_professional_details_specialties_check` CHECK ((char_length(specialties) <= 220)),
  CONSTRAINT `provider_professional_details_work_period_check` CHECK ((work_period IN ('nao_informado', 'manha', 'tarde', 'noite', 'flexivel'))),
  CONSTRAINT `provider_professional_details_pkey` PRIMARY KEY (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `provider_services` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `category_id` VARCHAR(255) NOT NULL,
  `service_title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL DEFAULT (''),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `price_min_cents` INT NULL,
  `price_max_cents` INT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT true,
  CONSTRAINT `provider_services_description_check` CHECK ((char_length(description) <= 500)),
  CONSTRAINT `provider_services_service_title_check` CHECK (((char_length(TRIM(service_title)) >= 3) AND (char_length(TRIM(service_title)) <= 100))),
  CONSTRAINT `sqf_provider_services_price_bounds` CHECK ((((price_min_cents IS NULL) AND (price_max_cents IS NULL)) OR ((price_min_cents IS NOT NULL) AND (price_max_cents IS NOT NULL) AND ((price_min_cents >= 0) AND (price_min_cents <= 100000000)) AND ((price_max_cents >= price_min_cents) AND (price_max_cents <= 100000000))))),
  CONSTRAINT `provider_services_pkey` PRIMARY KEY (id),
  CONSTRAINT `provider_services_provider_id_category_id_service_title_key` UNIQUE (provider_id, category_id, service_title),
  UNIQUE KEY `uq_provider_services_id_owner` (`id`, `provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `provider_verifications` (
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('pending'),
  `requested_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `reviewed_at` DATETIME(6) NULL,
  `reviewed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `internal_note` TEXT NOT NULL DEFAULT (''),
  CONSTRAINT `provider_verifications_internal_note_check` CHECK ((char_length(internal_note) <= 2000)),
  CONSTRAINT `provider_verifications_status_check` CHECK ((status IN ('pending', 'approved', 'rejected', 'suspended'))),
  CONSTRAINT `provider_verifications_pkey` PRIMARY KEY (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `providers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `business_name` VARCHAR(150) NULL,
  `display_name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `phone` VARCHAR(30) NULL,
  `whatsapp` VARCHAR(30) NULL,
  `email` VARCHAR(150) NULL,
  `website` VARCHAR(255) NULL,
  `profile_photo_url` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `verification_status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `rating` DECIMAL(3,2) NULL DEFAULT 0.00,
  `review_count` INT NOT NULL DEFAULT 0,
  `service_radius_km` DECIMAL(6,2) NULL,
  `accepts_online_booking` TINYINT(1) NOT NULL DEFAULT false,
  `accepts_whatsapp` TINYINT(1) NOT NULL DEFAULT true,
  `is_featured` TINYINT(1) NOT NULL DEFAULT false,
  `is_public` TINYINT(1) NOT NULL DEFAULT true,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `chk_provider_radius` CHECK (((service_radius_km IS NULL) OR (service_radius_km >= (0)))),
  CONSTRAINT `chk_provider_rating` CHECK (((rating >= (0)) AND (rating <= (5)))),
  CONSTRAINT `chk_provider_review_count` CHECK ((review_count >= 0)),
  CONSTRAINT `providers_pkey` PRIMARY KEY (id),
  CONSTRAINT `providers_user_id_key` UNIQUE (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `reviews` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reviewer_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `engagement_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `rating` SMALLINT NOT NULL,
  `comment` TEXT NOT NULL,
  `moderation_status` TEXT NOT NULL DEFAULT ('pending'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `moderated_at` DATETIME(6) NULL,
  CONSTRAINT `reviews_check` CHECK ((provider_id <> reviewer_id)),
  CONSTRAINT `reviews_comment_check` CHECK (((char_length(TRIM(comment)) >= 15) AND (char_length(TRIM(comment)) <= 1500))),
  CONSTRAINT `reviews_moderation_status_check` CHECK ((moderation_status IN ('pending', 'published', 'rejected', 'hidden'))),
  CONSTRAINT `reviews_rating_check` CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT `reviews_pkey` PRIMARY KEY (id),
  CONSTRAINT `reviews_engagement_id_key` UNIQUE (engagement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `safety_reports` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `reporter_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `details` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('pending'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `safety_reports_details_check` CHECK (((char_length(TRIM(details)) >= 20) AND (char_length(TRIM(details)) <= 1200))),
  CONSTRAINT `safety_reports_reason_check` CHECK ((reason IN ('impersonation', 'fraud', 'harassment', 'unsafe', 'other'))),
  CONSTRAINT `safety_reports_status_check` CHECK ((status IN ('pending', 'reviewing', 'resolved', 'dismissed'))),
  CONSTRAINT `safety_reports_pkey` PRIMARY KEY (id),
  CONSTRAINT `safety_reports_reporter_id_provider_id_reason_key` UNIQUE (reporter_id, provider_id, reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `service_engagements` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `client_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('requested'),
  `requested_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `confirmed_at` DATETIME(6) NULL,
  CONSTRAINT `service_engagements_check` CHECK ((client_id <> provider_id)),
  CONSTRAINT `service_engagements_status_check` CHECK ((status IN ('requested', 'confirmed'))),
  CONSTRAINT `service_engagements_pkey` PRIMARY KEY (id),
  CONSTRAINT `service_engagements_client_id_provider_id_key` UNIQUE (client_id, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `services` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NULL DEFAULT 'active',
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `category_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  CONSTRAINT `services_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_account_settings` (
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `display_name` TEXT NOT NULL,
  `city` TEXT NOT NULL DEFAULT (''),
  `state` TEXT NULL,
  `avatar_path` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_account_settings_check` CHECK (((avatar_path IS NULL) OR ((avatar_path REGEXP '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$') AND (SUBSTRING_INDEX(avatar_path, '/', 1) = (user_id))))),
  CONSTRAINT `sqf_account_settings_city_check` CHECK ((char_length(city) <= 120)),
  CONSTRAINT `sqf_account_settings_display_name_check` CHECK (((char_length(TRIM(display_name)) >= 2) AND (char_length(TRIM(display_name)) <= 120))),
  CONSTRAINT `sqf_account_settings_state_check` CHECK (((state IS NULL) OR (state REGEXP '^[A-Z]{2}$'))),
  CONSTRAINT `sqf_account_settings_pkey` PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_admin_members` (
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `role` TEXT NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT true,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_admin_members_role_check` CHECK ((role IN ('admin', 'moderator'))),
  CONSTRAINT `sqf_admin_members_pkey` PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_appointments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `client_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `starts_at` DATETIME(6) NOT NULL,
  `duration_minutes` INT NOT NULL DEFAULT 60,
  `status` TEXT NOT NULL DEFAULT ('proposed'),
  `proposed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_appointments_duration_minutes_check` CHECK (((duration_minutes >= 30) AND (duration_minutes <= 480))),
  CONSTRAINT `sqf_appointments_status_check` CHECK ((status IN ('proposed', 'confirmed', 'declined', 'canceled'))),
  CONSTRAINT `sqf_appointments_pkey` PRIMARY KEY (id),
  CONSTRAINT `sqf_appointments_request_id_key` UNIQUE (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_billing_invoices` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `subscription_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `mp_invoice_id` VARCHAR(255) NOT NULL,
  `mp_payment_id` TEXT NULL,
  `status` TEXT NOT NULL,
  `amount_cents` INT NOT NULL,
  `currency` TEXT NOT NULL DEFAULT ('BRL'),
  `paid_at` DATETIME(6) NULL,
  `paid_period_end` DATETIME(6) NULL,
  `verified_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_billing_invoices_amount_cents_check` CHECK ((amount_cents > 0)),
  CONSTRAINT `sqf_billing_invoices_currency_check` CHECK ((currency = 'BRL')),
  CONSTRAINT `sqf_billing_invoices_status_check` CHECK ((status IN ('approved', 'pending', 'rejected', 'refunded', 'charged_back'))),
  CONSTRAINT `sqf_invoice_approved_period` CHECK (((status <> 'approved') OR ((paid_at IS NOT NULL) AND (paid_period_end IS NOT NULL)))),
  CONSTRAINT `sqf_billing_invoices_pkey` PRIMARY KEY (id),
  CONSTRAINT `sqf_billing_invoices_mp_invoice_id_key` UNIQUE (mp_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_billing_settings` (
  `singleton` TINYINT(1) NOT NULL DEFAULT true,
  `require_paid_subscription` TINYINT(1) NOT NULL DEFAULT false,
  `checkout_enabled` TINYINT(1) NOT NULL DEFAULT false,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_billing_settings_singleton_check` CHECK (singleton = 1),
  CONSTRAINT `sqf_billing_settings_pkey` PRIMARY KEY (singleton)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_billing_subscriptions` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `external_reference` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `mp_preapproval_id` VARCHAR(255) NULL,
  `checkout_url` TEXT NULL,
  `cycle` TEXT NOT NULL,
  `price_cents` INT NOT NULL,
  `currency` TEXT NOT NULL DEFAULT ('BRL'),
  `state` TEXT NOT NULL DEFAULT ('creating'),
  `paid_until` DATETIME(6) NULL,
  `cancel_requested_at` DATETIME(6) NULL,
  `canceled_at` DATETIME(6) NULL,
  `last_verified_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_billing_mp_identifier` CHECK (((mp_preapproval_id IS NULL) OR ((char_length(mp_preapproval_id) >= 8) AND (char_length(mp_preapproval_id) <= 120)))),
  CONSTRAINT `sqf_billing_price_cycle` CHECK ((((cycle = 'monthly') AND (price_cents = 1490)) OR ((cycle = 'yearly') AND (price_cents = 14900)))),
  CONSTRAINT `sqf_billing_subscriptions_currency_check` CHECK ((currency = 'BRL')),
  CONSTRAINT `sqf_billing_subscriptions_cycle_check` CHECK ((cycle IN ('monthly', 'yearly'))),
  CONSTRAINT `sqf_billing_subscriptions_price_cents_check` CHECK ((price_cents IN (1490, 14900))),
  CONSTRAINT `sqf_billing_subscriptions_state_check` CHECK ((state IN ('creating', 'pending', 'authorized', 'paused', 'canceled', 'failed'))),
  CONSTRAINT `sqf_billing_subscriptions_pkey` PRIMARY KEY (id),
  CONSTRAINT `sqf_billing_subscriptions_external_reference_key` UNIQUE (external_reference),
  CONSTRAINT `sqf_billing_subscriptions_mp_preapproval_id_key` UNIQUE (mp_preapproval_id),
  CONSTRAINT `sqf_billing_subscriptions_user_id_key` UNIQUE (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_client_category_favorites` (
  `client_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `category_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_client_category_favorites_pkey` PRIMARY KEY (client_id, category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_client_favorites` (
  `client_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_client_favorites_check` CHECK ((client_id <> provider_id)),
  CONSTRAINT `sqf_client_favorites_pkey` PRIMARY KEY (client_id, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_ibge_municipalities` (
  `code` VARCHAR(7) NOT NULL,
  `name` TEXT NOT NULL,
  `uf` CHAR(2) NOT NULL,
  `ibge_uf` SMALLINT NOT NULL,
  `source` TEXT NOT NULL DEFAULT ('IBGE (espelho público)'),
  `imported_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_ibge_municipalities_code_check` CHECK ((code REGEXP '^[0-9]{7}$')),
  CONSTRAINT `sqf_ibge_municipalities_ibge_uf_check` CHECK (((ibge_uf >= 11) AND (ibge_uf <= 53))),
  CONSTRAINT `sqf_ibge_municipalities_name_check` CHECK (((char_length(TRIM(name)) >= 2) AND (char_length(TRIM(name)) <= 120))),
  CONSTRAINT `sqf_ibge_municipalities_uf_check` CHECK ((uf REGEXP '^[A-Z]{2}$')),
  CONSTRAINT `sqf_ibge_municipalities_pkey` PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_notification_outbox` (
  `notification_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `recipient_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('pending'),
  `attempts` INT NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `processed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_notification_outbox_attempts_check` CHECK (((attempts >= 0) AND (attempts <= 20))),
  CONSTRAINT `sqf_notification_outbox_status_check` CHECK ((status IN ('pending', 'sent', 'skipped', 'failed'))),
  CONSTRAINT `sqf_notification_outbox_pkey` PRIMARY KEY (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_notification_preferences` (
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email_enabled` TINYINT(1) NOT NULL DEFAULT false,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_notification_preferences_pkey` PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_notifications` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `recipient_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `kind` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `body` TEXT NOT NULL DEFAULT (''),
  `request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `read_at` DATETIME(6) NULL,
  CONSTRAINT `sqf_notifications_body_check` CHECK ((CHAR_LENGTH(body) <= 300)),
  CONSTRAINT `sqf_notifications_kind_check` CHECK (((CHAR_LENGTH(kind) >= 2) AND (CHAR_LENGTH(kind) <= 40))),
  CONSTRAINT `sqf_notifications_title_check` CHECK (((CHAR_LENGTH(title) >= 2) AND (CHAR_LENGTH(title) <= 120))),
  CONSTRAINT `sqf_notifications_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_portrait_checks` (
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `avatar_path` TEXT NOT NULL,
  `accepted` TINYINT(1) NOT NULL,
  `note` TEXT NOT NULL,
  `checked_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `checked_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_portrait_checks_note_check` CHECK (((char_length(TRIM(note)) >= 20) AND (char_length(TRIM(note)) <= 1000))),
  CONSTRAINT `sqf_portrait_checks_pkey` PRIMARY KEY (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_profile_views` (
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `viewer_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `viewed_on` DATE NOT NULL DEFAULT (UTC_DATE()),
  CONSTRAINT `sqf_profile_views_pkey` PRIMARY KEY (provider_id, viewer_id, viewed_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_provider_coverage` (
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `city_ibge` VARCHAR(7) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_provider_coverage_pkey` PRIMARY KEY (provider_id, city_ibge)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_request_attachments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `uploaded_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `storage_path` VARCHAR(300) NOT NULL,
  `caption` TEXT NOT NULL DEFAULT (''),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_media_path` CHECK (storage_path = CONCAT(request_id, '/', uploaded_by, '/', id, '.webp')),
  CONSTRAINT `sqf_request_attachments_caption_check` CHECK ((char_length(caption) <= 160)),
  CONSTRAINT `sqf_request_attachments_pkey` PRIMARY KEY (id),
  CONSTRAINT `sqf_request_attachments_storage_path_key` UNIQUE (storage_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_request_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `action` TEXT NOT NULL,
  `from_status` TEXT NULL,
  `to_status` TEXT NOT NULL,
  `amount_cents` INT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_request_events_action_check` CHECK (((char_length(action) >= 2) AND (char_length(action) <= 24))),
  CONSTRAINT `sqf_request_events_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_request_messages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `sender_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_request_messages_body_check` CHECK (((char_length(TRIM(body)) >= 2) AND (char_length(TRIM(body)) <= 2000))),
  CONSTRAINT `sqf_request_messages_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_request_read_receipts` (
  `request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `last_read_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_request_read_receipts_pkey` PRIMARY KEY (request_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_review_disputes` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `review_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reason` TEXT NOT NULL,
  `details` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('pending'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `decided_at` DATETIME(6) NULL,
  CONSTRAINT `sqf_review_disputes_details_check` CHECK (((char_length(TRIM(details)) >= 30) AND (char_length(TRIM(details)) <= 1200))),
  CONSTRAINT `sqf_review_disputes_reason_check` CHECK ((reason IN ('false_service', 'inaccurate', 'harassment', 'personal_data', 'other'))),
  CONSTRAINT `sqf_review_disputes_status_check` CHECK ((status IN ('pending', 'reviewing', 'upheld', 'dismissed'))),
  CONSTRAINT `sqf_review_disputes_pkey` PRIMARY KEY (id),
  CONSTRAINT `sqf_review_disputes_review_id_provider_id_key` UNIQUE (review_id, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_review_responses` (
  `review_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `message` TEXT NOT NULL,
  `moderation_status` TEXT NOT NULL DEFAULT ('pending'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `moderated_at` DATETIME(6) NULL,
  CONSTRAINT `sqf_review_responses_message_check` CHECK (((char_length(TRIM(message)) >= 20) AND (char_length(TRIM(message)) <= 600))),
  CONSTRAINT `sqf_review_responses_moderation_status_check` CHECK ((moderation_status IN ('pending', 'published', 'rejected', 'hidden'))),
  CONSTRAINT `sqf_review_responses_pkey` PRIMARY KEY (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_service_requests` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `client_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `city_ibge` VARCHAR(7) NOT NULL,
  `description` TEXT NOT NULL,
  `desired_date` DATE NULL,
  `status` TEXT NOT NULL DEFAULT ('requested'),
  `quote_cents` INT NULL,
  `quote_terms` TEXT NULL,
  `quote_sent_at` DATETIME(6) NULL,
  `engagement_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `completed_at` DATETIME(6) NULL,
  CONSTRAINT `sqf_request_deadline` CHECK (desired_date IS NULL OR desired_date >= DATE_SUB(DATE(created_at), INTERVAL 1 DAY)),
  CONSTRAINT `sqf_request_not_self` CHECK ((client_id <> provider_id)),
  CONSTRAINT `sqf_service_requests_description_check` CHECK (((char_length(TRIM(description)) >= 25) AND (char_length(TRIM(description)) <= 2000))),
  CONSTRAINT `sqf_service_requests_quote_cents_check` CHECK (((quote_cents >= 100) AND (quote_cents <= 100000000))),
  CONSTRAINT `sqf_service_requests_quote_terms_check` CHECK (((quote_terms IS NULL) OR (char_length(quote_terms) <= 1500))),
  CONSTRAINT `sqf_service_requests_status_check` CHECK ((status IN ('requested', 'quoted', 'accepted', 'in_progress', 'awaiting_confirmation', 'completed', 'declined', 'canceled'))),
  CONSTRAINT `sqf_service_requests_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_staff_decision_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `actor_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `entity_type` TEXT NOT NULL,
  `entity_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `previous_status` TEXT NOT NULL,
  `new_status` TEXT NOT NULL,
  `decision_note` TEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_staff_decision_log_decision_note_check` CHECK (((char_length(TRIM(decision_note)) >= 20) AND (char_length(TRIM(decision_note)) <= 1000))),
  CONSTRAINT `sqf_staff_decision_log_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_support_tickets` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `topic` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('open'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT `sqf_support_tickets_message_check` CHECK (((CHAR_LENGTH(TRIM(message)) >= 15) AND (CHAR_LENGTH(TRIM(message)) <= 2000))),
  CONSTRAINT `sqf_support_tickets_status_check` CHECK ((status IN ('open', 'reviewing', 'resolved'))),
  CONSTRAINT `sqf_support_tickets_topic_check` CHECK ((topic IN ('account', 'budget', 'appointment', 'review', 'technical', 'other'))),
  CONSTRAINT `sqf_support_tickets_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `sqf_verification_documents` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `provider_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `document_kind` TEXT NOT NULL,
  `storage_path` VARCHAR(300) NOT NULL,
  `status` TEXT NOT NULL DEFAULT ('pending'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `reviewed_at` DATETIME(6) NULL,
  `reviewed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `review_note` TEXT NOT NULL DEFAULT (''),
  CONSTRAINT `sqf_document_owned_path` CHECK (storage_path = CONCAT(provider_id, '/', id, '.webp')),
  CONSTRAINT `sqf_verification_documents_document_kind_check` CHECK ((document_kind IN ('identity_evidence', 'professional_license'))),
  CONSTRAINT `sqf_verification_documents_review_note_check` CHECK ((char_length(review_note) <= 1000)),
  CONSTRAINT `sqf_verification_documents_status_check` CHECK ((status IN ('pending', 'accepted', 'rejected'))),
  CONSTRAINT `sqf_verification_documents_pkey` PRIMARY KEY (id),
  CONSTRAINT `sqf_verification_documents_storage_path_key` UNIQUE (storage_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `user_profiles` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(150) NULL,
  `phone` VARCHAR(30) NULL,
  `photo_url` TEXT NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `username` TEXT NULL,
  `bio` TEXT NULL,
  `account_type` TEXT NOT NULL DEFAULT ('cliente'),
  `city` TEXT NULL,
  `state` TEXT NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT true,
  CONSTRAINT `user_profiles_account_type_check` CHECK ((account_type IN ('cliente', 'prestador', 'ambos'))),
  CONSTRAINT `user_profiles_pkey` PRIMARY KEY (id),
  CONSTRAINT `user_profiles_user_id_key` UNIQUE (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `users` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `auth_user_id` DECIMAL(65,20) NULL DEFAULT '1',
  `name` TEXT NULL,
  `Last Name` TEXT NULL,
  `email` TEXT NULL,
  `telefone` TEXT NULL,
  `foto_url` TEXT NULL,
  `tipo_usuario` TEXT NULL,
  `status` TEXT NULL,
  `cidade` TEXT NULL,
  `estado` TEXT NULL,
  `latitude` TEXT NULL,
  `longitude` TEXT NULL,
  `mail_verificado` TEXT NULL,
  `telefone_verificado` TEXT NULL,
  `ultimo_login` TEXT NULL,
  `created_at` TEXT NULL,
  `updated_at` TEXT NULL,
  CONSTRAINT `Users_pkey` PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
ALTER TABLE `portfolio_photos` ADD CONSTRAINT `portfolio_photos_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE `portfolio_photos` ADD CONSTRAINT `sqf_portfolio_service_owner_fk` FOREIGN KEY (service_id, provider_id) REFERENCES provider_services(id, provider_id);
ALTER TABLE `privacy_requests` ADD CONSTRAINT `privacy_requests_user_id_fkey` FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fkey` FOREIGN KEY (id) REFERENCES sqf_auth_users(id);
ALTER TABLE `profiles` ADD CONSTRAINT `sqf_profile_valid_city_ibge` FOREIGN KEY (city_ibge) REFERENCES sqf_ibge_municipalities(code);
ALTER TABLE `provider_professional_details` ADD CONSTRAINT `provider_professional_details_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `provider_services` ADD CONSTRAINT `provider_services_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `provider_verifications` ADD CONSTRAINT `provider_verifications_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `provider_verifications` ADD CONSTRAINT `provider_verifications_reviewed_by_fkey` FOREIGN KEY (reviewed_by) REFERENCES sqf_auth_users(id);
ALTER TABLE `providers` ADD CONSTRAINT `fk_providers_user` FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_engagement_id_fkey` FOREIGN KEY (engagement_id) REFERENCES service_engagements(id);
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewer_id_fkey` FOREIGN KEY (reviewer_id) REFERENCES profiles(id);
ALTER TABLE `safety_reports` ADD CONSTRAINT `safety_reports_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `safety_reports` ADD CONSTRAINT `safety_reports_reporter_id_fkey` FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `service_engagements` ADD CONSTRAINT `service_engagements_client_id_fkey` FOREIGN KEY (client_id) REFERENCES profiles(id);
ALTER TABLE `service_engagements` ADD CONSTRAINT `service_engagements_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE `services` ADD CONSTRAINT `services_category_id_fkey` FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE `sqf_account_settings` ADD CONSTRAINT `sqf_account_settings_user_id_fkey` FOREIGN KEY (user_id) REFERENCES sqf_auth_users(id);
ALTER TABLE `sqf_admin_members` ADD CONSTRAINT `sqf_admin_members_user_id_fkey` FOREIGN KEY (user_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_appointments` ADD CONSTRAINT `sqf_appointments_client_id_fkey` FOREIGN KEY (client_id) REFERENCES sqf_auth_users(id);
ALTER TABLE `sqf_appointments` ADD CONSTRAINT `sqf_appointments_proposed_by_fkey` FOREIGN KEY (proposed_by) REFERENCES sqf_auth_users(id);
ALTER TABLE `sqf_appointments` ADD CONSTRAINT `sqf_appointments_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES sqf_auth_users(id);
ALTER TABLE `sqf_appointments` ADD CONSTRAINT `sqf_appointments_request_id_fkey` FOREIGN KEY (request_id) REFERENCES sqf_service_requests(id) ON DELETE CASCADE;
ALTER TABLE `sqf_billing_invoices` ADD CONSTRAINT `sqf_billing_invoices_subscription_id_fkey` FOREIGN KEY (subscription_id) REFERENCES sqf_billing_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE `sqf_billing_subscriptions` ADD CONSTRAINT `sqf_billing_subscriptions_user_id_fkey` FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_client_category_favorites` ADD CONSTRAINT `sqf_client_category_favorites_category_id_fkey` FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
ALTER TABLE `sqf_client_category_favorites` ADD CONSTRAINT `sqf_client_category_favorites_client_id_fkey` FOREIGN KEY (client_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_client_favorites` ADD CONSTRAINT `sqf_client_favorites_client_id_fkey` FOREIGN KEY (client_id) REFERENCES profiles(id);
ALTER TABLE `sqf_client_favorites` ADD CONSTRAINT `sqf_client_favorites_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE `sqf_notification_outbox` ADD CONSTRAINT `sqf_notification_outbox_notification_id_fkey` FOREIGN KEY (notification_id) REFERENCES sqf_notifications(id) ON DELETE CASCADE;
ALTER TABLE `sqf_notification_outbox` ADD CONSTRAINT `sqf_notification_outbox_recipient_id_fkey` FOREIGN KEY (recipient_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_notification_preferences` ADD CONSTRAINT `sqf_notification_preferences_user_id_fkey` FOREIGN KEY (user_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_notifications` ADD CONSTRAINT `sqf_notifications_recipient_id_fkey` FOREIGN KEY (recipient_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_notifications` ADD CONSTRAINT `sqf_notifications_request_id_fkey` FOREIGN KEY (request_id) REFERENCES sqf_service_requests(id) ON DELETE CASCADE;
ALTER TABLE `sqf_portrait_checks` ADD CONSTRAINT `sqf_portrait_checks_checked_by_fkey` FOREIGN KEY (checked_by) REFERENCES sqf_auth_users(id);
ALTER TABLE `sqf_portrait_checks` ADD CONSTRAINT `sqf_portrait_checks_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_profile_views` ADD CONSTRAINT `sqf_profile_views_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_profile_views` ADD CONSTRAINT `sqf_profile_views_viewer_id_fkey` FOREIGN KEY (viewer_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_provider_coverage` ADD CONSTRAINT `sqf_provider_coverage_city_ibge_fkey` FOREIGN KEY (city_ibge) REFERENCES sqf_ibge_municipalities(code);
ALTER TABLE `sqf_provider_coverage` ADD CONSTRAINT `sqf_provider_coverage_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_request_attachments` ADD CONSTRAINT `sqf_request_attachments_request_id_fkey` FOREIGN KEY (request_id) REFERENCES sqf_service_requests(id);
ALTER TABLE `sqf_request_attachments` ADD CONSTRAINT `sqf_request_attachments_uploaded_by_fkey` FOREIGN KEY (uploaded_by) REFERENCES profiles(id);
ALTER TABLE `sqf_request_events` ADD CONSTRAINT `sqf_request_events_actor_id_fkey` FOREIGN KEY (actor_id) REFERENCES profiles(id);
ALTER TABLE `sqf_request_events` ADD CONSTRAINT `sqf_request_events_request_id_fkey` FOREIGN KEY (request_id) REFERENCES sqf_service_requests(id) ON DELETE CASCADE;
ALTER TABLE `sqf_request_messages` ADD CONSTRAINT `sqf_request_messages_request_id_fkey` FOREIGN KEY (request_id) REFERENCES sqf_service_requests(id) ON DELETE CASCADE;
ALTER TABLE `sqf_request_messages` ADD CONSTRAINT `sqf_request_messages_sender_id_fkey` FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_request_read_receipts` ADD CONSTRAINT `sqf_request_read_receipts_request_id_fkey` FOREIGN KEY (request_id) REFERENCES sqf_service_requests(id) ON DELETE CASCADE;
ALTER TABLE `sqf_request_read_receipts` ADD CONSTRAINT `sqf_request_read_receipts_user_id_fkey` FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_review_disputes` ADD CONSTRAINT `sqf_review_disputes_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_review_disputes` ADD CONSTRAINT `sqf_review_disputes_review_id_fkey` FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE;
ALTER TABLE `sqf_review_responses` ADD CONSTRAINT `sqf_review_responses_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE `sqf_review_responses` ADD CONSTRAINT `sqf_review_responses_review_id_fkey` FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE;
ALTER TABLE `sqf_service_requests` ADD CONSTRAINT `sqf_service_requests_city_ibge_fkey` FOREIGN KEY (city_ibge) REFERENCES sqf_ibge_municipalities(code);
ALTER TABLE `sqf_service_requests` ADD CONSTRAINT `sqf_service_requests_client_id_fkey` FOREIGN KEY (client_id) REFERENCES profiles(id);
ALTER TABLE `sqf_service_requests` ADD CONSTRAINT `sqf_service_requests_engagement_id_fkey` FOREIGN KEY (engagement_id) REFERENCES service_engagements(id);
ALTER TABLE `sqf_service_requests` ADD CONSTRAINT `sqf_service_requests_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE `sqf_service_requests` ADD CONSTRAINT `sqf_service_requests_service_id_fkey` FOREIGN KEY (service_id) REFERENCES provider_services(id);
ALTER TABLE `sqf_staff_decision_log` ADD CONSTRAINT `sqf_staff_decision_log_actor_id_fkey` FOREIGN KEY (actor_id) REFERENCES sqf_auth_users(id);
ALTER TABLE `sqf_support_tickets` ADD CONSTRAINT `sqf_support_tickets_user_id_fkey` FOREIGN KEY (user_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE;
ALTER TABLE `sqf_verification_documents` ADD CONSTRAINT `sqf_verification_documents_provider_id_fkey` FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE `sqf_verification_documents` ADD CONSTRAINT `sqf_verification_documents_reviewed_by_fkey` FOREIGN KEY (reviewed_by) REFERENCES sqf_auth_users(id);
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Serialize agenda operations by participant (lock rows in UUID order).
CREATE TABLE sqf_agenda_locks (user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY, CONSTRAINT fk_agenda_lock_user FOREIGN KEY(user_id) REFERENCES sqf_auth_users(id) ON DELETE CASCADE) ENGINE=InnoDB;
ALTER TABLE sqf_appointments ADD COLUMN pending_starts_at DATETIME(6) NULL, ADD COLUMN pending_duration_minutes INT NULL, ADD COLUMN pending_proposed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD CONSTRAINT fk_pending_proposer FOREIGN KEY(pending_proposed_by) REFERENCES sqf_auth_users(id), ADD CONSTRAINT ck_pending_complete CHECK ((pending_starts_at IS NULL AND pending_duration_minutes IS NULL AND pending_proposed_by IS NULL) OR (status='confirmed' AND pending_starts_at IS NOT NULL AND pending_duration_minutes BETWEEN 30 AND 480 AND pending_duration_minutes IS NOT NULL AND pending_proposed_by IS NOT NULL AND pending_proposed_by IN (client_id, provider_id)));
CREATE INDEX ix_appointment_client_time ON sqf_appointments(client_id,status(16),starts_at);
CREATE INDEX ix_appointment_provider_time ON sqf_appointments(provider_id,status(16),starts_at);
