#!/bin/sh
set -eu

test_dir="$(mktemp -d /tmp/goofy-restore-test.XXXXXX)"
target="goofy_restore_verify"
cleanup() {
  docker compose exec -T postgres dropdb --if-exists -U "${POSTGRES_USER:-goofy}" "$target" >/dev/null 2>&1 || true
  case "$test_dir" in /tmp/goofy-restore-test.*) rm -rf -- "$test_dir";; esac
}
trap cleanup EXIT INT TERM

manifest="$(BACKUP_DIR="$test_dir" BACKUP_RETENTION=1 scripts/backup.sh)"
RESTORE_TARGET_DB="$target" RESTORE_MEMORY_DIR="$test_dir/restored" scripts/restore.sh "$manifest"
test -d "$test_dir/restored/memory"
test "$(stat -c '%a' "$test_dir/restored/memory")" = 700
grep -q '^ledger_entries_count=' "$manifest"
grep -q '^audit_events_count=' "$manifest"
