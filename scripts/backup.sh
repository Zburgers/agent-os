#!/bin/sh
set -eu
: "${BACKUP_DIR:=/backups}"
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/goofy-$(date -u +%Y%m%dT%H%M%SZ).sql"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-goofy}" "${POSTGRES_DB:-goofy}" > "$file"
printf '%s\n' "$file"
