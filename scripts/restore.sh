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
memory_name="$(sed -n 's/^memory_archive=//p' "$manifest")"
memory_expected="$(sed -n 's/^memory_sha256=//p' "$manifest")"
ledger_expected="$(sed -n 's/^ledger_entries_count=//p' "$manifest")"
audit_expected="$(sed -n 's/^audit_events_count=//p' "$manifest")"
memory_reference_expected="$(sed -n 's/^memory_references_count=//p' "$manifest")"
curated_memory_expected="$(sed -n 's/^curated_memory_records_count=//p' "$manifest")"
case "$dump_name" in ''|*/*|*..*) echo 'invalid dump path in manifest' >&2; exit 65;; esac
dump="$manifest_dir/$dump_name"
[ -r "$dump" ] || { echo 'dump is not readable' >&2; exit 66; }
actual="$(sha256sum "$dump" | awk '{print $1}')"
[ "$actual" = "$expected" ] || { echo 'backup checksum mismatch' >&2; exit 65; }
[ -n "$memory_name" ] && [ -n "$memory_expected" ] || { echo 'memory backup evidence missing' >&2; exit 65; }
case "$memory_name" in ''|*/*|*..*) echo 'invalid memory archive path in manifest' >&2; exit 65;; esac
memory_archive="$manifest_dir/$memory_name"
[ -r "$memory_archive" ] || { echo 'memory archive is not readable' >&2; exit 66; }
[ "$(sha256sum "$memory_archive" | awk '{print $1}')" = "$memory_expected" ] || { echo 'memory backup checksum mismatch' >&2; exit 65; }
[ -n "$ledger_expected" ] && [ -n "$audit_expected" ] && [ -n "$memory_reference_expected" ] && [ -n "$curated_memory_expected" ] || { echo 'backup state-comparison evidence missing' >&2; exit 65; }
: "${RESTORE_MEMORY_DIR:=$manifest_dir/restored-memory}"
[ ! -e "$RESTORE_MEMORY_DIR" ] || { echo 'restore memory destination already exists' >&2; exit 65; }
mkdir -m 700 "$RESTORE_MEMORY_DIR"
tar -xzf "$memory_archive" -C "$RESTORE_MEMORY_DIR" --no-same-owner --no-same-permissions
find "$RESTORE_MEMORY_DIR/memory" -type d -exec chmod 700 {} \;
find "$RESTORE_MEMORY_DIR/memory" -type f -exec chmod 600 {} \;

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
count_table() { docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-goofy}" -d "$RESTORE_TARGET_DB" -c "SELECT count(*) FROM $1"; }
[ "$(count_table ledger_entries)" = "$ledger_expected" ] || { echo 'ledger restore state mismatch' >&2; exit 65; }
[ "$(count_table audit_events)" = "$audit_expected" ] || { echo 'audit restore state mismatch' >&2; exit 65; }
[ "$(count_table memory_references)" = "$memory_reference_expected" ] || { echo 'memory-reference restore state mismatch' >&2; exit 65; }
[ "$(count_table curated_memory_records)" = "$curated_memory_expected" ] || { echo 'curated-memory restore state mismatch' >&2; exit 65; }
printf 'isolated restore verified: %s\n' "$RESTORE_TARGET_DB"
