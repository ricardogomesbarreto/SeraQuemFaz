-- Disposable PostgreSQL CI database only. No production credentials or data.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.sqf_service_requests (
 id uuid PRIMARY KEY, client_id uuid NOT NULL, provider_id uuid NOT NULL, status text NOT NULL
);
CREATE TABLE public.sqf_appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE REFERENCES public.sqf_service_requests(id),
 client_id uuid NOT NULL, provider_id uuid NOT NULL, starts_at timestamptz NOT NULL,
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 30 AND 480),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','confirmed','declined','canceled')),
 proposed_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sqf_appointments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sqf_appointments TO authenticated;
INSERT INTO public.sqf_service_requests VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021','accepted'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000021','accepted'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000022','accepted'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000021','accepted');
INSERT INTO public.sqf_appointments(request_id,client_id,provider_id,starts_at,duration_minutes,proposed_by)
 SELECT id,client_id,provider_id, date_trunc('day',now())+interval '2 days'+
 CASE WHEN id='00000000-0000-0000-0000-000000000004' THEN interval '1 hour' ELSE interval '0' END,
 60,client_id FROM public.sqf_service_requests;
