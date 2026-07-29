#!/usr/bin/env sh
# Runs against a database created solely for this test and removes it on exit.
set -eu

test_database="goofy_integration"
cleanup() {
  docker compose exec -T postgres sh -c "dropdb --if-exists -U \"\$POSTGRES_USER\" '$test_database'" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker compose build app
docker compose exec -T postgres sh -c "dropdb --if-exists -U \"\$POSTGRES_USER\" '$test_database' && createdb -U \"\$POSTGRES_USER\" '$test_database'"
docker compose run --rm -T app sh -c "DATABASE_URL=\"\${DATABASE_URL%/*}/$test_database\" npm run migrate"
docker compose run --rm -T app sh -c "DATABASE_URL=\"\${DATABASE_URL%/*}/$test_database\" npm run migrate"
# These acceptance tests intentionally mutate the singleton control row. Run them
# serially so a temporary, transactionally-authorized test unlock cannot leak
# into another test's policy assertion.
docker compose run --rm -T app sh -c "DATABASE_URL=\"\${DATABASE_URL%/*}/$test_database\" RUN_POSTGRES_INTEGRATION=true node --test --test-concurrency=1 --experimental-strip-types test/postgres-integration.test.ts test/external-effect-crash.test.ts"
