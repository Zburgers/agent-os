import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Codex systemd units enforce the exact schedule and one-hour boundary', () => {
  const service = readFileSync('systemd/goofy-agent-os-codex-goal.service', 'utf8');
  const timer = readFileSync('systemd/goofy-agent-os-codex-goal.timer', 'utf8');
  assert.match(service, /Type=oneshot/);
  assert.match(service, /WorkingDirectory=\/home\/goofy\/agent-os/);
  assert.match(service, /RuntimeMaxSec=1h/);
  assert.match(service, /TimeoutStopSec=30s/);
  assert.match(service, /KillMode=mixed/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(timer, /OnCalendar=\*-\*-\* 09:00:00 Asia\/Kolkata/);
  assert.match(timer, /Persistent=true/);
  assert.doesNotMatch(timer, /RandomizedDelaySec=(?!0s)/);
});

test('Codex smoke test separates stdout events from final output and executes the production runner', () => {
  const text = readFileSync('scripts/test-codex-resume-smoke.sh', 'utf8');
  assert.match(text, /scripts\/run-codex-operating-block\.mjs/);
  assert.match(text, /CODEX_OUTPUT_DIRECTORY/);
  assert.match(text, /events_path/);
  assert.match(text, /final_path/);
  assert.doesNotMatch(text, /INSERT INTO codex_operating_block_runs/);
});
