#!/bin/sh
set -eu

: "${BACKUP_DIR:=/home/goofy/agent-os/backups}"
: "${BACKUP_RETENTION:=14}"
umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/goofy-postgres-$stamp.dump"
manifest="$BACKUP_DIR/goofy-$stamp.manifest"
memory_archive="$BACKUP_DIR/goofy-memory-$stamp.tar.gz"

docker compose exec -T postgres pg_dump \
  --format=custom --no-owner --no-acl \
  -U "${POSTGRES_USER:-goofy}" "${POSTGRES_DB:-goofy}" > "$dump"
chmod 600 "$dump"
checksum="$(sha256sum "$dump" | awk '{print $1}')"
memory_root="${MEMORY_DIR:-/home/goofy/agent-os/memory}"
[ -d "$memory_root" ] || { echo "memory directory is missing: $memory_root" >&2; exit 66; }
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$(dirname "$memory_root")" -czf "$memory_archive" "$(basename "$memory_root")"
chmod 600 "$memory_archive"
memory_checksum="$(sha256sum "$memory_archive" | awk '{print $1}')"
count_table() { docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-goofy}" -d "${POSTGRES_DB:-goofy}" -c "SELECT count(*) FROM $1"; }
ledger_count="$(count_table ledger_entries)"
audit_count="$(count_table audit_events)"
memory_reference_count="$(count_table memory_references)"
curated_memory_count="$(count_table curated_memory_records)"

{
  echo "version=2"
  echo "created_at=$stamp"
  echo "database=${POSTGRES_DB:-goofy}"
  echo "postgres_dump=$(basename "$dump")"
  echo "postgres_sha256=$checksum"
  echo "memory_archive=$(basename "$memory_archive")"
  echo "memory_sha256=$memory_checksum"
  echo "ledger_entries_count=$ledger_count"
  echo "audit_events_count=$audit_count"
  echo "memory_references_count=$memory_reference_count"
  echo "curated_memory_records_count=$curated_memory_count"
  echo "memory_store=curated_markdown_and_provider_provenance"
} > "$manifest"
chmod 600 "$manifest"

# PostgreSQL is the durable evidence store for backup health. The archive and
# manifest exist before this write, so a database-recording failure is visible
# rather than silently presenting a backup as verified.
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-goofy}" -d "${POSTGRES_DB:-goofy}" \
  -v manifest_path="$manifest" -v checksum="$checksum" -v memory_checksum="$memory_checksum" <<'SQL' >/dev/null
INSERT INTO backup_runs(status,manifest_path,checksum,finished_at,detail)
VALUES ('succeeded', :'manifest_path', :'checksum', now(), jsonb_build_object('memory_sha256', :'memory_checksum', 'manifest_version', 2));
INSERT INTO system_health_checks(component,status,detail,evidence)
VALUES ('backup','ok','PostgreSQL and curated Markdown backup completed', jsonb_build_array(jsonb_build_object('manifest_path', :'manifest_path', 'postgres_sha256', :'checksum', 'memory_sha256', :'memory_checksum')));
SQL

# Retain the newest verified backup even when retention is misconfigured.
case "$BACKUP_RETENTION" in ''|*[!0-9]*) echo "invalid BACKUP_RETENTION" >&2; exit 64;; esac
if [ "$BACKUP_RETENTION" -lt 1 ]; then BACKUP_RETENTION=1; fi
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'goofy-postgres-*.dump' -o -name 'goofy-memory-*.tar.gz' -o -name 'goofy-*.manifest' \) \
  -printf '%T@ %p\n' | sort -rn | awk -v keep="$((BACKUP_RETENTION * 3))" 'NR>keep {sub(/^[^ ]+ /,""); print}' |
  while IFS= read -r old; do [ -n "$old" ] && rm -f -- "$old"; done

printf '%s\n' "$manifest"
