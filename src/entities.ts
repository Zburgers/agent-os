import { audit, pool } from './db.ts';

export type EntityName = 'ventures' | 'opportunities' | 'objectives' | 'tasks' | 'experiments' | 'decisions';
const names = new Set<EntityName>(['ventures', 'opportunities', 'objectives', 'tasks', 'experiments', 'decisions']);
const statuses = new Set(['inbox', 'backlog', 'ready', 'in_progress', 'blocked', 'waiting_for_owner', 'validation', 'completed', 'abandoned']);
const experimentStatuses = new Set(['draft', 'running', 'paused', 'completed', 'abandoned']);

function text(value: unknown, field: string, required = false) {
  if (value === undefined || value === null || value === '') { if (required) throw new Error(`missing_${field}`); return null; }
  if (typeof value !== 'string' || value.length > 10_000) throw new Error(`invalid_${field}`);
  return value.trim();
}
function integer(value: unknown, field: string, required = false) {
  if (value === undefined || value === null || value === '') { if (required) throw new Error(`missing_${field}`); return null; }
  if (!Number.isSafeInteger(value)) throw new Error(`invalid_${field}`); return value;
}
function json(value: unknown, field: string, required = false) {
  if (value === undefined || value === null) { if (required) throw new Error(`missing_${field}`); return []; }
  if (!Array.isArray(value)) throw new Error(`invalid_${field}`); return value;
}
function optionalId(value: unknown, field: string) { return text(value, field, false); }

export function isEntityName(value: string): value is EntityName { return names.has(value as EntityName); }
export async function listEntity(entity: EntityName) {
  const order = entity === 'tasks' ? 'updated_at DESC' : 'created_at DESC';
  return (await pool.query(`SELECT * FROM ${entity} ORDER BY ${order} LIMIT 100`)).rows;
}

