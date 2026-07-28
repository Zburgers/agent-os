#!/bin/sh
set -eu
[ "$#" -eq 1 ] || { echo 'usage: restore.sh /path/to/dump.sql' >&2; exit 64; }
[ -r "$1" ] || { echo 'dump is not readable' >&2; exit 66; }
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-goofy}" -d "${POSTGRES_DB:-goofy}" < "$1"
