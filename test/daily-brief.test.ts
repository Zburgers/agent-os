import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDailyBrief, type DailyBriefData } from '../src/daily-brief.ts';

const fixture: DailyBriefData = {
  generatedAt: '2026-07-29T12:00:00.000Z',
  controls: { paused: false, killed: false, commercial_lock: false },
  financial: {
    contributions: '500000',
    expenses: '200000',
    revenue: '0',
    refunds: '0',
    fees: '0',
    realized_net_profit_minor: '-200000',
  },
  metrics: {
    leads: 6,
    customers: 0,
    sent: 6,
    replied: 0,
    products: 1,
    activeTasks: 2,
    incidents: 0,
    todayEvents: 42,
  },
  objective: 'Obtain the first settled reliability sprint payment',
  product: {
    name: 'Automation Reliability Sprint',
    description: 'Repair one unreliable workflow and leave a repeatable acceptance test.',
    price_minor: '9900',
    currency: 'USD',
  },
  prospects: [{
    display_name: 'Automation buyer',
    organization: 'Buyer Company',
    source: 'public job post',
    pipeline_stage: 'contacted',
    qualification: 'Explicitly requested n8n reliability work.',
    qualification_score: 88,
    estimated_value_minor: '24900',
    currency: 'USD',
    next_action: 'Review inbox',
    next_action_at: '2026-07-30T08:00:00.000Z',
  }],
  work: [{
    title: 'Convert the first paid pilot',
    status: 'in_progress',
    priority: 100,
    completion_evidence: 'Six provider-accepted messages and zero replies.',
  }],
  experiments: [{
    hypothesis: 'Qualified buyer outreach will produce the first payment.',
    status: 'running',
    actual_result: 'Six messages sent.',
    lesson: 'No demand signal yet.',
    follow_up_decision: 'Continue within the bounded limit.',
  }],
  dueActivities: [{
    title: 'Review buyer reply',
    due_at: '2026-07-30T08:00:00.000Z',
    display_name: 'Buyer Company',
  }],
  cryptoEvidence: 'Two observations found actionable profit remains 0.',
};

test('daily brief is factual, navigable, printable, and free of banned dash characters', () => {
  const html = renderDailyBrief(fixture);
  assert.match(html, /Daily Owner Brief/);
  assert.match(html, /Automation Reliability Sprint/);
  assert.match(html, /Buyer Company/);
  assert.match(html, /Print deck/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /daily-brief-hero\.png/);
  assert.match(html, /daily-brief-research\.png/);
  assert.doesNotMatch(html, /[—–]/);
  assert.equal((html.match(/<section class="slide/g) ?? []).length, 9);
});