export async function createEntity(entity: EntityName, input: Record<string, unknown>, actor = 'owner') {
  let result;
  if (entity === 'ventures') {
    result = await pool.query(`INSERT INTO ventures(name,thesis,target_user,problem,offer,revenue_model,distribution_strategy,capital_allocated_minor,evidence,risks,next_milestone,kill_criteria) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [text(input.name,'name',true),text(input.thesis,'thesis',true),text(input.target_user,'target_user',true),text(input.problem,'problem',true),text(input.offer,'offer',true),text(input.revenue_model,'revenue_model',true),text(input.distribution_strategy,'distribution_strategy',true),integer(input.capital_allocated_minor,'capital_allocated_minor') ?? 0,JSON.stringify(json(input.evidence,'evidence')),JSON.stringify(json(input.risks,'risks')),text(input.next_milestone,'next_milestone'),text(input.kill_criteria,'kill_criteria')]);
  } else if (entity === 'opportunities') {
    result = await pool.query(`INSERT INTO opportunities(customer_problem,target_market,evidence,competitors,distribution_path,monetization_path,build_effort,time_to_revenue,capital_required_minor,reusability,strategic_fit,expected_value,confidence,risks,decision_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [text(input.customer_problem,'customer_problem',true),text(input.target_market,'target_market',true),JSON.stringify(json(input.evidence,'evidence')),JSON.stringify(json(input.competitors,'competitors')),text(input.distribution_path,'distribution_path',true),text(input.monetization_path,'monetization_path',true),text(input.build_effort,'build_effort',true),text(input.time_to_revenue,'time_to_revenue',true),integer(input.capital_required_minor,'capital_required_minor') ?? 0,integer(input.reusability,'reusability'),integer(input.strategic_fit,'strategic_fit'),input.expected_value ?? null,integer(input.confidence,'confidence'),JSON.stringify(json(input.risks,'risks')),text(input.decision_status,'decision_status') ?? 'under_consideration']);
  } else if (entity === 'objectives') {
    result = await pool.query(`INSERT INTO objectives(statement,status,expected_value) VALUES($1,$2,$3) RETURNING *`, [text(input.statement,'statement',true),text(input.status,'status') ?? 'active',input.expected_value ?? null]);
  } else if (entity === 'tasks') {
    const status = text(input.status,'status') ?? 'backlog'; if (!statuses.has(status)) throw new Error('invalid_status');
    result = await pool.query(`INSERT INTO tasks(venture_id,objective_id,title,status,priority,expected_value,cost_estimate_minor,decision_or_hypothesis,completion_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [optionalId(input.venture_id,'venture_id'),optionalId(input.objective_id,'objective_id'),text(input.title,'title',true),status,integer(input.priority,'priority') ?? 0,input.expected_value ?? null,integer(input.cost_estimate_minor,'cost_estimate_minor'),text(input.decision_or_hypothesis,'decision_or_hypothesis'),text(input.completion_evidence,'completion_evidence')]);
  } else if (entity === 'experiments') {
    result = await pool.query(`INSERT INTO experiments(venture_id,hypothesis,target_customer,method,budget_minor,start_at,review_at,success_metric,failure_metric,stop_loss_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [optionalId(input.venture_id,'venture_id'),text(input.hypothesis,'hypothesis',true),text(input.target_customer,'target_customer',true),text(input.method,'method',true),integer(input.budget_minor,'budget_minor') ?? 0,text(input.start_at,'start_at'),text(input.review_at,'review_at'),text(input.success_metric,'success_metric',true),text(input.failure_metric,'failure_metric',true),integer(input.stop_loss_minor,'stop_loss_minor') ?? 0]);
  } else {
    result = await pool.query(`INSERT INTO decisions(statement,context,options,evidence,selected_option,rejected_options,expected_result,confidence,cost_minor,risk,review_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [text(input.statement,'statement',true),text(input.context,'context',true),JSON.stringify(json(input.options,'options',true)),JSON.stringify(json(input.evidence,'evidence',true)),text(input.selected_option,'selected_option',true),JSON.stringify(json(input.rejected_options,'rejected_options')),text(input.expected_result,'expected_result'),integer(input.confidence,'confidence'),integer(input.cost_minor,'cost_minor'),text(input.risk,'risk'),text(input.review_at,'review_at')]);
  }
  await audit(`${entity}_created`, entity.slice(0, -1), result.rows[0].id, {}, actor); return result.rows[0];
}

const editable: Record<EntityName, Set<string>> = {
  ventures: new Set(['thesis','target_user','problem','offer','revenue_model','distribution_strategy','next_milestone','kill_criteria','evidence','risks']),
  opportunities: new Set(['decision_status','evidence','competitors','risks','confidence','expected_value']),
  objectives: new Set(['statement','status','expected_value']),
  tasks: new Set(['title','status','priority','expected_value','cost_estimate_minor','decision_or_hypothesis','completion_evidence','venture_id','objective_id']),
  experiments: new Set(['status','start_at','actual_result','lesson','follow_up_decision','review_at','success_metric','failure_metric','actual_expense_minor','actual_revenue_minor','decision']),
  decisions: new Set(['actual_outcome','lesson','review_at','expected_result','confidence']),
};
export async function updateEntity(entity: EntityName, id: string, input: Record<string, unknown>, actor = 'owner') {
  const fields = Object.entries(input).filter(([field, value]) => editable[entity].has(field) && value !== undefined);
  if (!fields.length) throw new Error('no_valid_changes');
  if (entity === 'tasks' && input.status && (!statuses.has(String(input.status)))) throw new Error('invalid_status');
  if (entity === 'experiments' && input.status && (!experimentStatuses.has(String(input.status)))) throw new Error('invalid_status');
  const values = fields.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value);
  const set = fields.map(([field], index) => `${field}=$${index + 1}`).join(', ');
  const timestamp = entity === 'tasks' ? ', updated_at=now()' : '';
  const result = await pool.query(`UPDATE ${entity} SET ${set}${timestamp} WHERE id=$${values.length + 1} RETURNING *`, [...values, id]);
  if (!result.rowCount) throw new Error('not_found'); await audit(`${entity}_updated`, entity.slice(0, -1), id, { fields: fields.map(([field]) => field) }, actor); return result.rows[0];
}
