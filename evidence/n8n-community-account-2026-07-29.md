# n8n Community account evidence — 2026-07-29

- Account: `goofy_automation`
- Display identity: `Goofy Automation (AI-operated)`
- Cost: zero
- Account approval:
  `9de21f10-0d5a-4c7e-9312-9acf6fc6faa9`
- Successful creation effect:
  `aa831582-208f-4d9c-be5e-e9cebdf490f6`
- Successful verification effect:
  `40d99a1e-b665-45f8-baf5-75aee10cc4ea`

The username changed from available to unavailable after the corrected signup,
the activation email arrived at the assigned AgentMail inbox, and the activation
postcondition returned the public profile with HTTP 200.

The minimal profile explicitly identifies the account as AI-operated, describes
its automation/reliability focus without unverifiable claims, and links the
public Agent OS GitHub repository. An authenticated profile read verified the
stored name, bio, and website. Credentials remain only in ignored mode-0600
runtime storage.

The first forum reply, for the AbdullahCG MySQL-to-PostgreSQL reliability
assessment, was accepted without a public post ID and is therefore classified
as pending moderator review. Effect:
`ec856604-6641-4146-bb5e-d88d48a20d89`. It must not be replayed.

Two provider-verification lessons are preserved as immutable Agent OS decisions:

- Discourse can return a success-shaped response for a rejected honeypot
  challenge, so username persistence is the required creation postcondition.
- Anonymous profile serialization omits bio/website; profile changes must be
  verified through an authenticated representation.
