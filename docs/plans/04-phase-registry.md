# Plan 04 — Phase record registry

Implements deepening candidate **#10** from `docs/deepening-candidates.md`.
Vocabulary in `docs/CONTEXT.md` (Phase record). Decisions locked in during
grilling are referenced inline.

## Goal

Replace the mirror 7-case switches in `src/lib/phase-machine/transition.ts`
and `src/lib/phase-machine/project.ts` with a single registry of phase records,
making `transition` and `project` thin lookups.

## Non-goals

- No changes to phase reducers or projections themselves.
- No changes to the `PhaseRecord<P>` shape or `accepts` placement.
- No changes to `Action`, `Effect`, or any state types.

## Strategy

Build the registry as a new module, then rewrite `transition.ts` and
`project.ts` against it. Existing reducer tests pass unchanged (their inputs
and outputs are untouched). One small dispatcher-level test verifies the
registry path end-to-end.

## Phase 1 — Registry module

**File to create:** `src/lib/phase-machine/registry.ts`

```ts
import type { Phase } from './types';
import type { PhaseRecord } from './phases/types';
import { endedPhase } from './phases/ended';
import { errorPhase } from './phases/error';
import { lobbyPhase } from './phases/lobby';
import { loadingQuestionPhase } from './phases/loading-question';
import { scoringPhase } from './phases/scoring';
import { votingPhase } from './phases/voting';
import { writingPhase } from './phases/writing';

export const phaseRecords = {
	lobby: lobbyPhase,
	'loading-question': loadingQuestionPhase,
	writing: writingPhase,
	voting: votingPhase,
	scoring: scoringPhase,
	error: errorPhase,
	ended: endedPhase
} as const satisfies { [P in Phase]: PhaseRecord<P> };
```

The `as const satisfies` clause is the type-level invariant: TS verifies at
construction time that every `Phase` is keyed and that each value's parametric
`P` matches its key. Adding a new phase fails to compile until the registry
gains a matching entry.

**Verify**

- `pnpm check` clean. No callers yet.

## Phase 2 — Rewrite `transition.ts`

**File:** `src/lib/phase-machine/transition.ts`

Replace the entire body with:

```ts
import { phaseRecords } from './registry';
import type { Action, InternalState, TransitionResult } from './types';

export function transition(state: InternalState, action: Action): TransitionResult {
	const record = phaseRecords[state.phase];
	if (!record.accepts.has(action.type)) return { state, effects: [] };
	return record.reduce(state as never, action);
}
```

The `as never` is the price of replacing the switch-narrowing with a
registry lookup; the runtime invariant `record === phaseRecords[state.phase]`
is sound by construction.

## Phase 3 — Rewrite `project.ts`

**File:** `src/lib/phase-machine/project.ts`

```ts
import { phaseRecords } from './registry';
import type { InternalState, ViewerGameState } from './types';

export function project(state: InternalState, viewerId: string): ViewerGameState {
	return phaseRecords[state.phase].project(state as never, viewerId);
}
```

## Phase 4 — Tests

Existing reducer tests use phases directly (`writingPhase.reduce(...)`); they
don't go through `transition`. They should pass without modification.

**Add:** one orchestration-level test in
`src/lib/phase-machine/__tests__/transition.test.ts` (create if absent):

- `transition` from `lobby` with a `submit-answer` action returns unchanged
  state (action not in lobby's `accepts`).
- `transition` from `writing` with a `submit-answer` action calls the
  writing reducer and produces the expected result.
- `project` from each phase returns the expected variant.

If transition-level coverage already exists in `dispatcher.test.ts`, this is
optional — the registry is a thin wrapper.

**Verify**

- `pnpm check` clean.
- `pnpm test` green.

## Phase 5 — Cleanup

- The seven phase-record imports previously in `transition.ts` and
  `project.ts` are now consolidated in `registry.ts`. Verify no orphan
  imports remain.
- `pnpm format`.

## Acceptance criteria

- `phaseRecords` registry exists at `src/lib/phase-machine/registry.ts` with
  `as const satisfies { [P in Phase]: PhaseRecord<P> }`.
- `transition.ts` and `project.ts` are each under 10 lines (excluding
  imports).
- A single `as never` cast is the only type assertion in either file.
- `pnpm check`, `pnpm test` clean.
- No reducer/projection logic was modified.

## Open risks

1. **The `as never` cast.** If a future contributor adds a new phase but
   forgets to update the `Phase` union or `InternalState`, the `satisfies`
   clause will fail at registry-construction time — the cast at the lookup
   site only papers over TS's narrowing limitation, not over real
   inconsistencies. Document this in a one-line comment at the cast.
2. **Adding a phase still requires editing seven places** (`Phase`,
   `InternalState`, `ViewerGameState`, the new reducer file, the new test
   file, `registry.ts`, and any docs). The plan's leverage win is removing
   _two_ of those (the switch cases). The remaining touches are
   load-bearing.
