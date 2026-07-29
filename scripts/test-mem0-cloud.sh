#!/bin/sh
set -eu

# Compose supplies MEM0_API_KEY from the owner-controlled .env/secret injection.
# Do not source or print secret files here.
docker compose build app >/dev/null
docker compose run --rm -T --entrypoint npm app run migrate
docker compose run --rm -T --entrypoint node -e RUN_MEM0_LIVE=true app \
  --test --experimental-strip-types test/mem0-live.test.ts
