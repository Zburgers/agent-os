# Autonomous Agent Wallet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Give Goofy a dedicated, observable, bounded wallet that can autonomously sign BountyBook authentication messages without exposing key material.

**Architecture:** Store the private key only in a mode-0600 runtime secret file and store public wallet policy/activity in PostgreSQL. Add a narrowly allowlisted EIP-191 signer, authenticated APIs, dashboard visibility, provisioning workflow, and constitutional documentation while preserving kill/pause and financial controls.

**Tech Stack:** Node.js, TypeScript, ethers v6, PostgreSQL, node:test, existing Agent OS HTTP/dashboard architecture.

---

<task id="1" name="Constitutional wallet amendment">
  <description>Record the owner's explicit authorization and define the boundary between the dedicated agent wallet and owner credentials.</description>
  <files><modify>AUTONOMOUS_REVENUE_MISSION.md</modify><modify>AGENT_CONSTITUTION.md</modify><modify>MEMORY_POLICY.md</modify><modify>SECURITY_MODEL.md</modify><modify>APPROVAL_MATRIX.md</modify></files>
  <steps><step>Add an owner-authorized dated amendment</step><step>Preserve the ban on owner-wallet credentials and secret leakage</step><step>Document that message signing is not spending authority</step></steps>
  <verification><command>rg -n "dedicated agent wallet|2026-08-01" AGENT_CONSTITUTION.md MEMORY_POLICY.md SECURITY_MODEL.md APPROVAL_MATRIX.md</command><expected>All four policy documents contain the scoped boundary</expected></verification>
</task>

<task id="2" name="Wallet persistence and key store">
  <description>Add public wallet/policy/activity tables and a protected runtime key store.</description>
  <files><create>db/migrations/016_agent_wallet.sql</create><create>src/agent-wallet.ts</create><test>test/agent-wallet.test.ts</test></files>
  <steps><step>Write tests for mode-0600 creation, idempotent loading, address matching, and no key exposure</step><step>Run tests and confirm missing implementation failure</step><step>Implement minimal file key store and public persistence</step><step>Run focused tests</step></steps>
  <verification><command>npm test -- test/agent-wallet.test.ts</command><expected>Focused tests pass with zero failures</expected></verification>
</task>

<task id="3" name="Bounded autonomous signing">
  <description>Implement BountyBook-only EIP-191 signing with durable audit, rate limit, and pause/kill gates.</description>
  <files><modify>src/agent-wallet.ts</modify><test>test/agent-wallet.test.ts</test></files>
  <steps><step>Write failing signing and denial tests</step><step>Confirm expected RED failures</step><step>Implement provider/message validation and signing</step><step>Confirm GREEN</step></steps>
  <verification><command>npm test -- test/agent-wallet.test.ts</command><expected>Signing and policy tests pass; signatures/keys are absent from persisted values</expected></verification>
</task>

<task id="4" name="API and dashboard visibility">
  <description>Add authenticated provisioning/signing/status APIs and render dedicated wallet activity in wallet and finance pages.</description>
  <files><modify>src/server.ts</modify><modify>src/wallet-page.ts</modify><modify>src/control-plane.ts</modify><test>test/workboard.test.ts</test><test>test/static-assets.test.ts</test></files>
  <steps><step>Write failing API/UI contract tests</step><step>Confirm RED</step><step>Add routes and dashboard rendering</step><step>Confirm GREEN</step></steps>
  <verification><command>npm test</command><expected>Full unit suite passes</expected></verification>
</task>

<task id="5" name="Provision, deploy, and earn">
  <description>Apply migration, provision the wallet, verify production, and retry a BountyBook job using autonomous signing.</description>
  <files><create>scripts/provision-agent-wallet.mjs</create><modify>.env.example</modify><modify>docs/WALLET_PAYPAL_TAILSCALE.md</modify></files>
  <steps><step>Provision protected key with owner attribution</step><step>Apply migration and restart services</step><step>Run test/build/audit/security checks</step><step>Verify dashboard and health</step><step>Authenticate, claim, submit, and reconcile BountyBook outcome</step></steps>
  <verification><command>npm test &amp;&amp; npm run build &amp;&amp; npm audit --audit-level=high</command><expected>All commands exit 0; dashboard shows wallet and activity; external payout is recorded only if settled</expected></verification>
</task>
