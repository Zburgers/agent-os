import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewResponse, type OverviewCounts } from '../src/overview-contract.ts';
import { renderControlPlane } from '../src/control-plane.ts';

test('overview exposes task counts at the contract path used by Command Centre', () => {
  const counts: OverviewCounts = {
    ventures: '1', active_tasks: '3', experiments: '0', opportunities: '0',
    leads: '0', customers: '0', artifacts: '0', incidents: '0',
  };
  const overview = buildOverviewResponse({
    controls: {}, financial: {}, counts, pendingApprovals: [], jobs: [], activity: [],
    tasks: [], currentObjective: null, currentVenture: null, memoryProvider: 'test',
  });

  assert.equal(overview.counts.active_tasks, '3');
  assert.equal('entities' in overview, false);
  assert.match(renderControlPlane('command', overview), /overview\.counts\?\.active_tasks/);
});
