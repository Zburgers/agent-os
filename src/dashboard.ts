import { renderControlPlane } from './control-plane.ts';

/** Backwards-compatible Command Centre renderer used by the root route and tests. */
export function renderDashboard(data: Record<string, any>, csrfToken?: string) {
  return renderControlPlane('command', data, csrfToken);
}
