import { renderControlPlane } from './control-plane.ts';
import { renderRevenuePathsPage } from './revenue-paths-page.ts';

/** Backwards-compatible Command Centre renderer used by the root route and tests. */
export function renderDashboard(data: Record<string, any>, csrfToken?: string) {
  return renderControlPlane('command', data, csrfToken);
}

export { renderRevenuePathsPage };
