#!/usr/bin/env sh
set -eu
THREAD_ID='019faa3e-b7af-7e13-8335-4f651c989e27'
PROMPT='Owner-authorized scheduler smoke test. Resume this exact existing thread and inspect current authoritative Agent OS goal/control/approval state. Confirm whether the previously blocked goal can now resume. Do not modify files, Git, database state, services, accounts, wallets, deployments, or external systems; do not send messages or spend. Return only a concise state summary and next permitted action.'
CODEX_BIN="$(command -v codex)"
case "$CODEX_BIN" in /*) ;; *) echo 'codex executable is not absolute' >&2; exit 2 ;; esac
test -f "/home/goofy/.codex/sessions/2026/07/29/rollout-2026-07-29T01-11-04-$THREAD_ID.jsonl"
out_dir="${CODEX_SMOKE_OUTPUT_DIRECTORY:-/tmp/goofy-codex-smoke}"
umask 077
mkdir -p "$out_dir"
chmod 700 "$out_dir"
out_file="$out_dir/$THREAD_ID.jsonl"
timeout --signal=INT --kill-after=5s 120s "$CODEX_BIN" exec resume "$THREAD_ID" "$PROMPT" --json -o "$out_file"
test "$(stat -c '%a' "$out_file")" = 600
grep -q 'thread.started' "$out_file"
grep -q "\"thread_id\"[[:space:]]*:[[:space:]]*\"$THREAD_ID\"" "$out_file"
if test -n "${DATABASE_URL:-}"; then
  SMOKE_KEY="smoke:$THREAD_ID:$(date -u +%F)" THREAD_ID="$THREAD_ID" DATABASE_URL="$DATABASE_URL" node --input-type=module -e '
    import pg from "pg";
    const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
    const key = process.env.SMOKE_KEY;
    const occurrence = await pool.query(`INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind,status,started_at,finished_at) VALUES($1,current_date,'manual','completed',now(),now()) ON CONFLICT(occurrence_key) DO NOTHING RETURNING id`, [key]);
    if (occurrence.rows[0]) { const run = await pool.query(`INSERT INTO codex_operating_block_runs(occurrence_id,thread_id,status,finished_at,duration_ms) VALUES($1,$2,'completed',now(),0) RETURNING id`, [occurrence.rows[0].id, process.env.THREAD_ID]); await pool.query(`INSERT INTO codex_operating_block_run_events(run_id,event_type,payload) VALUES($1,'completed',$2)`, [run.rows[0].id, JSON.stringify({smoke:true, thread_id:process.env.THREAD_ID})]); }
    await pool.end();
  '
fi
printf 'exact_thread=%s output_file_mode=600 result=passed\n' "$THREAD_ID"
