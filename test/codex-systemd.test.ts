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
