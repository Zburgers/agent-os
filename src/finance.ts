export type ExpenseRequest = {
  amountPaise: number;
  todaySpentPaise: number;
  experimentSpentPaise: number;
  spendablePaise: number;
  reservePaise: number;
  approved: boolean;
  singleLimitPaise?: number;
  dailyLimitPaise?: number;
  experimentLimitPaise?: number;
};

export function evaluateExpense(request: ExpenseRequest): { allowed: boolean; reason?: string } {
  if (!request.approved) return { allowed: false, reason: 'owner_approval_required' };
  if (request.spendablePaise <= 0 || request.amountPaise > request.spendablePaise) {
    return { allowed: false, reason: 'no_released_capital' };
  }
  if (request.singleLimitPaise !== undefined && request.amountPaise > request.singleLimitPaise) {
    return { allowed: false, reason: 'single_expense_limit_exceeded' };
  }
  if (request.dailyLimitPaise !== undefined && request.todaySpentPaise + request.amountPaise > request.dailyLimitPaise) {
    return { allowed: false, reason: 'daily_spend_limit_exceeded' };
  }
  if (request.experimentLimitPaise !== undefined && request.experimentSpentPaise + request.amountPaise > request.experimentLimitPaise) {
    return { allowed: false, reason: 'experiment_budget_exceeded' };
  }
  return { allowed: true };
}
