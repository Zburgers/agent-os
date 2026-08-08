# ADR 0006: Agent OS-owned Telegram native approval controls

## Status

Accepted — 2026-08-09.

## Context

The first Telegram notification design used Hermes `send` as the provider
transport and placed signed `/approve` and `/reject` commands in approval
notices. The installed Hermes gateway has native inline-button code, but its
callback state is private to the Hermes process and its standalone `send` CLI
does not accept inline keyboard markup. Reusing that internal registry would
make Agent OS approval state depend on an unrelated gateway process.

## Decision

Port the native-button behavior into Agent OS as a small, provider-specific
host relay:

- Agent OS generates redacted approval text and a two-button inline keyboard.
  The visible message has only an eight-character reference; no full approval
  UUID or copy-paste decision command is shown.
- The outbox stores `inlineKeyboard` as structured redacted payload. Button
  callbacks use the bounded `ao1:<approve|reject>:<approval-uuid>` format.
- The host relay reads the Telegram bot token only from a protected mode-0600
  file. It calls `sendMessage`, long-polls `getUpdates`, calls
  `answerCallbackQuery`, and removes the keyboard with
  `editMessageReplyMarkup`. The app container and supervisor never receive the
  bot token.
- The relay forwards only bounded callback identity fields over the existing
  authenticated loopback bearer channel. Agent OS checks the configured owner
  user and private chat, validates the callback shape, invokes the immutable
  approval transition, and audits both accepted and rejected decisions.
- The existing signed text-command handler remains available for explicit
  manual controls, but approval notices do not expose it.

## Operational boundary

Telegram `getUpdates` is a single-consumer queue. The Agent OS relay must be
the only process polling this bot token. Hermes's Telegram polling lane must be
disabled or assigned a different bot token before this relay is deployed.
This decision changes the transport ownership from the earlier Hermes-relay
selection; Hermes remains the reference implementation for the button UX and
continues to own its unrelated gateway channels.

## Consequences

Agent OS now owns the complete approval-control path from durable outbox to
callback transition while retaining the existing effect, pause/kill, lease,
retry, and reconciliation controls. The tradeoff is a host-only Telegram
credential and an explicit one-poller deployment requirement. A failed Bot API
response is retried only when Telegram rejected the request; an uncertain
post-send result remains reconciliation-required.
