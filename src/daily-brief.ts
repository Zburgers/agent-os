import type { Pool } from 'pg';

type Database = Pick<Pool, 'query'>;

type Prospect = {
  display_name: string | null;
  organization: string | null;
  source: string;
  pipeline_stage: string;
  qualification: string;
  qualification_score: number | null;
  estimated_value_minor: string | null;
  currency: string | null;
  next_action: string | null;
  next_action_at: string | null;
};

type WorkItem = {
  title: string;
  status: string;
  priority: number;
  completion_evidence: string | null;
};

type Experiment = {
  hypothesis: string;
  status: string;
  actual_result: string | null;
  lesson: string | null;
  follow_up_decision: string | null;
};

export type DailyBriefData = {
  generatedAt: string;
  controls: { paused: boolean; killed: boolean; commercial_lock: boolean };
  financial: {
    contributions: string;
    expenses: string;
    revenue: string;
    refunds: string;
    fees: string;
    realized_net_profit_minor: string;
  };
  metrics: {
    leads: number;
    customers: number;
    sent: number;
    replied: number;
    products: number;
    activeTasks: number;
    incidents: number;
    todayEvents: number;
  };
  objective: string;
  product: { name: string; description: string; price_minor: string | null; currency: string | null } | null;
  prospects: Prospect[];
  work: WorkItem[];
  experiments: Experiment[];
  dueActivities: Array<{ title: string; due_at: string | null; display_name: string | null }>;
  cryptoEvidence: string;
};

export async function buildDailyBriefData(database: Database): Promise<DailyBriefData> {
  const [
    control,
    financial,
    metrics,
    objective,
    product,
    prospects,
    work,
    experiments,
    dueActivities,
    cryptoTask,
  ] = await Promise.all([
    database.query(`SELECT paused,killed,commercial_lock FROM system_controls LIMIT 1`),
    database.query(`SELECT
      COALESCE(SUM(net_minor) FILTER (WHERE entry_type='contribution'),0)::text AS contributions,
      COALESCE(SUM(net_minor) FILTER (WHERE entry_type='expense' AND payment_status='settled'),0)::text AS expenses,
      COALESCE(SUM(net_minor) FILTER (WHERE entry_type='revenue' AND payment_status='settled'),0)::text AS revenue,
      COALESCE(SUM(net_minor) FILTER (WHERE entry_type='refund' AND payment_status='settled'),0)::text AS refunds,
      COALESCE(SUM(fees_minor) FILTER (WHERE payment_status='settled'),0)::text AS fees
      FROM ledger_entries WHERE currency='INR'`),
    database.query(`SELECT
      (SELECT count(*)::int FROM leads) AS leads,
      (SELECT count(*)::int FROM customers) AS customers,
      (SELECT count(*)::int FROM commercial_messages WHERE direction='outbound') AS sent,
      (SELECT count(*)::int FROM commercial_message_events WHERE event_type='replied') AS replied,
      (SELECT count(*)::int FROM commercial_products WHERE status='active') AS products,
      (SELECT count(*)::int FROM tasks WHERE status IN ('in_progress','ready','blocked','waiting_for_owner','validation')) AS active_tasks,
      (SELECT count(*)::int FROM incidents WHERE status='open') AS incidents,
      (SELECT count(*)::int FROM audit_events
        WHERE occurred_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS today_events`),
    database.query(`SELECT statement FROM objectives WHERE status='active' ORDER BY created_at DESC LIMIT 1`),
    database.query(`SELECT name,description,price_minor::text,currency
      FROM commercial_products WHERE status='active' ORDER BY updated_at DESC LIMIT 1`),
    database.query<Prospect>(`SELECT
      display_name,organization,source,pipeline_stage,qualification,qualification_score,
      estimated_value_minor::text,currency,next_action,next_action_at::text
      FROM leads
      WHERE pipeline_stage NOT IN ('lost','disqualified')
      ORDER BY qualification_score DESC NULLS LAST,updated_at DESC LIMIT 8`),
    database.query<WorkItem>(`SELECT title,status,priority,completion_evidence
      FROM tasks WHERE status IN ('in_progress','ready','blocked','waiting_for_owner','validation')
      ORDER BY priority DESC,updated_at DESC LIMIT 6`),
    database.query<Experiment>(`SELECT hypothesis,status,actual_result,lesson,follow_up_decision
      FROM experiments ORDER BY updated_at DESC,created_at DESC LIMIT 5`),
    database.query<{ title: string; due_at: string | null; display_name: string | null }>(`SELECT
      a.title,a.due_at::text,l.display_name
      FROM commercial_activities a
      LEFT JOIN leads l ON l.id=a.lead_id
      WHERE a.status IN ('scheduled','due')
      ORDER BY a.due_at ASC NULLS LAST LIMIT 6`),
    database.query<{ completion_evidence: string | null }>(`SELECT completion_evidence
      FROM tasks WHERE title ILIKE '%PoolTogether%' ORDER BY updated_at DESC LIMIT 1`),
  ]);

  const f = financial.rows[0] ?? { contributions: '0', expenses: '0', revenue: '0', refunds: '0', fees: '0' };
  const realized = BigInt(f.revenue) - BigInt(f.refunds) - BigInt(f.fees) - BigInt(f.expenses);
  const m = metrics.rows[0] ?? {};

  return {
    generatedAt: new Date().toISOString(),
    controls: control.rows[0] ?? { paused: true, killed: false, commercial_lock: true },
    financial: { ...f, realized_net_profit_minor: realized.toString() },
    metrics: {
      leads: Number(m.leads ?? 0),
      customers: Number(m.customers ?? 0),
      sent: Number(m.sent ?? 0),
      replied: Number(m.replied ?? 0),
      products: Number(m.products ?? 0),
      activeTasks: Number(m.active_tasks ?? 0),
      incidents: Number(m.incidents ?? 0),
      todayEvents: Number(m.today_events ?? 0),
    },
    objective: objective.rows[0]?.statement ?? 'Select and execute the highest-value lawful path to first revenue.',
    product: product.rows[0] ?? null,
    prospects: prospects.rows,
    work: work.rows,
    experiments: experiments.rows,
    dueActivities: dueActivities.rows,
    cryptoEvidence: cryptoTask.rows[0]?.completion_evidence ?? 'No verified positive-net crypto opportunity is recorded.',
  };
}

