#!/usr/bin/env sh
set -eu
THREAD_ID='019faa3e-b7af-7e13-8335-4f651c989e27'
PROMPT='Owner-authorized scheduler smoke test. Resume the exact existing thread, inspect authoritative Agent OS state, and return only a concise state summary and next permitted action. Do not make external changes.'
out_dir="${CODEX_SMOKE_OUTPUT_DIRECTORY:-/tmp/goofy-codex-smoke}"
smoke_key="smoke:$THREAD_ID:$(date -u +%Y%m%dT%H%M%S):$$"
umask 077
mkdir -p "$out_dir"
chmod 700 "$out_dir"
if test -z "${DATABASE_URL:-}"; then
  echo 'DATABASE_URL is required to verify production runner persistence' >&2
  exit 2
fi
CODEX_OCCURRENCE_KEY="$smoke_key" CODEX_TRIGGER_KIND=manual CODEX_OUTPUT_DIRECTORY="$out_dir" node --experimental-strip-types scripts/run-codex-operating-block.mjs
SMOKE_KEY="$smoke_key" THREAD_ID="$THREAD_ID" DATABASE_URL="$DATABASE_URL" node --input-type=module -e '
    import pg from "pg";
    import { readFile, stat } from "node:fs/promises";
    const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
    const result = await pool.query(`SELECT count(*) FILTER (WHERE e.event_type=$q$started$q$)::int AS started, count(*) FILTER (WHERE e.event_type IN ($q$completed$q$,$q$failed$q$,$q$timeboxed$q$,$q$cancelled$q$))::int AS terminal, count(*)::int AS events, count(DISTINCT r.id)::int AS runs, count(DISTINCT o.id)::int AS occurrences, max(e.payload->>$q$log_path$q$) AS events_path, max(e.payload->>$q$final_output_path$q$) AS final_path FROM codex_operating_block_occurrences o JOIN codex_operating_block_runs r ON r.occurrence_id=o.id JOIN codex_operating_block_run_events e ON e.run_id=r.id WHERE o.occurrence_key=$1 AND r.thread_id=$2`, [process.env.SMOKE_KEY, process.env.THREAD_ID]);
    const row = result.rows[0];
    if (row.occurrences !== 1 || row.runs !== 1 || row.started !== 1 || row.terminal !== 1) throw new Error("production runner did not persist one complete smoke run");
    if (!row.events_path || !row.final_path) throw new Error("production runner did not persist output paths");
    const events = (await readFile(row.events_path, "utf8")).trim().split(/\n+/).filter(Boolean).map(JSON.parse);
    if (!events.some((event) => event.type === "thread.started" && event.thread_id === process.env.THREAD_ID)) throw new Error("runner did not resume the exact thread");
    for (const path of [row.events_path, row.final_path]) if (((await stat(path)).mode & 0o777) !== 0o600) throw new Error("runner output mode is not 0600");
    const active = await pool.query(`SELECT count(*)::int AS active FROM codex_operating_block_runs r WHERE r.status=$q$running$q$ AND NOT EXISTS (SELECT 1 FROM codex_operating_block_run_events e WHERE e.run_id=r.id AND e.event_type IN ($q$completed$q$,$q$failed$q$,$q$timeboxed$q$,$q$cancelled$q$))`);
    if (active.rows[0].active !== 0) throw new Error("smoke run remains active");
    await pool.end();
  '
printf 'exact_thread=%s events_file_mode=600 final_file_mode=600 result=passed\n' "$THREAD_ID"
