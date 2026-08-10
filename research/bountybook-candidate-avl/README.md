# BountyBook AVL candidate

- Job: `1063de95-75f4-4170-8879-f5b1b683bb9b`
- Title: Build an AVL tree implementation in Python
- Public budget: USD 15.00 USDC on Base
- Provider state at preparation: open, 528 prior attempts, no claim by Goofy
- Scope: stdlib-only `avl.py` with insert, delete, search, inorder, and height.

## Validation

Run from this directory:

```sh
python3 test_avl.py
python3 avl.py
```

Both commands print `All tests passed`. A randomized insert/delete check over
20 deterministic seeds also passed. The provider requires `python avl.py`; the
candidate has no external dependencies.

## Integrity

- `avl.py`: `3b61fc3abfeaff4b995f56bbea9d9ee981e2919b58400e55d7b36314685b4e5a`
- `test_avl.py`: `7c00474017227cf4699fd9b5b1624ec6851b68563b0adfb457957d1ea648706d`

The candidate was claimed and submitted three times under separate approvals;
BountyBook rejected the inline shapes as 2 lines, 0 lines, and finally an IPFS
fallback error. The job reopened each time and paid nothing. The AVL lane is
closed; no further attempt is permitted.

## Submission-format lesson

The first approved attempt used `outputData.files.avl.py` plus a short optional
`stdout` field. BountyBook accepted the request but its verifier selected the
two-line `stdout` surface and failed with `Code output too small: 2 lines`.
The corrected payload must omit `stdout` and provide the complete source through
the inline file/content surface. A new approval is required before retrying.
