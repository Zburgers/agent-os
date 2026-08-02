#!/usr/bin/env bash
set -euo pipefail

export POSTGRES_PASSWORD=integration-password
export OWNER_DASHBOARD_TOKEN=integration-owner-token
export GOOFY_DATA_DIR="${RUNNER_TEMP:-/tmp}/goofy-agent-os-postgres-verification"
test_database=goofy_integration
database_url="postgresql://goofy:${POSTGRES_PASSWORD}@postgres:5432/${test_database}"

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
  sudo rm -rf "$GOOFY_DATA_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sudo mkdir -p /home/goofy/.hermes
printf 'integration' | sudo tee /home/goofy/.hermes/agent-os-token >/dev/null
printf 'integration-approval-secret' | sudo tee /home/goofy/.hermes/approval-token-secret >/dev/null
printf '{"apiKey":"integration"}' | sudo tee /home/goofy/.hermes/near-agent.json >/dev/null
printf '0000000000000000000000000000000000000000000000000000000000000001' | sudo tee /home/goofy/.hermes/goofy-agent-wallet.key >/dev/null
sudo chmod 600 /home/goofy/.hermes/*

docker compose up -d --wait postgres
docker compose build app
docker compose exec -T postgres sh -c "dropdb --if-exists -U \"\$POSTGRES_USER\" '$test_database' && createdb -U \"\$POSTGRES_USER\" '$test_database'"
docker compose run --rm -T -e DATABASE_URL="$database_url" app sh -c "npm run migrate"
docker compose run --rm -T -e DATABASE_URL="$database_url" app sh -c "npm run migrate"
docker compose run --rm -T -e DATABASE_URL="$database_url" -e RUN_POSTGRES_INTEGRATION=true app sh -c "node --test --test-concurrency=1 --experimental-strip-types test/postgres-integration.test.ts test/external-effect-crash.test.ts test/codex-operating-block-api.test.ts"
