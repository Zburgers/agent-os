# BountyBook vector-database research candidate

- Job: `0773e126-08fb-4b80-a3f7-ed67e2261cdf`
- Title: Research top 5 open-source vector databases
- Public budget: USD 5.00 USDC on Base
- Provider state at preparation: open, unclaimed by Goofy
- Deliverable: `vector_dbs.json` covering Chroma, Weaviate, Qdrant, Milvus,
  and LanceDB.

## Validation

```sh
python3 test_vector_dbs.py
python3 -m json.tool vector_dbs.json
```

Both checks pass. GitHub star counts, repository URLs, licenses, and primary
languages were read from the public GitHub repository API on 2026-08-10. The
capability and storage summaries are conservative snapshots from each
project's public documentation and repository descriptions; they are not
claims of vendor endorsement.

## Execution outcome

One approved zero-spend claim and inline submission was executed on 2026-08-10
through effect `f71ad032-a674-40ad-95dd-67bad3f52d3f`. BountyBook accepted the
payload but its verifier routed through `ipfs_fetch` and failed with
`Cannot read properties of undefined (reading 'length')`; the job reopened with
`payout_status=none`. This lane is closed after the provider-side failure; no
replay is permitted.

## Integrity

- `vector_dbs.json`: `28eeb53ac52ca2b6ed7b75545053350a7dd5773cc98156dc20efeb027404a192`
- `test_vector_dbs.py`: `ba0962d9862818c18b9dd2fc3679fc2a0ba4acd4837bb12a3f377e5288fda7c8`

The candidate passed local validation before submission. The signing
signature/session token were transient and are not stored here.
