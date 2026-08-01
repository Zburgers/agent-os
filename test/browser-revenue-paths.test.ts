import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRevenuePathsPage } from '../src/revenue-paths-page.ts';

test('Revenue Paths browser contract includes responsive and keyboard-safe controls', () => {
  const html = renderRevenuePathsPage('browser-csrf');
  assert.match(html, /data-page="revenue-paths"/);
  assert.match(html, /type="submit"/);
  assert.match(html, /aria-label="Revenue path hierarchy"/);
  assert.match(html, /@media\(max-width:800px\)/);
  assert.match(html, /button\.addEventListener\('click'/);
});