function safe(value: unknown) {
  return String(value ?? '')
    .replace(/[—–]/g, '-')
    .replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]!));
}

function money(value: string | number | null | undefined, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0) / 100);
}

function shortDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(data: DailyBriefData) {
  if (data.controls.killed) return 'Stopped';
  if (data.controls.paused) return 'Paused';
  if (data.controls.commercial_lock) return 'Internal only';
  return 'Operating';
}

function prospectCards(data: DailyBriefData) {
  if (!data.prospects.length) return '<p class="empty">No qualified prospects are recorded.</p>';
  return data.prospects.map((prospect, index) => {
    const name = prospect.organization || prospect.display_name || 'Qualified buyer';
    const value = prospect.estimated_value_minor
      ? money(prospect.estimated_value_minor, prospect.currency || 'INR')
      : 'Value not estimated';
    return `<article class="prospect ${index === 0 ? 'prospect-lead' : ''}">
      <div class="prospect-index">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <h3>${safe(name)}</h3>
        <p>${safe(prospect.qualification)}</p>
        <div class="prospect-meta"><span>${safe(prospect.pipeline_stage)}</span><span>${safe(value)}</span></div>
      </div>
    </article>`;
  }).join('');
}

function workRows(data: DailyBriefData) {
  if (!data.work.length) return '<p class="empty">No active work remains.</p>';
  return data.work.map(item => `<article class="work-row">
    <div><h3>${safe(item.title)}</h3><p>${safe(item.completion_evidence || 'Evidence will be recorded at the next checkpoint.')}</p></div>
    <span class="state">${safe(item.status)}</span>
  </article>`).join('');
}

function tomorrowRows(data: DailyBriefData) {
  const rows = data.dueActivities.slice(0, 4).map(activity => `<article>
    <strong>${safe(activity.title)}</strong>
    <span>${safe(activity.display_name || 'Commercial pipeline')} / ${safe(shortDate(activity.due_at))}</span>
  </article>`).join('');
  return rows || `<article><strong>Review the buyer inbox</strong><span>Classify replies and move any genuine buyer into proposal.</span></article>`;
}

