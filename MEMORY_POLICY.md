# Memory Policy

PostgreSQL is authoritative for business state. A replaceable Mem0 provider stores only scoped contextual memory.

All memory uses owner_id and applicable agent_id, venture_id, project_id, customer_id, experiment_id, run_id, and decision_id. Each important item carries category, source, verification date, confidence, sensitivity, epistemic type, expiry/review date, and related entity.

Before persistence: assess future value, evidence, type (fact/inference/hypothesis/instruction/lesson), duplication, staleness, and privacy risk. Hypotheses are labelled. Never persist secrets, payment credentials, OTPs, private keys, auth cookies, or unnecessary personal data. Perform scoped retrieval tests, backups, stale-claim reviews, duplicate merging, and audit logging.
