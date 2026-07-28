# Autonomous Revenue Opportunity Ledger

**Research date:** 2026-07-29  
**Operator:** Goofy  
**Status:** Decision-ready research; no spending, outreach, account creation, contract acceptance, or onchain transaction performed  
**Governing controls:** `AUTONOMOUS_REVENUE_MISSION.md`

## Executive decision

The highest-probability route to first revenue is a narrow, productized engineering
service:

> **Automation Reliability Sprint** — repair one broken n8n/API/AI workflow and add
> retries, idempotency, logging, alerts, and handoff documentation within 48 hours.

Proposed initial pricing:

- Pilot: **$99** for one bounded workflow and a written reliability report.
- Standard: **$249** for one workflow, tests, observability, and 7-day defect support.
- Expansion: **$499+** for a small automation system after a successful sprint.

This is the lead experiment because current buyers demonstrably pay for n8n and API
automation work, the work fits the existing technical assets, delivery can be
automated heavily, and no inventory or trading capital is needed.

The best crypto-adjacent opportunity is **building useful software on Base and
competing for builder rewards or retroactive grants**. The best near-zero-cost
crypto experiment is a **read-only PoolTogether keeper profitability monitor**.
Actual keeper transactions must wait until the control plane is production-ready
and historical simulations show positive net returns after gas and failed-race
costs.

Agent marketplaces, x402 endpoints, and open-source bounties should be maintained as
cheap secondary distribution channels. Their currently observable buyer demand is
too weak or unreliable to be the primary plan.

## Scoring method

Scores are 1–5. “Control fit” rewards opportunities that do not need custody,
identity misrepresentation, speculative capital, or irreversible external action.
The weighted score is:

`30% demand + 20% speed + 20% margin + 15% autonomy + 15% control fit`

| Rank | Opportunity | Demand | Speed | Margin | Autonomy | Control fit | Weighted | Decision |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Automation Reliability Sprint | 5 | 4 | 5 | 4 | 5 | **4.65** | Lead experiment |
| 2 | Base app/tool eligible for builder rewards | 3 | 3 | 5 | 4 | 4 | **3.75** | Crypto build track |
| 3 | Strictly filtered OSS bounties | 3 | 4 | 4 | 4 | 4 | **3.70** | Opportunistic |
| 4 | Existing desktop app paid support/pro version | 2 | 3 | 5 | 5 | 5 | **3.65** | Validate, then package |
| 5 | x402 paid micro-API | 2 | 4 | 4 | 5 | 4 | **3.45** | Cheap distribution test |
| 6 | PoolTogether keeper/claimer | 2 | 3 | 3 | 5 | 2 | **2.90** | Monitor first; no capital |
| 7 | Conventional freelance marketplaces | 4 | 3 | 4 | 1 | 2 | **2.95** | Poor autonomy fit |
| 8 | Agent-native task marketplaces | 1 | 3 | 4 | 5 | 4 | **2.80** | Watch, do not prioritize |
| 9 | Newsletter/content/stock assets | 2 | 1 | 4 | 5 | 5 | **3.05** | Too slow for first cash |
| 10 | Trading/arbitrage/yield farming | 2 | 2 | 2 | 5 | 1 | **2.30** | Rejected |

Scores are directional business judgments, not financial forecasts.

## Evidence: service demand

Current public Upwork listings show real demand for n8n, Python, CRM, API, and AI
automation work. Examples observed on 2026-07-29 included an automation role at
$30–$60/hour with more than 50 proposals and other roles asking for production
documentation, error handling, and integrations:

- <https://www.upwork.com/freelance-jobs/apply/Automation-Expert_~021935718855493489143/>
- <https://www.upwork.com/freelance-jobs/apply/Automation-and-Solutions-Specialist_~022012335592703174189/>
- <https://www.upwork.com/freelance-jobs/apply/Experienced-Developer-Needed-for-Automations-CRM-Integrations-Python-n8n-Make_~022009392044270749934/>

The proposal volume means “generic automation expert” is crowded. The offer must
therefore sell an outcome—repairing a failing workflow with reliability controls—
rather than hours or vague AI expertise.

Upwork itself is unsuitable for unattended agent operation. It requires identity
verification and says only the account owner may use the account. Connects cost
$0.15 and freelancer fees vary by contract:

- <https://support.upwork.com/hc/en-us/articles/360001176427-How-to-verify-your-identity-as-a-freelancer>
- <https://support.upwork.com/hc/en-us/articles/9127142196243-How-to-represent-yourself-authentically-on-Upwork>
- <https://support.upwork.com/hc/en-us/articles/211062538-Learn-about-the-Freelancer-Service-Fee>
- <https://support.upwork.com/hc/en-us/articles/211062898-Understanding-and-using-Connects>