export function renderDailyBrief(data: DailyBriefData) {
  const reportDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'long',
  }).format(new Date(data.generatedAt));
  const productName = data.product?.name ?? 'Automation Reliability Sprint';
  const productPrice = data.product?.price_minor
    ? money(data.product.price_minor, data.product.currency || 'USD')
    : '$99 pilot';
  const systemState = statusLabel(data);
  const walletPosition = data.cryptoEvidence.includes('actionable profit remains 0')
    ? 'Keep wallet capital at zero'
    : 'Continue signer-free observation';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Daily Owner Brief | Goofy Agent OS</title>
  <style>
    :root{
      color-scheme:light dark;
      --bg:#eef0ed;--surface:#f8f9f6;--ink:#171c19;--muted:#5e6862;--line:#cbd1cc;
      --accent:#147a55;--accent-ink:#eafff5;--soft:#dfe7e1;--radius:16px;
      --display:"Avenir Next","Segoe UI",ui-sans-serif,system-ui,sans-serif;
      --mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;
    }
    @media(prefers-color-scheme:dark){
      :root{--bg:#111613;--surface:#171e1a;--ink:#edf3ef;--muted:#a7b2ab;--line:#34413a;--accent:#66c79c;--accent-ink:#092417;--soft:#202b25}
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--display);line-height:1.45}
    button,a{font:inherit}
    a{color:inherit}
    button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
    .deck-nav{position:fixed;z-index:10;inset:18px 22px auto;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:10px 12px 10px 18px;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);border-radius:var(--radius);background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(18px)}
    .deck-nav strong{font-size:13px;letter-spacing:-.01em}
    .deck-nav span{color:var(--muted);font:11px var(--mono)}
    .nav-actions{display:flex;gap:8px}
    .nav-actions button,.nav-actions a{min-height:36px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);text-decoration:none;cursor:pointer;white-space:nowrap}
    .nav-actions button:active,.nav-actions a:active{transform:translateY(1px)}
    .slide{min-height:100dvh;display:grid;align-items:center;padding:104px max(24px,5vw) 56px}
    .slide-inner{width:min(1320px,100%);margin:auto}
    .hero{padding:0;background:#111613;color:#f1f5f2}
    .hero-grid{display:grid;grid-template-columns:minmax(0,.88fr) minmax(460px,1.12fr);min-height:100dvh}
    .hero-copy{align-self:center;padding:112px 7vw 68px max(28px,7vw)}
    .eyebrow{margin:0 0 24px;color:#72cca4;font:700 11px var(--mono);letter-spacing:.15em;text-transform:uppercase}
    h1,h2,h3,p{margin-top:0}
    h1{max-width:760px;margin-bottom:22px;font-size:clamp(46px,4.8vw,78px);line-height:.94;letter-spacing:-.06em}
    .headline-line{display:block;white-space:nowrap}
    .headline-accent{color:#72cca4}
    .hero-copy>p:not(.eyebrow){max-width:480px;margin-bottom:30px;color:#bdc8c1;font-size:clamp(17px,1.5vw,22px)}
    .hero-actions{display:flex;flex-wrap:wrap;gap:10px}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 17px;border:1px solid #4d5b53;border-radius:12px;color:#f1f5f2;text-decoration:none;background:transparent;cursor:pointer;white-space:nowrap}
    .button-primary{border-color:#72cca4;background:#72cca4;color:#0d271b;font-weight:750}
    .hero-media{min-width:0}
    .hero-media img{width:100%;height:100%;min-height:100dvh;object-fit:cover;object-position:center}
    .section-title{max-width:800px;margin-bottom:44px;font-size:clamp(38px,5vw,76px);line-height:.96;letter-spacing:-.06em}
    .section-intro{max-width:680px;margin:-24px 0 42px;color:var(--muted);font-size:18px}
    .score-grid{display:grid;grid-template-columns:1.45fr .85fr .7fr;grid-template-rows:auto auto;gap:14px}
    .score{min-height:190px;padding:26px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
    .score-main{grid-row:span 2;display:flex;flex-direction:column;justify-content:space-between;min-height:394px;background:var(--accent);color:var(--accent-ink);border-color:transparent}
    .score-wide{grid-column:span 2;background:linear-gradient(135deg,var(--surface),var(--soft))}
    .score label{display:block;color:var(--muted);font:11px var(--mono);text-transform:uppercase;letter-spacing:.1em}
    .score-main label{color:color-mix(in srgb,var(--accent-ink) 72%,transparent)}
    .score strong{display:block;margin-top:20px;font-size:clamp(34px,4vw,66px);line-height:1;letter-spacing:-.06em}
    .score-main strong{font-size:clamp(68px,9vw,144px)}
    .score p{margin:12px 0 0;color:var(--muted)}
    .score-main p{color:color-mix(in srgb,var(--accent-ink) 78%,transparent)}
    .evidence-layout{display:grid;grid-template-columns:minmax(360px,.9fr) minmax(0,1.1fr);gap:5vw;align-items:center}
    .evidence-layout img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:var(--radius)}
    .evidence-list{display:grid;gap:0}
    .evidence-list article{padding:22px 0;border-bottom:1px solid var(--line)}
    .evidence-list article:last-child{border-bottom:0}
    .evidence-list strong{display:block;font-size:22px;letter-spacing:-.03em}
    .evidence-list span{display:block;margin-top:7px;color:var(--muted)}
    .offer-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}
    .offer-main,.offer-side{padding:34px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
    .offer-main strong{display:block;max-width:720px;font-size:clamp(42px,6vw,88px);line-height:.96;letter-spacing:-.06em}
    .offer-main p{max-width:620px;margin:24px 0 0;color:var(--muted);font-size:18px}
    .offer-side{display:flex;flex-direction:column;justify-content:space-between;background:var(--soft)}
    .offer-side label{color:var(--muted);font:11px var(--mono);text-transform:uppercase;letter-spacing:.1em}
    .offer-side strong{font-size:clamp(44px,5vw,72px);letter-spacing:-.06em}
    .prospect-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}
    .prospect{display:grid;grid-template-columns:46px minmax(0,1fr);gap:18px;padding:24px 0;border-bottom:1px solid var(--line)}
    .prospect-index{color:var(--accent);font:12px var(--mono)}
    .prospect h3{margin-bottom:7px;font-size:23px;letter-spacing:-.03em}
    .prospect p{margin-bottom:12px;color:var(--muted)}
    .prospect-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;color:var(--muted);font:11px var(--mono);text-transform:uppercase}
    .prospect-lead{grid-column:span 2;padding:30px;border:1px solid var(--accent);border-radius:var(--radius);margin-bottom:20px;background:color-mix(in srgb,var(--accent) 8%,var(--surface))}
    .work-list{display:grid;gap:0}
    .work-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;padding:25px 0;border-bottom:1px solid var(--line)}
    .work-row h3{margin-bottom:8px;font-size:24px;letter-spacing:-.03em}
    .work-row p{max-width:860px;margin-bottom:0;color:var(--muted)}
    .state{align-self:start;padding:6px 9px;border:1px solid var(--line);border-radius:9px;color:var(--muted);font:11px var(--mono);text-transform:uppercase}
    .crypto-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}
    .crypto-case,.crypto-rule{min-height:370px;padding:36px;border-radius:var(--radius)}
    .crypto-case{border:1px solid var(--line);background:var(--surface)}
    .crypto-rule{display:flex;flex-direction:column;justify-content:space-between;background:#17241d;color:#edf8f1}
    .crypto-case strong,.crypto-rule strong{display:block;font-size:clamp(40px,5vw,76px);line-height:.98;letter-spacing:-.06em}
    .crypto-case p,.crypto-rule p{margin-top:24px;color:var(--muted);font-size:17px}
    .crypto-rule p{color:#b8c9bf}
    .tomorrow-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:5vw}
    .tomorrow-priority{padding:32px;border-radius:var(--radius);background:var(--accent);color:var(--accent-ink)}
    .tomorrow-priority span{display:block;font:11px var(--mono);text-transform:uppercase;letter-spacing:.1em}
    .tomorrow-priority strong{display:block;margin-top:48px;font-size:clamp(40px,5vw,74px);line-height:.97;letter-spacing:-.06em}
    .tomorrow-list article{padding:20px 0;border-bottom:1px solid var(--line)}
    .tomorrow-list strong{display:block;font-size:20px}
    .tomorrow-list span{display:block;margin-top:5px;color:var(--muted)}
    .owner-action{background:#111613;color:#eef4f0}
    .owner-action .slide-inner{display:grid;grid-template-columns:1.05fr .95fr;gap:8vw;align-items:end}
    .owner-action h2{margin:0;font-size:clamp(48px,7vw,108px);line-height:.92;letter-spacing:-.07em}
    .owner-action h2 span{color:#72cca4}
    .owner-copy{padding-bottom:10px}
    .owner-copy strong{display:block;font-size:26px;letter-spacing:-.03em}
    .owner-copy p{margin:14px 0 26px;color:#b7c3bb;font-size:18px}
    .owner-copy .button{width:max-content}
    .empty{color:var(--muted)}
    .footer-note{margin-top:32px;color:#87938b;font:11px var(--mono)}
    @media(max-width:880px){
      .deck-nav{inset:10px}.deck-nav>div:first-child span{display:none}
      .nav-actions a{display:none}
      .slide{padding:88px 18px 42px}
      .hero-grid,.evidence-layout,.offer-grid,.crypto-grid,.tomorrow-grid,.owner-action .slide-inner{grid-template-columns:1fr}
      .hero-copy{padding:110px 24px 50px}.hero-media img{min-height:42dvh;max-height:52dvh}
      .score-grid{grid-template-columns:1fr 1fr}.score-main{grid-column:span 2;grid-row:auto;min-height:280px}.score-wide{grid-column:span 2}
      .prospect-grid{grid-template-columns:1fr}.prospect-lead{grid-column:auto}
      .owner-action .slide-inner{align-items:center}.owner-action h2{margin-bottom:38px}
    }
    @media(max-width:560px){
      .deck-nav strong{font-size:12px}.nav-actions button{padding:7px 9px}
      .hero-grid{display:block}.hero-media img{min-height:36dvh}
      .headline-line{white-space:normal}
      .score-grid{display:grid;grid-template-columns:1fr}.score-main,.score-wide{grid-column:auto}
      .prospect{grid-template-columns:34px minmax(0,1fr)}.work-row{grid-template-columns:1fr}.state{justify-self:start}
    }
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
    @media print{
      @page{size:landscape;margin:0}
      .deck-nav{display:none}.slide{min-height:100vh;page-break-after:always;padding:48px}
      .hero-grid{min-height:100vh}.hero-media img{min-height:100vh}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  </style>
</head>
<body>
  <nav class="deck-nav" aria-label="Deck controls">
    <div><strong>Goofy Agent OS</strong><span> / Daily owner brief / ${safe(reportDate)}</span></div>
    <div class="nav-actions"><a href="/">Dashboard</a><button id="printDeck" type="button">Print deck</button></div>
  </nav>

  <main>
    <section class="slide hero" aria-labelledby="cover-title">
      <div class="hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Autonomous revenue operations</p>
          <h1 id="cover-title"><span class="headline-line">Build revenue.</span><span class="headline-line headline-accent">Keep control.</span></h1>
          <p>A factual daily brief for capital, experiments, buyers, risks, and the next move.</p>
          <div class="hero-actions"><button class="button button-primary" id="printDeckHero" type="button">Print deck</button><a class="button" href="/commercial">Open pipeline</a></div>
        </div>
        <div class="hero-media"><img src="/assets/daily-brief-hero.png" alt="Operational ledger, secured laptop, notebook, and hardware key on a charcoal desk"></div>
      </div>
    </section>

    <section class="slide" aria-labelledby="score-title">
      <div class="slide-inner">
        <h2 class="section-title" id="score-title">The honest scoreboard</h2>
        <div class="score-grid">
          <article class="score score-main"><label>Settled revenue</label><strong>${safe(money(data.financial.revenue))}</strong><p>Pipeline and promises do not count as money earned.</p></article>
          <article class="score"><label>Qualified prospects</label><strong>${data.metrics.leads}</strong><p>${data.metrics.sent} provider-accepted outbound messages are recorded.</p></article>
          <article class="score"><label>Buyer replies</label><strong>${data.metrics.replied}</strong><p>No reply is treated as demand until it exists.</p></article>
          <article class="score score-wide"><label>Realized net result</label><strong>${safe(money(data.financial.realized_net_profit_minor))}</strong><p>${safe(systemState)}. ${data.metrics.incidents} open incidents and ${data.metrics.activeTasks} active work items.</p></article>
        </div>
      </div>
    </section>

    <section class="slide" aria-labelledby="built-title">
      <div class="slide-inner evidence-layout">
        <img src="/assets/daily-brief-research.png" alt="Printed workflow diagrams inspected with a magnifying glass beside computing hardware">
        <div>
          <h2 class="section-title" id="built-title">What is now real</h2>
          <div class="evidence-list">
            <article><strong>Production-ready Agent OS</strong><span>PostgreSQL ledger, approvals, effects, audit history, restart recovery, health checks, Telegram controls, and a kill switch.</span></article>
            <article><strong>Commercial operations console</strong><span>Products, prospects, messages, follow-ups, buyers, customers, recurring work, invoices, and payments share one durable record.</span></article>
            <article><strong>Guarded acquisition system</strong><span>Low-volume buyer outreach is effect-authorized, idempotent, and logged. Failed or ambiguous sends do not replay blindly.</span></article>
            <article><strong>Signer-free crypto observer</strong><span>PoolTogether Base economics are measured without a wallet, private key, gas spend, or speculative position.</span></article>
          </div>
        </div>
      </div>
    </section>

    <section class="slide" aria-labelledby="offer-title">
      <div class="slide-inner">
        <h2 class="section-title" id="offer-title">A narrow offer can close faster</h2>
        <div class="offer-grid">
          <article class="offer-main"><strong>${safe(productName)}</strong><p>${safe(data.product?.description || 'Repair one unreliable n8n, API, or AI workflow. Add safe retries, duplicate protection, useful logs, an acceptance test, and a handoff runbook.')}</p></article>
          <article class="offer-side"><label>Entry offer</label><strong>${safe(productPrice)}</strong><p>One bounded problem, clear evidence, no open-ended transformation promise.</p></article>
        </div>
      </div>
    </section>

    <section class="slide" aria-labelledby="pipeline-title">
      <div class="slide-inner">
        <h2 class="section-title" id="pipeline-title">The current buyer pipeline</h2>
        <p class="section-intro">These are qualified public buyers, not purchased lists or scraped vanity leads.</p>
        <div class="prospect-grid">${prospectCards(data)}</div>
      </div>
    </section>

    <section class="slide" aria-labelledby="work-title">
      <div class="slide-inner">
        <h2 class="section-title" id="work-title">Evidence before optimism</h2>
        <div class="work-list">${workRows(data)}</div>
      </div>
    </section>

    <section class="slide" aria-labelledby="crypto-title">
      <div class="slide-inner">
        <h2 class="section-title" id="crypto-title">Crypto is an execution lane, not a casino</h2>
        <div class="crypto-grid">
          <article class="crypto-case"><strong>0 profitable claims observed</strong><p>${safe(data.cryptoEvidence)}</p></article>
          <article class="crypto-rule"><span>Capital rule</span><strong>${safe(walletPosition)}</strong><p>Create or fund a wallet only after repeated, conservative evidence shows expected reward exceeds gas and failure risk.</p></article>
        </div>
      </div>
    </section>

    <section class="slide" aria-labelledby="tomorrow-title">
      <div class="slide-inner">
        <h2 class="section-title" id="tomorrow-title">Tomorrow is about conversion</h2>
        <div class="tomorrow-grid">
          <article class="tomorrow-priority"><span>Primary objective</span><strong>${safe(data.objective)}</strong></article>
          <div class="tomorrow-list">${tomorrowRows(data)}
            <article><strong>Expand only the qualified buyer set</strong><span>Continue toward the 20-contact limit with truthful, tailored messages to explicit buyers.</span></article>
            <article><strong>Advance payment readiness</strong><span>Prepare one compliant payment-link provider after owner KYC so a buyer can pay without delay.</span></article>
          </div>
        </div>
      </div>
    </section>

    <section class="slide owner-action" aria-labelledby="owner-title">
      <div class="slide-inner">
        <h2 id="owner-title">One owner action.<br><span>Payment readiness.</span></h2>
        <div class="owner-copy">
          <strong>Activate one Razorpay account tomorrow.</strong>
          <p>The owner completes KYC, bank linkage, OTPs, and agreements. Goofy can then integrate fixed payment links, verified webhooks, and reconciliation.</p>
          <a class="button button-primary" href="/approvals">View owner actions</a>
          <p class="footer-note">Generated ${safe(reportDate)} from PostgreSQL-backed Agent OS state. No synthetic traction.</p>
        </div>
      </div>
    </section>
  </main>
  <script>
    const printDeck = () => window.print();
    document.getElementById('printDeck').addEventListener('click', printDeck);
    document.getElementById('printDeckHero').addEventListener('click', printDeck);
    document.addEventListener('keydown', event => {
      if (!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key)) return;
      const slides = [...document.querySelectorAll('.slide')];
      const current = slides.reduce((best, slide, index) =>
        Math.abs(slide.getBoundingClientRect().top) < Math.abs(slides[best].getBoundingClientRect().top) ? index : best, 0);
      const direction = ['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1;
      slides[Math.max(0, Math.min(slides.length - 1, current + direction))].scrollIntoView({ behavior:'smooth' });
    });
  </script>
</body>
</html>`;
}
