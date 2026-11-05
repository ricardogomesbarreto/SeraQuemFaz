-- Migration sqf_consolidated_hardening_legacy_policy_cleanup already APPLIED remotely.
-- Archived for audit only. DO NOT replay blindly on an existing database.
-- See docs/operacao/STATUS-SUPABASE-v3.9.8.md.
DROP TRIGGER IF EXISTS sqf_new_user ON auth.users;
REVOKE ALL ON FUNCTION public.sqf_user_created() FROM public,anon,authenticated;
DROP POLICY IF EXISTS sqf_profiles_read ON public.profiles;
DROP POLICY IF EXISTS sqf_profiles_update ON public.profiles;
DROP POLICY IF EXISTS sqf_services_read ON public.provider_services;
DROP POLICY IF EXISTS sqf_services_insert ON public.provider_services;
DROP POLICY IF EXISTS sqf_services_update ON public.provider_services;
DROP POLICY IF EXISTS sqf_services_delete ON public.provider_services;
DROP POLICY IF EXISTS sqf_photos_read ON public.portfolio_photos;
DROP POLICY IF EXISTS sqf_photos_insert ON public.portfolio_photos;
DROP POLICY IF EXISTS sqf_photos_delete ON public.portfolio_photos;
DROP POLICY IF EXISTS sqf_reviews_read ON public.reviews;
DROP POLICY IF EXISTS sqf_reviews_insert ON public.reviews;
DROP POLICY IF EXISTS sqf_reviews_update ON public.reviews;
DROP POLICY IF EXISTS sqf_reviews_delete ON public.reviews;
-- Additional RESTRICTIVE policies are present on remote database:
-- sqf_profiles_approval_guard (profiles SELECT)
-- sqf_services_approval_guard (provider_services SELECT)
-- sqf_portfolio_approval_guard (portfolio_photos SELECT)
-- sqf_review_owner_guard (reviews SELECT)
-- Their conditions require account ownership OR verified/public provider status;
-- raw review rows are owner-only; published reviews use a moderated RPC.
