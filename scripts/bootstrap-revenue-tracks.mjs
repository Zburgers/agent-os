const ROOTS = [
  ['n8n / automation business', ['Product and offer development', 'Buyer research and qualified outreach', 'Sales pipeline and follow-up', 'Delivery and reusable productization']],
  ['Open-source leverage', ['Contributions', 'Maintainer relationships', 'Sponsorship, support, and commercial upgrade opportunities']],
  ['Software contracting', ['Startup and agency opportunity discovery', 'Tailored applications/outreach', 'Owner handoff for interviews or identity-bound work']],
  ['Bounties', ['Discovery and qualification', 'Claiming', 'Building/submitting', 'Verification, payout, and postmortems']],
];
const BOUNTY_HYPOTHESIS = 'An official agent-native bounty API with structured eligibility and artifact submission will produce a faster credible path to first revenue than empty crypto task boards or passive agent directories.';

async function one(database, sql, values = []) { const result = await database.query(sql, values); return result.rows[0] ?? null; }
async function ensureTrack(database, name, parentId) {
  const existing = await one(database, 'SELECT id FROM revenue_tracks WHERE parent_track_id IS NOT DISTINCT FROM $1 AND name=$2', [parentId, name]);
  if (existing) return { id: existing.id, created: false };
  const inserted = await one(database, `INSERT INTO revenue_tracks(parent_track_id,name,owner_kind,status,stage,created_by,updated_by) VALUES($1,$2,'joint','proposed','discovery','bootstrap','bootstrap') RETURNING id`, [parentId, name]);
  return { id: inserted.id, created: true };
}
async function link(database, table, id, trackId, report) {
  const existing = await one(database, `SELECT id,track_id FROM ${table} WHERE id=$1`, [id]);
  if (!existing) return;
  if (existing.track_id && existing.track_id !== trackId) { report.unlinked[table].push(id); return; }
  if (!existing.track_id) { await database.query(`UPDATE ${table} SET track_id=$1,updated_at=now() WHERE id=$2`, [trackId, id]); report.linked[table].push(id); }
}

export async function bootstrapRevenueTracks(database) {
  const report = { created: [], linked: { ventures: [], experiments: [] }, unlinked: { ventures: [], experiments: [] } };
  await database.query('BEGIN');
  try {
    const trackIds = new Map();
    for (const [rootName, children] of ROOTS) {
      const root = await ensureTrack(database, rootName, null); trackIds.set(rootName, root.id); if (root.created) report.created.push(root.id);
      for (const childName of children) { const child = await ensureTrack(database, childName, root.id); if (child.created) report.created.push(child.id); }
    }
    const automation = await one(database, `SELECT id,track_id FROM ventures WHERE name='Automation Reliability Sprint'`);
    if (automation) await link(database, 'ventures', automation.id, trackIds.get('n8n / automation business'), report);
    const bounty = await one(database, `SELECT id,track_id FROM experiments WHERE hypothesis=$1`, [BOUNTY_HYPOTHESIS]);
    if (bounty) await link(database, 'experiments', bounty.id, trackIds.get('Bounties'), report);
    if (report.created.length || report.linked.ventures.length || report.linked.experiments.length) await database.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', ['system', 'bootstrap', 'revenue_tracks_bootstrapped', 'revenue_tracks', null, JSON.stringify(report)]);
    await database.query('COMMIT');
    return report;
  } catch (error) { await database.query('ROLLBACK'); throw error; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { pool } = await import('../src/db.ts');
  const report = await bootstrapRevenueTracks(pool);
  console.log(JSON.stringify(report));
  await pool.end();
}
