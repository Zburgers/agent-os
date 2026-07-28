#!/bin/sh
set -eu
key="restart-proof-$(date -u +%Y%m%d%H%M%S)"
sql() { docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-goofy}" -d "${POSTGRES_DB:-goofy}" "$@"; }

job_id="$(sql -c "INSERT INTO jobs(name,purpose,action_kind,idempotency_key,status,attempts,max_attempts,lease_until,claimed_by,current_occurrence_key)
VALUES('restart proof','prove abandoned run recovery','job','$key','running',1,3,now()-interval '1 second','terminated-worker','$key:occurrence') RETURNING id")"
sql -c "INSERT INTO job_runs(job_id,status,attempt,worker_id) VALUES('$job_id','running',1,'terminated-worker')" >/dev/null

docker compose kill -s KILL supervisor >/dev/null
docker compose up -d supervisor >/dev/null

i=0
while [ "$i" -lt 30 ]; do
  status="$(sql -c "SELECT status FROM jobs WHERE id='$job_id'")"
  [ "$status" = "completed" ] && break
  i=$((i+1))
  sleep 1
done
[ "${status:-}" = "completed" ] || { echo "restart proof failed: ${status:-missing}" >&2; exit 1; }
effects="$(sql -c "SELECT count(*) FROM job_effects WHERE job_id='$job_id' AND status='completed'")"
[ "$effects" = "1" ] || { echo "expected one completed effect, got $effects" >&2; exit 1; }
runs="$(sql -c "SELECT count(*) FROM job_runs WHERE job_id='$job_id' AND status='completed'")"
[ "$runs" = "1" ] || { echo "expected one completed run, got $runs" >&2; exit 1; }
printf 'supervisor restart verified: job=%s effects=%s\n' "$job_id" "$effects"
