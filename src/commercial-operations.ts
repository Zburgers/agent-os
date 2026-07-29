import type { Pool, PoolClient } from 'pg';
import { redactSecrets } from './redaction.ts';

type Database = Pick<Pool, 'query' | 'connect'>;
export type CommercialActor = { type: 'owner' | 'agent' | 'worker' | 'system'; id: string };
export type CommercialPage = {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  stage?: string;
};

const stages = new Set(['potential','qualified','contacted','engaged','proposal','negotiation','won','lost','disqualified']);
const productStatuses = new Set(['draft','active','paused','retired']);
const pricingModels = new Set(['one_time','recurring','usage','custom','free']);
const recurrences = new Set(['none','daily','weekly','monthly','quarterly']);
const activityStatuses = new Set(['scheduled','due','completed','cancelled']);
const activityTypes = new Set(['research','follow_up','reply_review','proposal','meeting','delivery','renewal','other']);
const messageEvents = new Set(['drafted','authorized','sent','delivered','delivery_delayed','bounced','failed','suppressed','complained','opened','clicked','replied']);

function bounded(value: number | undefined, fallback: number, maximum: number) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Math.min(Number(value), maximum) : fallback;
}
function cleanText(value: unknown, field: string, maximum: number, required = false) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (required && !cleaned) throw new Error(`missing_${field}`);
  if (cleaned.length > maximum) throw new Error(`invalid_${field}`);
  return cleaned || null;
}
function optionalUuid(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const id = String(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`invalid_${field}`);
  return id;
}
function money(value: unknown, field: string, required = false) {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`invalid_${field}`);
  return amount;
}
function isoDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`invalid_${field}`);
  return parsed.toISOString();
}
function actorId(actor: CommercialActor) {
  if (!actor.id.trim()) throw new Error('invalid_actor');
  return `${actor.type}:${actor.id}`;
}
function currency(value: unknown) {
  const code = String(value ?? 'INR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('invalid_currency');
  return code;
}
function maskEndpoint(value: unknown) {
  const endpoint = String(value ?? '');
  if (!endpoint) return null;
  if (endpoint.includes('@')) {
    const [local, domain] = endpoint.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return endpoint.length <= 8 ? '••••' : `${endpoint.slice(0, 4)}…${endpoint.slice(-4)}`;
}
function safeRows(rows: Record<string, unknown>[]) {
  return rows.map(row => {
    const safe = { ...row, contact_endpoint_masked: maskEndpoint(row.contact_endpoint) };
    delete safe.contact_endpoint;
    return safe;
  });
}
async function richAudit(client: PoolClient, actor: CommercialActor, eventType: string, entityType: string, entityId: string, payload: Record<string, unknown> = {}) {
  await client.query(
    `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [actor.type, actor.id, eventType, entityType, entityId, JSON.stringify(payload)],
  );
}

export class CommercialOperationsService {
  private database: Database;
  constructor(database: Database) { this.database = database; }

  async overview() {
    const [funnel, messageMetrics, customerMetrics, activityMetrics, products, pipelineValue] = await Promise.all([
      this.database.query(`SELECT pipeline_stage,count(*)::int AS count
        FROM leads GROUP BY pipeline_stage ORDER BY
        array_position(ARRAY['potential','qualified','contacted','engaged','proposal','negotiation','won','lost','disqualified'],pipeline_stage)`),
      this.database.query(`SELECT
        count(*) FILTER(WHERE m.direction='outbound')::int AS sent,
        count(*) FILTER(WHERE EXISTS(
          SELECT 1 FROM commercial_message_events delivered WHERE delivered.message_id=m.id AND delivered.event_type='delivered'
        ))::int AS delivered,
        count(*) FILTER(WHERE latest.event_type IN ('bounced','failed','suppressed','complained'))::int AS failed,
        count(*) FILTER(WHERE latest.event_type='replied' OR EXISTS(
          SELECT 1 FROM commercial_message_events reply WHERE reply.message_id=m.id AND reply.event_type='replied'
        ))::int AS replied
        FROM commercial_messages m
        LEFT JOIN LATERAL (
          SELECT event_type FROM commercial_message_events
          WHERE message_id=m.id ORDER BY occurred_at DESC,recorded_at DESC LIMIT 1
        ) latest ON true`),
      this.database.query(`SELECT
        count(*) FILTER(WHERE lifecycle_status='active')::int AS active,
        count(*) FILTER(WHERE lifecycle_status='churned')::int AS churned
        FROM customers`),
      this.database.query(`SELECT
        count(*) FILTER(WHERE status IN ('scheduled','due') AND due_at < now())::int AS overdue,
        count(*) FILTER(WHERE status IN ('scheduled','due') AND due_at >= now() AND due_at < now()+interval '7 days')::int AS due_this_week,
        count(*) FILTER(WHERE recurrence<>'none' AND status IN ('scheduled','due'))::int AS recurring
        FROM commercial_activities`),
      this.database.query(`SELECT count(*) FILTER(WHERE status='active')::int AS active,
        count(*)::int AS total FROM commercial_products`),
      this.database.query(`SELECT COALESCE(SUM(estimated_value_minor) FILTER(
        WHERE pipeline_stage IN ('qualified','contacted','engaged','proposal','negotiation')
      ),0)::text AS open_value_minor,currency
        FROM leads GROUP BY currency ORDER BY currency`),
    ]);
    const messages = messageMetrics.rows[0] ?? { sent: 0, delivered: 0, failed: 0, replied: 0 };
    return {
      funnel: funnel.rows,
      messages: {
        ...messages,
        reply_rate: Number(messages.sent) ? Number(messages.replied) / Number(messages.sent) : 0,
        delivery_rate: Number(messages.sent) ? Number(messages.delivered) / Number(messages.sent) : 0,
      },
      customers: customerMetrics.rows[0] ?? { active: 0, churned: 0 },
      activities: activityMetrics.rows[0] ?? { overdue: 0, due_this_week: 0, recurring: 0 },
      products: products.rows[0] ?? { active: 0, total: 0 },
      pipeline_value: pipelineValue.rows,
    };
  }

  async listProspects(page: CommercialPage = {}) {
    const limit = bounded(page.limit, 50, 100); const offset = bounded(page.offset, 0, 1_000_000);
    const search = cleanText(page.search, 'search', 200); const stage = cleanText(page.stage ?? page.status, 'stage', 40);
    if (stage && !stages.has(stage)) throw new Error('invalid_stage');
    const { rows } = await this.database.query(
      `SELECT l.*,p.name AS product_name,v.name AS venture_name,c.display_name AS customer_name,
        count(*) OVER() AS total_count
       FROM leads l
       LEFT JOIN commercial_products p ON p.id=l.product_id
       LEFT JOIN ventures v ON v.id=l.venture_id
       LEFT JOIN customers c ON c.id=l.customer_id
       WHERE ($1::text IS NULL OR l.pipeline_stage=$1)
         AND ($2::text IS NULL OR COALESCE(l.display_name,'') ILIKE '%'||$2||'%'
           OR COALESCE(l.organization,'') ILIKE '%'||$2||'%' OR l.source ILIKE '%'||$2||'%')
       ORDER BY
         CASE WHEN l.next_action_at < now() THEN 0 WHEN l.next_action_at IS NULL THEN 2 ELSE 1 END,
         l.next_action_at ASC NULLS LAST,l.qualification_score DESC NULLS LAST,l.updated_at DESC
       LIMIT $3 OFFSET $4`,
      [stage, search, limit, offset],
    );
    return { items: safeRows(rows), limit, offset, total: Number(rows[0]?.total_count ?? 0) };
  }

  async prospectDetail(id: string) {
    const prospect = await this.database.query(
      `SELECT l.*,p.name AS product_name,v.name AS venture_name,c.display_name AS customer_name
       FROM leads l LEFT JOIN commercial_products p ON p.id=l.product_id
       LEFT JOIN ventures v ON v.id=l.venture_id LEFT JOIN customers c ON c.id=l.customer_id
       WHERE l.id=$1`, [id],
    );
    if (!prospect.rows[0]) return null;
    const [messages, activities] = await Promise.all([
      this.database.query(`SELECT m.id,m.direction,m.channel,m.subject,m.content_preview,m.occurred_at,
        latest.event_type AS latest_status,latest.occurred_at AS latest_status_at
        FROM commercial_messages m LEFT JOIN LATERAL (
          SELECT event_type,occurred_at FROM commercial_message_events WHERE message_id=m.id
          ORDER BY occurred_at DESC,recorded_at DESC LIMIT 1
        ) latest ON true WHERE m.lead_id=$1 ORDER BY m.occurred_at DESC LIMIT 100`, [id]),
      this.database.query(`SELECT * FROM commercial_activities WHERE lead_id=$1 ORDER BY
        CASE WHEN status IN ('scheduled','due') THEN 0 ELSE 1 END,due_at ASC NULLS LAST,created_at DESC LIMIT 100`, [id]),
    ]);
    return { ...safeRows(prospect.rows)[0], messages: messages.rows, activities: activities.rows };
  }

  async listProducts(page: CommercialPage = {}) {
    const limit = bounded(page.limit, 50, 100); const offset = bounded(page.offset, 0, 1_000_000);
    const search = cleanText(page.search, 'search', 200); const status = cleanText(page.status, 'status', 40);
    if (status && !productStatuses.has(status)) throw new Error('invalid_status');
    const { rows } = await this.database.query(
      `SELECT p.*,v.name AS venture_name,
        count(l.id) FILTER(WHERE l.pipeline_stage NOT IN ('lost','disqualified'))::int AS active_prospects,
        count(l.id) FILTER(WHERE l.pipeline_stage='won')::int AS won,
        count(*) OVER() AS total_count
       FROM commercial_products p LEFT JOIN ventures v ON v.id=p.venture_id
       LEFT JOIN leads l ON l.product_id=p.id
       WHERE ($1::text IS NULL OR p.status=$1)
         AND ($2::text IS NULL OR p.name ILIKE '%'||$2||'%' OR p.description ILIKE '%'||$2||'%')
       GROUP BY p.id,v.name ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,p.updated_at DESC
       LIMIT $3 OFFSET $4`, [status, search, limit, offset],
    );
    return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
  }

  async listMessages(page: CommercialPage = {}) {
    const limit = bounded(page.limit, 50, 100); const offset = bounded(page.offset, 0, 1_000_000);
    const search = cleanText(page.search, 'search', 200); const status = cleanText(page.status, 'status', 40);
    if (status && !messageEvents.has(status)) throw new Error('invalid_status');
    const { rows } = await this.database.query(
      `SELECT m.id,m.lead_id,m.customer_id,m.product_id,m.direction,m.channel,m.subject,m.content_preview,
        m.provider_reference,m.effect_intent_id,m.approval_id,m.occurred_at,
        COALESCE(l.display_name,c.display_name,l.organization,'Unknown contact') AS contact_name,
        p.name AS product_name,latest.event_type AS latest_status,latest.occurred_at AS latest_status_at,
        count(*) OVER() AS total_count
       FROM commercial_messages m LEFT JOIN leads l ON l.id=m.lead_id
       LEFT JOIN customers c ON c.id=m.customer_id LEFT JOIN commercial_products p ON p.id=m.product_id
       LEFT JOIN LATERAL (
         SELECT event_type,occurred_at FROM commercial_message_events WHERE message_id=m.id
         ORDER BY occurred_at DESC,recorded_at DESC LIMIT 1
       ) latest ON true
       WHERE ($1::text IS NULL OR latest.event_type=$1)
         AND ($2::text IS NULL OR COALESCE(m.subject,'') ILIKE '%'||$2||'%'
           OR COALESCE(l.display_name,c.display_name,l.organization,'') ILIKE '%'||$2||'%')
       ORDER BY m.occurred_at DESC LIMIT $3 OFFSET $4`, [status, search, limit, offset],
    );
    return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
  }

  async listCustomers(page: CommercialPage = {}) {
    const limit = bounded(page.limit, 50, 100); const offset = bounded(page.offset, 0, 1_000_000);
    const search = cleanText(page.search, 'search', 200); const status = cleanText(page.status, 'status', 40);
    if (status && !['active','inactive','churned'].includes(status)) throw new Error('invalid_status');
    const { rows } = await this.database.query(
      `SELECT c.id,c.external_ref,c.display_name,c.lifecycle_status,c.next_action,c.next_action_at,
        c.created_at,c.updated_at,v.name AS venture_name,l.organization AS source_organization,
        COALESCE(SUM(pay.amount_minor) FILTER(WHERE pay.status='settled'),0)::text AS settled_revenue_minor,
        COALESCE(MAX(pay.currency),'INR') AS currency,count(*) OVER() AS total_count
       FROM customers c LEFT JOIN ventures v ON v.id=c.venture_id
       LEFT JOIN leads l ON l.id=c.source_lead_id LEFT JOIN invoices i ON i.customer_id=c.id
       LEFT JOIN payments pay ON pay.invoice_id=i.id
       WHERE ($1::text IS NULL OR c.lifecycle_status=$1)
         AND ($2::text IS NULL OR c.display_name ILIKE '%'||$2||'%'
           OR COALESCE(l.organization,'') ILIKE '%'||$2||'%')
       GROUP BY c.id,v.name,l.organization
       ORDER BY CASE c.lifecycle_status WHEN 'active' THEN 0 ELSE 1 END,c.next_action_at ASC NULLS LAST,c.updated_at DESC
       LIMIT $3 OFFSET $4`, [status, search, limit, offset],
    );
    return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
  }

  async listActivities(page: CommercialPage = {}) {
    const limit = bounded(page.limit, 50, 100); const offset = bounded(page.offset, 0, 1_000_000);
    const search = cleanText(page.search, 'search', 200); const status = cleanText(page.status, 'status', 40);
    if (status && !activityStatuses.has(status)) throw new Error('invalid_status');
    const { rows } = await this.database.query(
      `SELECT a.*,COALESCE(l.display_name,c.display_name,l.organization,'Unknown contact') AS contact_name,
        p.name AS product_name,count(*) OVER() AS total_count
       FROM commercial_activities a LEFT JOIN leads l ON l.id=a.lead_id
       LEFT JOIN customers c ON c.id=a.customer_id LEFT JOIN commercial_products p ON p.id=a.product_id
       WHERE ($1::text IS NULL OR a.status=$1)
         AND ($2::text IS NULL OR a.title ILIKE '%'||$2||'%' OR COALESCE(a.detail,'') ILIKE '%'||$2||'%')
       ORDER BY CASE WHEN a.status IN ('scheduled','due') AND a.due_at<now() THEN 0
         WHEN a.status IN ('scheduled','due') THEN 1 ELSE 2 END,a.due_at ASC NULLS LAST,a.updated_at DESC
       LIMIT $3 OFFSET $4`, [status, search, limit, offset],
    );
    return { items: rows, limit, offset, total: Number(rows[0]?.total_count ?? 0) };
  }

  async createProduct(input: Record<string, unknown>, actor: CommercialActor) {
    const status = String(input.status ?? 'draft'); const model = String(input.pricing_model ?? '');
    if (!productStatuses.has(status)) throw new Error('invalid_status');
    if (!pricingModels.has(model)) throw new Error('invalid_pricing_model');
    const interval = cleanText(input.billing_interval, 'billing_interval', 20);
    if ((model === 'recurring') !== Boolean(interval)) throw new Error('invalid_billing_interval');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO commercial_products(venture_id,name,description,target_customer,status,pricing_model,
          price_minor,currency,billing_interval,delivery_summary,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
        [optionalUuid(input.venture_id,'venture_id'),cleanText(input.name,'name',200,true),
          cleanText(input.description,'description',5000,true),cleanText(input.target_customer,'target_customer',1000,true),
          status,model,money(input.price_minor,'price_minor'),currency(input.currency),interval,
          cleanText(input.delivery_summary,'delivery_summary',5000),actorId(actor)],
      );
      await richAudit(client,actor,'commercial_product_created','commercial_product',rows[0].id,{ status, pricing_model:model });
      await client.query('COMMIT'); return rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async createProspect(input: Record<string, unknown>, actor: CommercialActor) {
    const stage = String(input.pipeline_stage ?? 'potential');
    if (!stages.has(stage)) throw new Error('invalid_stage');
    const score = input.qualification_score === undefined ? null : money(input.qualification_score,'qualification_score');
    if (score !== null && score > 100) throw new Error('invalid_qualification_score');
    const endpoint = cleanText(input.contact_endpoint,'contact_endpoint',500);
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO leads(source,qualification,contact_status,consent_basis,venture_id,product_id,
          display_name,organization,source_uri,pipeline_stage,qualification_score,estimated_value_minor,
          currency,contact_channel,contact_endpoint,next_action,next_action_at,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18) RETURNING *`,
        [cleanText(input.source,'source',500,true),cleanText(input.qualification,'qualification',3000,true),
          cleanText(input.contact_status,'contact_status',100) ?? 'draft',cleanText(input.consent_basis,'consent_basis',1000),
          optionalUuid(input.venture_id,'venture_id'),optionalUuid(input.product_id,'product_id'),
          cleanText(input.display_name,'display_name',300),cleanText(input.organization,'organization',300),
          cleanText(input.source_uri,'source_uri',2000),stage,score,money(input.estimated_value_minor,'estimated_value_minor'),
          currency(input.currency),cleanText(input.contact_channel,'contact_channel',40),endpoint,
          cleanText(input.next_action,'next_action',1000),isoDate(input.next_action_at,'next_action_at'),actorId(actor)],
      );
      await richAudit(client,actor,'commercial_prospect_created','lead',rows[0].id,{ stage, contact_channel:rows[0].contact_channel, has_endpoint:Boolean(endpoint) });
      await client.query('COMMIT'); return safeRows(rows)[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async updateProspect(id: string, input: Record<string, unknown>, actor: CommercialActor) {
    const allowed = new Set(['pipeline_stage','qualification','qualification_score','estimated_value_minor','product_id','next_action','next_action_at','lost_reason']);
    const entries = Object.entries(input).filter(([key,value]) => allowed.has(key) && value !== undefined);
    if (!entries.length) throw new Error('no_valid_changes');
    const values = entries.map(([key,value]) => {
      if (key === 'pipeline_stage') { if (!stages.has(String(value))) throw new Error('invalid_stage'); return String(value); }
      if (key === 'qualification_score') { const score=money(value,key); if (score !== null && score>100) throw new Error('invalid_qualification_score'); return score; }
      if (key === 'estimated_value_minor') return money(value,key);
      if (key === 'product_id') return optionalUuid(value,key);
      if (key === 'next_action_at') return isoDate(value,key);
      return cleanText(value,key,key === 'qualification' ? 3000 : 1000);
    });
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      values.push(actorId(actor),id);
      const set = entries.map(([key],index) => `${key}=$${index+1}`).join(',');
      const { rows } = await client.query(
        `UPDATE leads SET ${set},updated_by=$${values.length-1},updated_at=now()
         WHERE id=$${values.length} RETURNING *`, values,
      );
      if (!rows[0]) throw new Error('not_found');
      await richAudit(client,actor,'commercial_prospect_updated','lead',id,{ fields:entries.map(([key])=>key) });
      await client.query('COMMIT'); return safeRows(rows)[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async createActivity(input: Record<string, unknown>, actor: CommercialActor) {
    const type = String(input.activity_type ?? 'follow_up'); const status = String(input.status ?? 'scheduled');
    const recurrence = String(input.recurrence ?? 'none');
    if (!activityTypes.has(type)) throw new Error('invalid_activity_type');
    if (!activityStatuses.has(status)) throw new Error('invalid_status');
    if (!recurrences.has(recurrence)) throw new Error('invalid_recurrence');
    const leadId=optionalUuid(input.lead_id,'lead_id'); const customerId=optionalUuid(input.customer_id,'customer_id');
    if (!leadId && !customerId) throw new Error('missing_contact');
    const client=await this.database.connect();
    try {
      await client.query('BEGIN');
      const completedAt=status==='completed' ? new Date().toISOString() : null;
      const { rows }=await client.query(
        `INSERT INTO commercial_activities(lead_id,customer_id,product_id,activity_type,title,detail,status,
          due_at,completed_at,recurrence,parent_activity_id,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
        [leadId,customerId,optionalUuid(input.product_id,'product_id'),type,cleanText(input.title,'title',300,true),
          cleanText(input.detail,'detail',5000),status,isoDate(input.due_at,'due_at'),completedAt,recurrence,
          optionalUuid(input.parent_activity_id,'parent_activity_id'),actorId(actor)],
      );
      await richAudit(client,actor,'commercial_activity_created','commercial_activity',rows[0].id,{ type,status,recurrence });
      await client.query('COMMIT'); return rows[0];
    } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async updateActivity(id: string, input: Record<string, unknown>, actor: CommercialActor) {
    const status=String(input.status ?? '');
    if (!activityStatuses.has(status)) throw new Error('invalid_status');
    const client=await this.database.connect();
    try {
      await client.query('BEGIN');
      const current=await client.query<{ status:string; recurrence:string; lead_id:string|null; customer_id:string|null; product_id:string|null; activity_type:string; title:string; detail:string|null; due_at:Date|null }>(
        'SELECT * FROM commercial_activities WHERE id=$1 FOR UPDATE',[id],
      );
      if (!current.rows[0]) throw new Error('not_found');
      if (current.rows[0].status === status) {
        const child = status === 'completed'
          ? await client.query<{id:string}>('SELECT id FROM commercial_activities WHERE parent_activity_id=$1 ORDER BY created_at ASC LIMIT 1',[id])
          : { rows: [] };
        await client.query('COMMIT');
        return { ...current.rows[0], id, next_activity_id: child.rows[0]?.id ?? null, duplicate: true };
      }
      const completedAt=status==='completed' ? new Date().toISOString() : null;
      const { rows }=await client.query(
        `UPDATE commercial_activities SET status=$2,completed_at=$3,updated_at=now(),updated_by=$4 WHERE id=$1 RETURNING *`,
        [id,status,completedAt,actorId(actor)],
      );
      const activity=current.rows[0];
      let nextActivityId:null|string=null;
      if (status==='completed' && activity.recurrence!=='none') {
        const interval={daily:'1 day',weekly:'1 week',monthly:'1 month',quarterly:'3 months'}[activity.recurrence];
        const next=await client.query<{id:string}>(
          `INSERT INTO commercial_activities(lead_id,customer_id,product_id,activity_type,title,detail,status,due_at,
            recurrence,parent_activity_id,created_by,updated_by)
           VALUES($1,$2,$3,$4,$5,$6,'scheduled',COALESCE($7,now())+$8::interval,$9,$10,$11,$11) RETURNING id`,
          [activity.lead_id,activity.customer_id,activity.product_id,activity.activity_type,activity.title,activity.detail,
            activity.due_at,interval,activity.recurrence,id,actorId(actor)],
        );
        nextActivityId=next.rows[0].id;
      }
      await richAudit(client,actor,'commercial_activity_updated','commercial_activity',id,{ status,next_activity_id:nextActivityId });
      await client.query('COMMIT'); return {...rows[0],next_activity_id:nextActivityId};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async recordMessage(input: Record<string, unknown>, actor: CommercialActor) {
    const direction=String(input.direction ?? ''); const channel=String(input.channel ?? '');
    if (!['outbound','inbound'].includes(direction)) throw new Error('invalid_direction');
    if (!['email','marketplace','community','social','other'].includes(channel)) throw new Error('invalid_channel');
    const leadId=optionalUuid(input.lead_id,'lead_id'); const customerId=optionalUuid(input.customer_id,'customer_id');
    if (!leadId && !customerId) throw new Error('missing_contact');
    const effectId=optionalUuid(input.effect_intent_id,'effect_intent_id');
    const approvalId=optionalUuid(input.approval_id,'approval_id');
    const client=await this.database.connect();
    try {
      await client.query('BEGIN');
      if (direction==='outbound') {
        if (!effectId || !approvalId) throw new Error('effect_linkage_required');
        const effect=await client.query(
          `SELECT id FROM effect_intents WHERE id=$1 AND approval_id=$2 AND effect_kind='message'
           AND state IN ('succeeded','reconciliation_required') FOR SHARE`,[effectId,approvalId],
        );
        if (!effect.rows[0]) throw new Error('executed_message_effect_required');
      }
      const preview=cleanText(input.content_preview,'content_preview',500);
      const safePreview=preview ? redactSecrets(preview,[process.env.OWNER_TOKEN ?? '',process.env.DATABASE_URL ?? '']) : null;
      const {rows}=await client.query(
        `INSERT INTO commercial_messages(lead_id,customer_id,product_id,direction,channel,subject,content_preview,
          provider_reference,effect_intent_id,approval_id,occurred_at,recorded_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,now()),$12) RETURNING *`,
        [leadId,customerId,optionalUuid(input.product_id,'product_id'),direction,channel,
          cleanText(input.subject,'subject',500),safePreview,cleanText(input.provider_reference,'provider_reference',500),
          effectId,approvalId,isoDate(input.occurred_at,'occurred_at'),actorId(actor)],
      );
      await richAudit(client,actor,'commercial_message_recorded','commercial_message',rows[0].id,
        { direction,channel,effect_intent_id:effectId,approval_id:approvalId });
      await client.query('COMMIT'); return rows[0];
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async recordMessageEvent(messageId: string, input: Record<string, unknown>, actor: CommercialActor) {
    const eventType=String(input.event_type ?? '');
    if (!messageEvents.has(eventType)) throw new Error('invalid_event_type');
    const client=await this.database.connect();
    try {
      await client.query('BEGIN');
      const exists=await client.query('SELECT id FROM commercial_messages WHERE id=$1 FOR SHARE',[messageId]);
      if (!exists.rows[0]) throw new Error('not_found');
      const evidence=input.evidence && typeof input.evidence==='object' ? input.evidence : {};
      const {rows}=await client.query(
        `INSERT INTO commercial_message_events(message_id,event_type,provider_event_id,occurred_at,evidence,recorded_by)
         VALUES($1,$2,$3,COALESCE($4,now()),$5,$6)
         ON CONFLICT (provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING RETURNING *`,
        [messageId,eventType,cleanText(input.provider_event_id,'provider_event_id',500),
          isoDate(input.occurred_at,'occurred_at'),JSON.stringify(evidence),actorId(actor)],
      );
      if (rows[0]) await richAudit(client,actor,'commercial_message_event_recorded','commercial_message',messageId,{ event_type:eventType });
      await client.query('COMMIT'); return rows[0] ?? { duplicate:true };
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
