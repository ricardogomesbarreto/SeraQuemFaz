#!/usr/bin/env bash
set -euo pipefail
# PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE provided by disposable CI service.
psql -X -v ON_ERROR_STOP=1 -f tests/postgres/appointment-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261110_20_appointment_no_overlap.sql
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Two real sessions: first holds an uncommitted confirmation while the second attempts one.
PGAPPNAME=sqf_test_first psql -X -v ON_ERROR_STOP=1 >"$tmp/first" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
SELECT public.sqf_manage_appointment('00000000-0000-0000-0000-000000000001','confirm');
SELECT pg_sleep(5);
COMMIT;
SQL
pid=$!
ready=0
for i in $(seq 1 40); do
 if [[ "$(psql -X -Atc "select count(*) from pg_stat_activity where application_name='sqf_test_first' and wait_event='PgSleep'")" == 1 ]]; then ready=1; break; fi
 sleep .1
done
[[ "$ready" == 1 ]] || { cat "$tmp/first"; kill "$pid" || true; exit 1; }
# The second transaction must fail after the first commits, not silently succeed.
if psql -X -v ON_ERROR_STOP=1 >"$tmp/second" 2>&1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
SELECT public.sqf_manage_appointment('00000000-0000-0000-0000-000000000002','confirm');
COMMIT;
SQL
then echo "ERRO: dupla confirmação aceita"; exit 1; fi
wait "$pid"
grep -q 'Horário indisponível' "$tmp/second"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
 IF (SELECT count(*) FROM public.sqf_appointments WHERE status='confirmed')<>1 THEN
  RAISE EXCEPTION 'Concorrência: quantidade incorreta';
 END IF;
 IF (SELECT status FROM public.sqf_appointments WHERE request_id='00000000-0000-0000-0000-000000000002')<>'proposed' THEN
  RAISE EXCEPTION 'Proposta conflitante foi alterada';
 END IF;
 -- Mesmo cliente com outro prestador também não pode confirmar.
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',true);
 BEGIN
  PERFORM public.sqf_manage_appointment('00000000-0000-0000-0000-000000000003','confirm');
  RAISE EXCEPTION 'Conflito do cliente não bloqueado';
 EXCEPTION WHEN exclusion_violation THEN NULL;
 END;
 -- Terceiro não pode confirmar.
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
 BEGIN
  PERFORM public.sqf_manage_appointment('00000000-0000-0000-0000-000000000004','confirm');
  RAISE EXCEPTION 'Acesso indevido';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Solicitação indisponível' THEN RAISE; END IF;
 END;
 -- Intervalos adjacentes são válidos.
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
 IF public.sqf_manage_appointment('00000000-0000-0000-0000-000000000004','confirm') <> 'confirmed' THEN RAISE EXCEPTION 'Adjacência'; END IF;
 -- Cancelar libera o intervalo para outra proposta.
 PERFORM public.sqf_manage_appointment('00000000-0000-0000-0000-000000000001','cancel');
 IF public.sqf_manage_appointment('00000000-0000-0000-0000-000000000002','confirm') <> 'confirmed' THEN RAISE EXCEPTION 'Cancelamento não liberou'; END IF;
 IF has_function_privilege('anon','public.sqf_manage_appointment(uuid,text,timestamptz,integer)','EXECUTE') THEN RAISE EXCEPTION 'RPC pública'; END IF;
 IF has_table_privilege('authenticated','public.sqf_appointments','UPDATE') THEN RAISE EXCEPTION 'UPDATE direto'; END IF;
END $$;
SQL
echo 'OK: concorrência, conflito cliente/prestador, adjacência, cancelamento, autorização'