Fiverr permits responsible AI-assisted delivery, but phone/payment verification and
authentic account operation still introduce a human identity dependency. Sellers
receive 80% of order value:

- <https://help.fiverr.com/hc/en-us/articles/37554976380177-Using-AI-on-Fiverr-Guidelines-for-freelancers-and-clients>
- <https://help.fiverr.com/hc/en-us/articles/9234443621137-Your-earnings-page>
- <https://help.fiverr.com/hc/en-us/articles/360010140357-Phone-verifying-your-account>

**Inference:** marketplace listings validate demand, but direct acquisition or a
more automation-friendly channel should be used after the outbound gate opens.

## Existing asset audit

The authenticated GitHub account has 51 public repositories, but no examined asset
has meaningful organic distribution yet.

| Asset | Evidence | Commercial interpretation |
|---|---|---|
| `mdview` | 13 releases; 33 non-signature installer downloads; 7 updater-manifest downloads; all open issues authored by the owner | A real packaged app, but not validated demand |
| `vibevoice` | 8 releases; 7 non-signature installer downloads; 6 updater-manifest downloads; all examined open issues authored by the owner | Useful portfolio proof; insufficient demand for a paid pivot |
| `Datawizrd` | No releases or open issues; 1 star | Portfolio component, not a current product |
| `AutoQuoter` | No releases or issues; 0 stars | Prototype only |
| `content-extractor` | No releases or issues; 0 stars | Possible portfolio component |
| `n8nmagic` | Empty | No commercial value yet |

The release download totals include possible CI, owner, and automated-update traffic,
so they are upper bounds on real users. Do not spend a week adding payment features
to these apps without a demand signal.

## Crypto opportunity ledger

### C1 — Base builder rewards and grants

**Verdict: pursue as the primary crypto track, after the service experiment is
packaged.**

Base’s official documentation advertises app verification, competitions, partner
rewards, up to 2 ETH weekly through the linked Builder Rewards program, and
retroactive grants of roughly 1–5 ETH:

- <https://docs.base.org/apps/growth/rewards>
- <https://docs.base.org/get-started/base>

The 2026 Base Batches application windows have already closed, so that program is
not an immediate lead. Its accepted cohort also shows heavy competition in agents,
x402, credit, and trading:

- <https://batches.base.org/>

Best concept direction: a public-good-grade monitoring product that overlaps our
service capabilities—for example, an open Base transaction/webhook reliability
monitor with a paid hosted tier. It could produce three shots on goal from one
codebase: service portfolio proof, subscription revenue, and ecosystem rewards.

Before building, verify the current Builder Rewards eligibility, verification
requirements, geographic eligibility, wallet requirements, judging criteria, and
whether reward activity creates tax or reporting obligations.

### C2 — PoolTogether prize claimer/operator

**Verdict: build a read-only economics monitor; do not fund a live bot yet.**

PoolTogether explicitly allows anyone to claim prizes for winners and receive a
portion of the prize. Rewards rise through a VRGDA, while bots compete to submit
only when expected rewards exceed gas:

- <https://dev.pooltogether.com/protocol/design/prize-claimer/>
- <https://dev.pooltogether.com/protocol/guides/bots/>
- <https://dev.pooltogether.com/protocol/guides/bots/claiming-prizes/>

The current Base deployment identifies the active `Claimer`, `PrizePool`,
`DrawManager`, and liquidation contracts:

- <https://dev.pooltogether.com/protocol/deployments/base/>

Open-source implementations warn that transactions can lose money and require a
funded wallet, private key, and RPC. Some liquidator paths also require prize-token
working capital:

- <https://github.com/underethsea/pooltogether-node>
- <https://github.com/GenerationSoftware/pt-v5-liquidator-gh-action-bot>

Required dry-run measurements:

1. Enumerate historical Base claim transactions and their fee recipients.
2. Calculate reward received, gas paid, ETH/USD at execution, and net USD profit.
3. Measure winner-take-rate concentration by claimer address.
4. Estimate failed and superseded transaction costs, not only successful claims.
5. Simulate trigger thresholds using real RPC latency and current gas.
6. Require a positive lower confidence bound after infrastructure cost.

Initial read-only chain measurement completed after this ranking:

- A seven-day window contained 7,439 `ClaimedPrize` events in 302 successful
  transactions across 10 reward recipients.
- Rewards totaled `0.016834144916464869 WETH`; successful transaction gas including
  Base L1 fees totaled `0.007633549762463427 ETH`.
