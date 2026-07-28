#!/bin/sh
set -eu

[ "$#" -eq 1 ] || { echo 'usage: RESTORE_TARGET_DB=goofy_restore ./scripts/restore.sh /path/to/manifest' >&2; exit 64; }
manifest="$1"
[ -r "$manifest" ] || { echo 'manifest is not readable' >&2; exit 66; }
: "${RESTORE_TARGET_DB:?set RESTORE_TARGET_DB to an isolated replacement database}"
production_db="${POSTGRES_DB:-goofy}"
[ "$RESTORE_TARGET_DB" != "$production_db" ] || { echo 'refusing to restore over the configured production database' >&2; exit 65; }

manifest_dir="$(CDPATH= cd -- "$(dirname -- "$manifest")" && pwd)"
dump_name="$(sed -n 's/^postgres_dump=//p' "$manifest")"
expected="$(sed -n 's/^postgres_sha256=//p' "$manifest")"
case "$dump_name" in ''|*/*|*..*) echo 'invalid dump path in manifest' >&2; exit 65;; esac
dump="$manifest_dir/$dump_name"
[ -r "$dump" ] || { echo 'dump is not readable' >&2; exit 66; }
actual="$(sha256sum "$dump" | awk '{print $1}')"
[ "$actual" = "$expected" ] || { echo 'backup checksum mismatch' >&2; exit 65; }

docker compose exec -T postgres dropdb --if-exists -U "${POSTGRES_USER:-goofy}" "$RESTORE_TARGET_DB"
docker compose exec -T postgres createdb -U "${POSTGRES_USER:-goofy}" "$RESTORE_TARGET_DB"
docker compose exec -T postgres pg_restore --exit-on-error --no-owner --no-acl \
  -U "${POSTGRES_USER:-goofy}" -d "$RESTORE_TARGET_DB" < "$dump"

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-goofy}" -d "$RESTORE_TARGET_DB" <<'SQL'
SELECT 1 FROM system_controls WHERE singleton=true AND commercial_lock=true;
SELECT 1 FROM financial_policy_state WHERE currency='INR' AND released_operating_minor=0 AND required_reserve_minor=200000;
SELECT 1 FROM pg_trigger WHERE tgname IN ('ledger_entries_immutable','audit_events_immutable');
SELECT count(*) FROM memory_references;
SQL
printf 'isolated restore verified: %s\n' "$RESTORE_TARGET_DB"
