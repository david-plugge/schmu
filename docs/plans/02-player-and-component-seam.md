# Plan 02 — Player unification & component prop seam

Implements deepening candidates **#7** and **#8** from `docs/deepening-candidates.md`.
Vocabulary in `docs/CONTEXT.md`. Decisions locked in during grilling are referenced
inline; this plan only adds task-level detail.

## Goal

Collapse `InternalPlayer` / `ViewerPlayer` into a single `Player` type. Add
`you: Player` to `BaseViewerState`, computed at projection time. Enforce
member-only subscriptions on the dispatcher. Convert every phase component to
take its phase slice as a single prop, dropping the page-level
`currentPlayer` derivation and `PlayerList`'s `getLoggedInUser` import.

## Non-goals

- No changes to internal state shape beyond the rename. The seven `Player`
  fields stay (ADR 0001).
- No persistence changes.
- No changes to the remote layer's dispatch boilerplate (that's plan 03).
- No changes to `transition.ts` / `project.ts` orchestration (that's plan 04).
- Don't touch ai.ts or anything outside the game route + phase machine.

## Strategy

Top-down: types first (one rename + one new field), then projection updates,
then subscribe enforcement, then components in one sweep. The type rename
breaks every callsite at once; the rest of the plan is fixing that breakage in
order. Land as a single PR — the discriminated-union seam is incomplete in
intermediate states.

## Phase 1 — Type changes

**Files**

- `src/lib/phase-machine/types.ts`
  - Rename `InternalPlayer` → `Player`. Keep all seven fields.
  - Delete `ViewerPlayer`. Re-export nothing in its place.
  - `BaseViewerState` (line 136-140) gains `you: Player`.
  - `BaseState` (line 50-55) — `players: InternalPlayer[]` becomes
    `players: Player[]`.

**Expected breakage**

- Every phase reducer (`extractBase` consumers).
- Every phase `project`.
- `helpers.ts` (`InternalPlayer` references at lines 2, 50, 58-63, 66-72, 75-82).
- Components importing `ViewerPlayer` from `phase-machine`.
- `phase-machine/index.ts` barrel re-exports.

**Verify**

- `pnpm check` fails — that's the signal to proceed. Don't try to fix in this
  phase; the next phase fixes projection sites, the one after fixes components.

## Phase 2 — Projection updates

Update each phase's `project` to:

1. Drop `players: state.players.map((p) => ({ ...p }))` → `players: state.players`.
2. Add `you: state.players.find((p) => p.id === viewerId)!`.

**Files**

- `src/lib/phase-machine/phases/lobby.ts:75-83`
- `src/lib/phase-machine/phases/loading-question.ts:65-72`
- `src/lib/phase-machine/phases/writing.ts:86-95`
- `src/lib/phase-machine/phases/voting.ts:46-61`
- `src/lib/phase-machine/phases/scoring.ts:47-76`
- `src/lib/phase-machine/phases/error.ts:27-35`
- `src/lib/phase-machine/phases/ended.ts` — add `you`, drop the map.

The `project` signature already takes `viewerId: string`; today some phases
ignore it (`lobby`, `error`, `ended` declare a dummy parameter). After this
phase, every projection uses it.

**Optional helper:** introduce `projectBase(state, viewerId)` in
`phase-machine/helpers.ts` returning `{ code, players, currentRoundNumber, you }`.
Each `project` then spreads it. Skip if the duplication is bearable (4 lines × 7
phases); add only if `pnpm check` already wants edits in all 7 files.

**Verify**

- `pnpm check` failures shrink to component callsites only.
- `pnpm test` — phase reducer tests should still pass (the new `you` field
  changes the projection shape; existing tests using `toMatchObject` survive,
  tests using `toEqual` need a `you` field added).

## Phase 3 — Subscribe enforces membership

**Files**

- `src/lib/server/game-dispatcher.ts:38-45` — `subscribe(viewerId, sub)` checks
  `state.players.some(p => p.id === viewerId)` before adding the listener.
  Throws (typed error or plain `Error('not-a-member')`).
- `src/routes/games/[code]/game.remote.ts:17-41` — wrap the `subscribe` call.
  Catch the throw; surface `error(403, 'not a member')` from `@sveltejs/kit`.
- `src/lib/server/__tests__/game-dispatcher.test.ts` — new test:
  `subscribe` with a non-member id throws.

**Edge case to verify in test:** subscribing during `lobby` phase before
`add-player` has been dispatched (shouldn't happen via the real flow because
`createGame` / `joinGame` dispatch `add-player` before redirect, but worth
asserting).

**Verify**

- `pnpm test` green including the new test.
- Manual smoke: open `/games/UNKNOWN_CODE` while not a member of any game —
  expect 403, not 200 with empty state.

## Phase 4 — Component conversion

The biggest single phase. Land everything together.

**Files**

- `src/routes/games/[code]/+page.svelte`
  - Delete `currentPlayer` derivation (lines 16-18).
  - Each `<XPhase ... />` invocation becomes `<XPhase {state} />` where
    `state` is the narrowed `gameState` from the discriminated union.
  - The `gameState.phase === 'writing' && currentPlayer` guard becomes just
    `gameState.phase === 'writing'` (the projection guarantees `you` exists).
  - Error/ended branches use `gameState.you?.isHost` directly.
- `src/routes/games/[code]/WritingPhase.svelte`
  - `Props` becomes `{ state: Extract<ViewerGameState, { phase: 'writing' }> }`.
  - Read `state.code`, `state.currentWord`, `state.you`, `state.players`,
    `state.myQuestionVote`.
- `src/routes/games/[code]/VotingPhase.svelte` — same shape.
- `src/routes/games/[code]/ScoringPhase.svelte` — same shape; `isHost` becomes
  `state.you.isHost`.
- `src/routes/games/[code]/LobbyPhase.svelte` — same shape; `isHost` becomes
  `state.you.isHost`; `enabledCategories` from `state.enabledCategories`.
- `src/routes/games/[code]/PlayerList.svelte`
  - `Props` becomes `{ players: Player[]; you: Player }`.
  - Drop the `getLoggedInUser` import and `user` derivation (line 2, 10).
  - Replace `player.id === user.id` with `player.id === you.id`.

**Verify**

- `pnpm check` clean.
- `pnpm lint` clean.
- `pnpm test` green.
- **Manual smoke** in `pnpm dev` with two browsers: lobby → start → write →
  vote → score → next round → end. Verify "ich" badge still shows on the right
  player. Verify "Nächste Runde!" button only shows for host. Verify
  `gameState.phase === 'error'` shows back-to-lobby for host only.
- **Stranger test:** open a third browser logged in as a third user, navigate
  directly to the game's `/games/[code]` URL without joining. Expect 403.

## Phase 5 — Cleanup

- `src/lib/phase-machine/index.ts` — drop `ViewerPlayer` from re-exports;
  ensure `Player` is exported.
- Search for `InternalPlayer` and `ViewerPlayer` strings; remove stragglers.
- `pnpm format`.

## Acceptance criteria

- `Player` is the single player type used in both `InternalState` and
  `ViewerGameState`.
- `BaseViewerState` has a non-null `you: Player`.
- `GameDispatcher.subscribe` rejects non-member viewers with a thrown error;
  `game.remote.ts` translates to 403.
- No phase component references `getLoggedInUser`; only `+page.svelte` does (or
  no one does — `assertSession` runs in remote functions and the page can read
  `state.you` instead).
- `+page.svelte` is a thin phase switch with no `currentPlayer` derivation.
- `pnpm check`, `pnpm lint`, `pnpm test` all clean.
- Manual smoke (multi-browser including stranger 403 test) passes.

## Open risks

1. **Tests using `toEqual` on full projection results.** Adding `you` changes
   every projection's shape. Audit existing tests; switch to `toMatchObject`
   where partial assertions are intended.
2. **The `find!` non-null assertion.** Sound only because `subscribe` enforces
   membership. If a future code path projects without going through
   `subscribe`, the assertion crashes. Document via a comment at the projection
   helper if one is introduced; otherwise leave the invariant in the
   subscribe guard's commit message and the candidate notes.
3. **`PlayerList` is rendered from inside phase components.** Today some phase
   components don't render PlayerList; check after conversion that all
   intended call sites pass `{ players, you }` rather than `{ players, user }`.
4. **The `getLoggedInUser` query in PlayerList today is reactive** — its
   removal might silently change re-render behavior if the page relied on it
   to trigger updates. Should be fine (the `state` prop change re-renders
   already), but verify in the manual smoke.