- Because Base WETH is redeemable 1:1 for ETH, the successful-only gross spread was
  `0.009200595154001442 ETH` across all observed operators.
- The top three recipients captured 83.91% of rewards.
- After allocating successful gas by transaction, the top recipient's seven-day
  successful-only spread was `0.00636655 ETH`; one recipient was negative
  `0.00241312 ETH` even before failed-race costs. At the contemporaneous
  `$1,624.95/ETH` quote, the top result was only about `$10.35` for the week.

This confirms a functioning market but not an attractive entry. The result omits
failed/superseded races and overhead and is shared across existing operators.

No live wallet should be funded until this evidence exists and an approved spending
envelope explicitly covers gas and loss limits.

### C3 — x402 paid API

**Verdict: cheap experiment, not a business thesis.**

Coinbase’s x402 Bazaar provides a public discovery catalog and seller quickstart:

- <https://docs.cdp.coinbase.com/x402/bazaar>
- <https://docs.cdp.coinbase.com/x402/quickstart-for-sellers>

On 2026-07-29 its public discovery endpoint reported 14,898 resources. An analysis
of the newest 1,000 records found heavy supplier repetition and no public call or
buyer-volume evidence. Base was the most common accepted network, but listing count
measures supply, not demand.

Tollbooth offered the clearest observable demand proxy: 103 services, 7 verified,
only 4 calls, and $0.080 settled at the time checked:

- <https://www.trytollbooth.com/>

Experiment only after readiness: expose one useful, low-cost endpoint derived from a
tool already built for the service business; cap compute cost; stop if there are no
paid calls after a fixed listing period.

### C4 — Other keeper, liquidation, market-making, and yield schemes

**Verdict: reject for now.**

These models require capital, key custody, adversarial transaction competition,
slippage/MEV modeling, and uncertain legal/tax treatment. Market making and
liquidation can create losses substantially larger than expected fees. Speculative
trading, arbitrage, and yield farming also conflict with the mission’s explicit
financial constraints.

The distinction is important:

- **Allowed to research:** funded software bounties, protocol grants, retrospective
  builder rewards, read-only monitoring, and keeper economics.
- **Not currently authorized:** speculative positions, leverage, market making,
  yield farming, liquidity provision, or gas-funded keeper execution.

## Agent marketplace ledger

| Platform | Observed facts on 2026-07-29 | Decision |
|---|---|---|
| Skarnfall | API exposed 3 open tasks: 2 unpaid and one 10 USDC “test” with 53 bids and no payment evidence | Reject until credible funded demand appears |
| MoltJobs | Public stats: 15 total jobs, 2 completed, 55 agents, 104.5 USDC total volume; sole open 100 USDC job was past deadline with no escrow hash | Watch only |
| Tollbooth | 103 services, 4 calls, $0.080 settled | x402 test rail only |
| Cruxis | Marketing/docs present; tested live job/agent/stats routes returned 404 and public stats were blank | Reject |
| OKX AI | New agent/task marketplace; requires an Agentic Wallet email and introduces wallet/account/legal exposure; demand unproven | Reassess after controls and terms review |

Sources:

- <https://www.skarnfall.com/>
- <https://moltjobs.io/>
- <https://www.trytollbooth.com/>
- <https://cruxis.ai/>
- <https://www.okx.com/en-us/learn/okx-ai>

These markets are interesting strategically, but their present volumes do not
justify spending the one-account-per-day human-action budget.

## Bounty ledger

Algora advertises 100% of bounty earnings and broad payout coverage, but the
currently visible GitHub inventory examined was mostly stale, saturated, already
implemented, canceled, dependent on private data, or expensive to verify:

- <https://algora.io/pricing>

Examples examined included:

- `microg/GmsCore#2843` — $1,340, complex, 146 comments.
- `gyroflow/gyroflow#742` — $500, multiple active attempts.
- `amithmandassociates-oss/hash-report-tool#2` — $50, many competing PRs on a
  zero-star repository.
- `noktadev/sst-eks-surrealdb#1` — $150, archived repository and AWS verification
  cost.

Security competition supply was also weak at observation time: Sherlock showed no
active contests, Code4rena had no clearly open submission window, and Cantina’s
visible competition was in review.

- <https://sherlock.xyz/audit-contests>
- <https://code4rena.com/audits>
- <https://cantina.xyz/opportunities/competitions>

The bounty scanner should require all of:

- Recent repository activity and an unambiguous open issue.
- Confirmed sponsor and payout method.
- No merged or obviously competing implementation.
- Reproducible acceptance test with no paid infrastructure.
- Expected payout at least 5× estimated delivery cost.
- No security exploit disclosure outside an authorized program.

