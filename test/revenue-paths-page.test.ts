import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRevenuePathsPage } from '../src/revenue-paths-page.ts';

test('Revenue Paths page exposes accessible hierarchy, filters, selected detail, and live metric hooks', () => {
  const html = renderRevenuePathsPage('csrf-test');
  for (const value of ['Revenue Paths', 'Track hierarchy', 'Selected path', 'owner-handoff', 'settled-revenue', 'status', 'stage', 'data-page="revenue-paths"', 'aria-label="Revenue path hierarchy"']) assert.ok(html.includes(value), value);
  assert.match(html, /<button[^>]+aria-expanded/);
  assert.match(html, /@media/);
});

test('Revenue Paths empty state distinguishes proposed paths from active work', () => {
  const html = renderRevenuePathsPage('csrf-test');
  assert.match(html, /No active revenue paths yet/);
  assert.match(html, /Proposed paths remain visible/);
});
