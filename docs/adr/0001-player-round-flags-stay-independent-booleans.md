# ADR 0001 — Player round-flags stay as independent booleans

**Status:** accepted (2026-05-03)

## Context

The `InternalPlayer` shape carries three booleans that track per-round progress:

```ts
hasSubmitted: boolean; // submitted an answer in writing phase
hasVoted: boolean; // submitted a vote in voting phase
hasSkipped: boolean; // flagged "skip this word" in writing phase
```

A deepening proposal (`docs/deepening-candidates.md` #3) suggested collapsing these
into a single discriminated enum:

```ts
type RoundStatus = 'waiting' | 'submitted' | 'skipped' | 'voted';
```

The pitch was: "exactly one applies per round, all reset together; an enum makes
invalid combinations unrepresentable."

## Decision

**Keep the three booleans. Do not collapse to a `RoundStatus` enum.**

The premise of the proposal — "exactly one applies per round" — is wrong:

1. **`submitted` and `skipped` are independent in writing phase.** A player can
   commit an answer (`hasSubmitted = true`) and _also_ register a skip vote on
   the word (`hasSkipped = true`). Skip is a per-round veto signal; submit is a
   per-round commitment. Both can be true simultaneously, and the submission
   stays committed even if the player later toggles skip on. Forcing mutual
   exclusion would lose information or change behaviour.
2. **`submitted` persists into voting phase alongside `voted`.** During voting,
   players carry `hasSubmitted=true` from writing AND eventually
   `hasVoted=true` after voting. A single enum can only hold one of those
   values; storing the wrong one would make either "did this player submit?"
   or "did this player vote?" ambiguous.
3. **No invalid combination exists.** Every (submitted, skipped, voted)
   triple represents a real, valid state. The deletion test for the
   collapse-to-enum proposal therefore yields no concentration of complexity —
   it just shuffles the data shape.

The remaining ergonomic friction (3-line reset block, three `every(p => p.hasX)`
patterns) is cosmetic and does not justify a refactor that loses information or
imposes a mutually-exclusive type on genuinely independent facts.

## Consequences

- Future architecture surveys should not re-suggest collapsing these flags into
  an enum.
- If a fourth flag is added later, the `resetRoundFlags` helper in
  `src/lib/phase-machine/helpers.ts` and any new readiness check pattern need to
  be updated by hand. This is acceptable.
- If a future change genuinely makes these flags mutually exclusive (e.g.
  redesigning skip to retract submissions), revisit this ADR.
