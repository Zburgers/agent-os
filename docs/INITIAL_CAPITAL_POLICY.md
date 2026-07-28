# Initial Capital Policy

## Capital

- Codex subscription: fixed infrastructure expense, recorded separately.
- Owner capital commitment: INR 3,000.
- Initially spendable by Goofy: INR 0.
- Locked reserve: INR 2,000.
- First operating tranche: INR 500.
- Validation tranche: INR 500.

## Unlock conditions

The first INR 500 may be released only after all of the following are
implemented and tested:

- Append-only financial ledger.
- Expense proposal workflow.
- Owner approval workflow.
- Telegram owner authentication.
- Global pause and kill switch.
- Per-expense and daily spending limits.
- Secret isolation.
- Audit logging.
- Restart recovery.
- Duplicate-action prevention.

The second INR 500 may be released only after a verifiable external
demand signal, such as:

- A qualified customer reply.
- A legitimate wait-list signup.
- A requested proposal.
- A confirmed trial.
- A paid preorder handled through an owner-approved payment system.

The INR 2,000 reserve remains locked until the first settled customer
payment unless the owner explicitly authorizes otherwise.

## Prohibited credential access

Goofy must never receive or store:

- Bank passwords.
- UPI PINs.
- OTP access.
- Complete card credentials.
- Primary bank-session cookies.
- Recovery codes.
- Unrestricted wallet credentials.

Goofy may propose expenses and prepare exact purchase instructions.
Actual spending initially requires explicit owner approval.
