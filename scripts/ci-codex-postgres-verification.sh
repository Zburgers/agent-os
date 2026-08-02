#!/usr/bin/env bash
set -euo pipefail

export POSTGRES_PASSWORD=integration-password
export OWNER_DASHBOARD_TOKEN=integration-owner-token
export GOOFY_DATA_DIR="${RUNNER_TEMP:-/tmp}/goofy-agent-os-postgres-verification"

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
./scripts/test-postgres-integration.sh
