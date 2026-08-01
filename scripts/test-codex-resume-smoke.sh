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
printf 'exact_thread=%s output_file_mode=600 result=passed\n' "$THREAD_ID"
