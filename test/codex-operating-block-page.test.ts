import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCodexOperatingBlockPage } from '../src/daily-brief.ts';

test('Codex operating block page exposes Run now, pause, active run, and latest result summaries', () => {
  const page = renderCodexOperatingBlockPage({ schedulePaused: false, active: null, latest: { status: 'timeboxed', exit_reason: 'graceful_timeout', summary: 'result', next_action: 'review', git: 'a → b', track: 'Bounties', money: '£0', approvals: '0' } }, 'csrf');
  assert.match(page, /Run now/);
  assert.match(page, /Pause schedule/);
  assert.match(page, /Active run/);
  assert.match(page, /Latest result/);
  assert.match(page, /Bounties/);
  assert.match(page, /csrf/);
});
