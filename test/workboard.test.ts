import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWorkBoard } from '../src/workboard.ts';
import { renderDashboard } from '../src/dashboard.ts';
import { renderControlPlane } from '../src/control-plane.ts';

test('legacy work board exposes the shared ticket API controls and durable states', () => {
  const html = renderWorkBoard();
  for (const value of ['ticketFilters', 'ticketBoard', 'ticketDetailDialog', '/api/tickets?', '/comments', 'inbox', 'waiting_for_owner', 'abandoned']) assert.match(html, new RegExp(value));
});

test('command centre provides concise summaries and links to dedicated record pages', () => {
  const html = renderDashboard({ financial: {} }, 'csrf-test');
  for (const value of ['/work', '/commercial', '/activity', '/approvals', '/decisions', '/finance', '/jobs', '/health', 'Latest meaningful activity', 'Owner attention required', 'data-page="command"']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('Operations records'));
});

test('each owner control-plane route has a title, description, and active navigation item', () => {
  for (const [page, title] of [['work', 'Work'], ['commercial', 'Commercial'], ['activity', 'Activity'], ['approvals', 'Approvals'], ['decisions', 'Decisions'], ['finance', 'Finance'], ['jobs', 'Jobs'], ['health', 'Health']] as const) {
    const html = renderControlPlane(page, {}, 'csrf-test');
    assert.match(html, new RegExp(`<h1>${title}</h1>`));
    assert.match(html, new RegExp(`data-page="${page}"`));
    assert.match(html, /aria-current="page"/);
  }
});

test('decisions route renders the durable business decision journal', () => {
  const html = renderControlPlane('decisions', {}, 'csrf-test');
  for (const value of ['loadDecisions', '/api/decisions?', 'Decision journal', 'Selected option', 'Expected result', 'Evidence']) assert.ok(html.includes(value), value);
});

test('commercial route renders the full revenue operations workspace', () => {
  const html = renderControlPlane('commercial', {}, 'csrf-test');
  for (const value of ['loadCommercial', '/api/commercial/overview', 'Revenue funnel', 'Actual buyers and customers', 'Products, offers, and pricing', 'Outreach and conversations', 'Recurring operations']) {
    assert.ok(html.includes(value), value);
  }
});

test('finance page includes the dedicated Goofy wallet operational view', () => {
  const html = renderControlPlane('finance', {}, 'csrf-test');
  assert.ok(html.includes('Dedicated Goofy wallet'));
  assert.ok(html.includes('/api/agent-wallet/status'));
});
