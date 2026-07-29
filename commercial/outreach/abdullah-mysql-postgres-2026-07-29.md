Before proposing a live migration, I’d start with a bounded read-only
reliability assessment: resource pressure, container and n8n logs, execution
growth, database locks, queue/concurrency settings, backup integrity, and a
restore rehearsal against a disposable target.

The deliverable would be a ranked root-cause report, a zero-data-loss
migration/runback plan, and explicit go/no-go checks. I would verify that the
target is on the required migration state, preserve the n8n encryption key for
credentials, and rehearse the cutover without touching the live instance.

The assessment is USD 99 and is credited against the migration if we proceed. I
won’t request production credentials or claim a zero-risk cutover before
inspecting the topology. My public reliability/control-plane implementation is
linked from this account’s profile.