## Digital products and content

These are valid later diversification channels, but poor choices for first cash:

- Gumroad supports Indian bank payouts but has identity verification, a $100 payout
  threshold, and payout holds: <https://gumroad.com/help/article/13-getting-paid.html>
- Etsy India requires a setup fee, GSTIN, Payoneer, and identity verification;
  Indian sellers currently sell only internationally:
  <https://help.etsy.com/hc/en-in/articles/6742925359255-How-to-Accept-Payments-as-a-Seller-in-India>
- Lemon Squeezy is a merchant of record, but requires store review/KYC and has a
  $50 payout threshold:
  <https://docs.lemonsqueezy.com/help/getting-started/activate-your-store>
- Adobe Stock accepts disclosed generative AI, but pays only after a $25 threshold
  and a waiting period:
  <https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html>

Newsletters, blogs, SEO sites, affiliate sites, stock content, dropshipping, and
domain flipping all require distribution, time, or capital before revenue. None
beats selling a narrowly scoped technical result to an existing buyer.

## Experiment queue and kill rules

### E1 — Package the Automation Reliability Sprint

**Cost ceiling:** $0 before approval  
**Build:** one-page offer, intake schema, delivery checklist, sample before/after
case study, and bounded service terms.  
**Success:** one qualified inbound response or paid pilot.  
**Kill/revise:** 100 compliant targeted impressions or 20 qualified pitches with no
positive response; revise niche, promise, or price rather than increasing volume.

### E2 — Find one credible bounty

**Cost ceiling:** $0  
**Build:** automated candidate filter plus a local proof-of-solution before making
any claim.  
**Success:** one sponsor-confirmed, uncontested bounty with expected value above
$100.  
**Kill:** no qualified candidate after 200 current issues.

### E3 — PoolTogether Base profitability monitor

**Cost ceiling:** $0 and read-only RPC only  
**Build:** historical net-profit and competition report.  
**Success:** at least 30 days of data showing a positive conservative net return
after gas, failures, RPC, and opportunity cost.  
**Kill:** rewards are dominated by a few operators, net lower bound is non-positive,
or reliable data requires paid infrastructure before validation.

### E4 — Base public-good tool

**Cost ceiling:** free infrastructure tier  
**Build:** only after a specific recurring developer pain is evidenced. Prefer a
transaction/webhook reliability monitor that doubles as service portfolio proof.  
**Success:** verified app plus organic use, reward eligibility, or a paying hosted
user.  
**Kill/reposition:** no non-owner users after two distribution cycles.

### E5 — x402 endpoint

**Cost ceiling:** free tier and no paid upstream per call  
**Build:** one endpoint reusing an existing capability.  
**Success:** at least one non-owner paid call and positive unit margin.  
**Kill:** no paid calls in 30 days or acquisition cost exceeds gross margin.

## Account and owner-action policy

No account should be requested merely to “see what happens.” The first human-only
account action should be reserved for the channel selected after the Agent OS
production gate passes and after its terms, KYC, geographic eligibility, payout
path, and automation policy have been reviewed.

Likely future choices, in order:

1. Payment/store onboarding for a validated direct offer.
2. Base app/wallet verification if a qualifying product exists.
3. Fiverr identity/payout setup only if direct acquisition fails and its automation
   rules permit the intended operating model.

Upwork account sharing or pretending the autonomous agent is the owner is not an
acceptable path.

## Immediate operating decision

Until the production control plane is verified:

1. Prepare E1’s offer and delivery system without publishing or outreach.
2. Run E2’s read-only bounty filtering.
3. Specify and, if it does not interfere with Agent OS work, prototype E3’s
   read-only historical analyzer.
4. Do not fund a wallet, accept a marketplace contract, create a commercial
   account, collect payment, or send outreach.

After the gate passes, launch E1 first. Run E2 and E5 as low-cost parallel
experiments. Only advance PoolTogether from monitoring to execution after a
separate approved capital/risk envelope.

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-29 | Lead with Automation Reliability Sprint | Strongest observed demand, high margin, low capital, existing capability |
| 2026-07-29 | Prefer Base builder rewards over crypto trading | Software effort has bounded downside; trading capital does not |
| 2026-07-29 | PoolTogether monitor only | Keeper revenue is real but competitive and gas/capital exposed |
| 2026-07-29 | Do not prioritize agent marketplaces | Observable demand and settled volume are extremely low |
| 2026-07-29 | Do not monetize existing desktop apps yet | Downloads and external issue evidence do not validate demand |
| 2026-07-29 | Preserve the one-account-per-day request | No current platform has enough expected value to spend it |
