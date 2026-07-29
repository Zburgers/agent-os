#!/usr/bin/env node

/**
 * Read-only opportunity scout.
 *
 * Fetches public n8n Jobs topics and the canonical Agent Bounties opportunity
 * feed. It never logs in, claims work, signs, sends, or writes external state.
 */

const n8nCategory = 'https://community.n8n.io/c/jobs/13.json';
const agentBounties = 'https://api.agentbounties.app/v1/opportunities';
const userAgent = 'goofy-revenue-scout/1.0';

async function json(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': userAgent },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function n8nScore(topic) {
  const text = topic.title.toLowerCase();
  let score = 0;
  if (/\b(hiring|hire|needed|wanted|pay|paid|consultant|freelancer)\b/.test(text)) score += 40;
  if (/\b(debug|stability|reliab|postgres|devops|vps|api|integration)\b/.test(text)) score += 30;
  if (/\bfor hire\b/.test(text)) score -= 70;
  score += Math.max(0, 20 - Math.floor((Date.now() - Date.parse(topic.created_at)) / 86_400_000));
  score -= Math.min(20, Math.max(0, Number(topic.posts_count || 1) - 1));
  return score;
}

function bountyScore(item) {
  const reward = Number(item.reward?.amount || 0) / 10 ** Number(item.reward?.decimals || 6);
  const bond = Number(item.bond?.amount || 0) / 10 ** Number(item.bond?.decimals || 6);
  let score = reward - bond;
  if (item.work_state !== 'claimable') score -= 100;
  if (!item.payment_committed) score -= 100;
  if (!item.terms_valid || !item.verification_ready) score -= 100;
  if (item.standing_meta_bounty) score -= 25;
  return { score, reward, bond };
}

const [n8n, bounties] = await Promise.all([json(n8nCategory), json(agentBounties)]);

const n8nCandidates = n8n.topic_list.topics
  .filter((topic) => topic.id !== 941)
  .map((topic) => ({
    kind: 'explicit_demand',
    score: n8nScore(topic),
    title: topic.title,
    created_at: topic.created_at,
    last_posted_at: topic.last_posted_at,
    replies: Math.max(0, Number(topic.posts_count || 1) - 1),
    url: `https://community.n8n.io/t/${topic.id}`,
  }))
  .filter((item) => item.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 15);

const bountyCandidates = bounties.items
  .map((item) => {
    const economics = bountyScore(item);
    return {
      kind: 'canonical_bounty',
      ...economics,
      title: item.title,
      work_state: item.work_state,
      payment_state: item.payment_state,
      terms_valid: item.terms_valid,
      verification_ready: item.verification_ready,
      standing_meta_bounty: Boolean(item.standing_meta_bounty),
      deadline: item.deadline,
      url: item.public_url,
    };
  })
  .filter((item) => item.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 15);

console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  policy: {
    read_only: true,
    bounty_filter: 'claimable + payment committed + valid terms + verification ready',
    note: 'A candidate is not revenue; re-check exact terms and effect authorization before acting.',
  },
  n8n_candidates: n8nCandidates,
  canonical_bounty_candidates: bountyCandidates,
}, null, 2));
