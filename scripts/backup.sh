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

docker compose exec -T postgres pg_dump \
  --format=custom --no-owner --no-acl \
  -U "${POSTGRES_USER:-goofy}" "${POSTGRES_DB:-goofy}" > "$dump"
chmod 600 "$dump"
checksum="$(sha256sum "$dump" | awk '{print $1}')"

{
  echo "version=1"
  echo "created_at=$stamp"
  echo "database=${POSTGRES_DB:-goofy}"
  echo "postgres_dump=$(basename "$dump")"
  echo "postgres_sha256=$checksum"
  echo "memory_store=postgres_memory_references"
} > "$manifest"
chmod 600 "$manifest"

# Retain the newest verified backup even when retention is misconfigured.
case "$BACKUP_RETENTION" in ''|*[!0-9]*) echo "invalid BACKUP_RETENTION" >&2; exit 64;; esac
if [ "$BACKUP_RETENTION" -lt 1 ]; then BACKUP_RETENTION=1; fi
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'goofy-postgres-*.dump' -o -name 'goofy-*.manifest' \) \
  -printf '%T@ %p\n' | sort -rn | awk -v keep="$((BACKUP_RETENTION * 2))" 'NR>keep {sub(/^[^ ]+ /,""); print}' |
  while IFS= read -r old; do [ -n "$old" ] && rm -f -- "$old"; done

printf '%s\n' "$manifest"
