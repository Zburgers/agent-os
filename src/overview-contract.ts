export type OverviewCounts = {
  ventures: string;
  active_tasks: string;
  experiments: string;
  opportunities: string;
  leads: string;
  customers: string;
  artifacts: string;
  incidents: string;
};

type OverviewParts = {
  controls: unknown;
  financial: Record<string, unknown>;
  counts: OverviewCounts;
  pendingApprovals: unknown[];
  jobs: unknown[];
  activity: unknown[];
  tasks: unknown[];
  currentObjective: unknown;
  currentVenture: unknown;
  memoryProvider: string;
};

/** Build the public overview response consumed by the Command Centre. */
export function buildOverviewResponse(parts: OverviewParts) {
  return {
    controls: parts.controls,
    financial: parts.financial,
    counts: parts.counts,
    pending_approvals: parts.pendingApprovals,
    jobs: parts.jobs,
    activity: parts.activity,
    tasks: parts.tasks,
    current_objective: parts.currentObjective,
    current_venture: parts.currentVenture,
    memory_provider: parts.memoryProvider,
  };
}
