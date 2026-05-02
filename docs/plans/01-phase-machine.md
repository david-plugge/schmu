# Plan 01 — Phase Machine

Implements deepening candidate **#1** from `docs/deepening-candidates.md`. Vocabulary
in `docs/CONTEXT.md`.

## Goal

Replace the smeared phase logic in `src/lib/server/game.ts` with a pure, lib-side
**phase machine** module. The `GameInstance` class shrinks to a thin server-side
**dispatcher** that holds in-memory state, runs the pure transition function, and
executes effects.

## Non-goals

- No persistence changes (rounds and game state stay in-memory).
- No DB schema changes.
- Don't tackle candidate #2 (Round module) — except for the unified
  `toggle-question-vote` action, which symmetrizes the writing/scoring vote toggle.
- Don't tackle candidate #3 (player state booleans). `hasSubmitted` / `hasVoted` /
  `hasSkipped` stay; readiness checks move into reducers but keep the same shape.
- Don't tackle candidate #6 (`GameManager` simplification). The manager stays, just
  constructs a dispatcher instead of a `GameInstance`.

## Strategy

Bottom-up: types → pure reducers per phase → dispatcher → swap `GameInstance` →
update remote functions → update components → cleanup. The viewer-state shape
change is breaking, so phases 4–6 land together.

## Phase 0 — Test infrastructure

The codebase has zero tests today. Pure reducers are the leverage win for testing,
so test infra has to come first.

**Tasks**

- Add `vitest` and `@vitest/ui` to `devDependencies`.
- Add `vitest.config.ts` (or extend `vite.config.ts`) — minimal Node environment
  config; SvelteKit's vite config should not interfere with `.test.ts` files outside
  components.
- Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.
- Add a sanity test: `src/lib/phase-machine/__tests__/sanity.test.ts` with a single
  `expect(true).toBe(true)`.

**Verify**

- `pnpm test` runs and the sanity test passes.
- `pnpm check` and `pnpm lint` still clean.

## Phase 1 — Type skeleton (no behavior)

Create the phase machine module with type-only exports. No runtime logic yet.

**Files to create**

- `src/lib/phase-machine/types.ts`
  - `Phase` — string union of `'lobby' | 'loading-question' | 'writing' | 'voting' | 'scoring' | 'error' | 'ended'`.
  - `InternalState` — discriminated union by phase. Each variant holds only the data
    that phase needs (e.g., `loading-question` has `loadId`; `writing` / `voting` /
    `scoring` have a `Round`; `error` has a `reason`). Common fields (`code`,
    `players`, `enabledCategories`, `roundIndex`) sit at the top level alongside the
    phase variant or in a wrapper — pick one shape and stick with it.
  - `Action` — tagged union (locked-in list from
    `deepening-candidates.md` §1):
    - Player: `submit-answer`, `submit-vote`, `toggle-skip`, `toggle-question-vote`
    - Host: `set-categories`, `start-game`, `end-game`, `back-to-lobby`
    - System: `next-round`, `question-loaded`, `question-load-failed`
    - Each variant carries its payload; `playerId` is added by the dispatcher into a
      `DispatchedAction` envelope passed to reducers.
  - `Effect` — tagged union: `load-next-question` (with `loadId`, `usedWords`,
    `categories`), `vote-question` (id, delta), `increment-times-played` (id),
    `notify-subscribers`.
  - `ViewerGameState` — discriminated union by phase, mirroring `Phase`. Each variant
    exposes only the fields meaningful for that phase. Replaces today's
    `GameState` interface in `src/lib/types.ts`.
  - `ViewerPlayer` — pruned `Player` view (id, name, isHost, score, plus the round
    flags).
- `src/lib/phase-machine/index.ts` — barrel re-exports the public types.

**Verify**

- `pnpm check` clean. No callers yet, no behavior change.

## Phase 2 — Pure reducers per phase

One file per phase under `src/lib/phase-machine/phases/`. Each file exports an
object `{ accepts, reduce, project }`:

- `accepts: ReadonlySet<Action['type']>` — which action types this phase processes.
- `reduce(state, action): { state: InternalState, effects: Effect[] }` — pure. Returns
  unchanged state when an action is rejected by a guard (e.g., voting for own answer).
- `project(state, viewerId): ViewerGameState` — pure projection.

**Files to create**

- `src/lib/phase-machine/phases/lobby.ts` — `set-categories` (host-only),
  `start-game` (host-only, transitions to `loading-question`, emits
  `load-next-question`), `end-game`.
- `src/lib/phase-machine/phases/loading-question.ts` — `question-loaded` (loadId
  must match; transition to `writing` with new Round, emit
  `increment-times-played`), `question-load-failed` (loadId match; transition to
  `error`), `end-game`.
- `src/lib/phase-machine/phases/writing.ts` — `submit-answer`, `toggle-skip`,
  `toggle-question-vote` (accepts both `up` and `down`; emits `vote-question` with
  delta), `end-game`. Guards: `submit-answer` rejects empty text. Transitions to
  `voting` when all players have submitted; to `loading-question` when all have
  skipped.
- `src/lib/phase-machine/phases/voting.ts` — `submit-vote` (rejects voting for own
  answer), `end-game`. Transitions to `scoring` when all have voted. Scoring
  computation (today's `calculateScores`) folds into this transition: the new
  scoring-phase state already contains `rewardedPoints` and the players' updated
  scores.
- `src/lib/phase-machine/phases/scoring.ts` — `toggle-question-vote` (up/down with
  delta calculation including undo of previous vote), `next-round` (host-only;
  transitions to `loading-question`, emits `load-next-question`), `end-game`.
- `src/lib/phase-machine/phases/error.ts` — `back-to-lobby` (transitions to
  `lobby`), `end-game`.
- `src/lib/phase-machine/phases/ended.ts` — accepts nothing (terminal).

**Top-level orchestration**

- `src/lib/phase-machine/transition.ts` — `transition(state, action)`. Looks up the
  current phase's record, returns unchanged state if action not in `accepts`,
  otherwise calls `reduce`.
- `src/lib/phase-machine/project.ts` — `project(state, viewerId)`. Looks up phase,
  calls `project`.
- Pure helpers: `src/lib/phase-machine/helpers.ts` for `shuffleSeeded`,
  `calculateScores`, `allPlayersSubmitted`, etc. — moved out of `game.ts`.

**Tests**

One test file per phase, under `src/lib/phase-machine/phases/__tests__/`:

- `lobby.test.ts` — `set-categories` rejected from non-host; `start-game` rejected
  from non-host; `start-game` from host transitions and emits `load-next-question`
  with a fresh `loadId`.
- `loading-question.test.ts` — stale `loadId` ignored; matching `loadId` transitions
  to `writing` with the question; failure transitions to `error`.
- `writing.test.ts` — submit-answer transitions when last submission arrives;
  toggle-question-vote up/down emits `vote-question` with correct delta (including
  undo of previous opposite vote); toggle-skip transitions to `loading-question`
  when all skip.
- `voting.test.ts` — submit-vote for own answer rejected; transition to scoring
  when last vote arrives; scoring math correct (correct guess = 2pts; fooled
  others = 3pts each).
- `scoring.test.ts` — toggle-question-vote delta math when previous vote exists;
  `next-round` from host transitions and emits `load-next-question`.
- `error.test.ts` — `back-to-lobby` transitions to lobby with players intact.
- `ended.test.ts` — every action rejected.

A shared helper module: `src/lib/phase-machine/__tests__/builders.ts` with
`makeState({ phase, players, ... })` and `expectEffect(effects, type, partial)`.

**Verify**

- `pnpm test` green.
- `pnpm check` clean. Module is dead code — no callers yet, but compiles.

## Phase 3 — Dispatcher

Replace `GameInstance`'s internals with a dispatcher that wraps the pure phase
machine.

**File to create / replace**

- `src/lib/server/game-dispatcher.ts` (new). Eventually replaces
  `src/lib/server/game.ts`.
- Holds: `state: InternalState`, `subscribers: Set<(viewerState) => void>` keyed by
  viewerId (Map keyed on listener identity, with viewerId in the closure as today).
- `dispatch(action)` — calls `transition`, swaps state, executes effects, notifies
  subscribers.
- Effect handlers:
  - `load-next-question` — runs `getRandomQuestions` (existing), constructs a
    `question-loaded` action with the current `loadId`, dispatches it. On error,
    dispatches `question-load-failed`.
  - `vote-question` — calls `voteQuestion(id, delta)` (existing).
  - `increment-times-played` — calls `incrementTimesPlayed(id)` (existing).
  - `notify-subscribers` — runs the subscriber fan-out.
- `subscribe(viewerId, listener)` — same shape as today's `GameInstance.subscribe`
  so `game.remote.ts:17` keeps working.
- UUID minting moves here: action constructors that need IDs (`submit-answer`'s
  `answerId`, the round's `correctAnswerId`) get them from the dispatcher before
  calling `transition`.

**Tests**

- `src/lib/server/__tests__/game-dispatcher.test.ts` — sequence of actions through
  a full round; async load resolves into `writing`; stale `question-loaded` (after
  user dispatches `back-to-lobby`) is ignored; `vote-question` effect actually calls
  the DB stub.
- DB stubs: inject the DB-effect handlers via constructor or via a module-mock; the
  cleaner path is a constructor option `{ db: { voteQuestion, incrementTimesPlayed,
loadQuestions } }` so the dispatcher is testable without touching SQLite.

**Verify**

- `pnpm test` green.
- `pnpm check` clean. `game.ts` still exists; nothing imports the dispatcher yet.

## Phase 4 — Swap GameInstance for dispatcher

This phase touches every consumer at once. Land it in one PR.

**Tasks**

- Delete `src/lib/server/game.ts` (the old `GameInstance` class). The dispatcher
  takes over.
- `src/lib/server/game-manager.ts` — constructs a dispatcher in `createGame` instead
  of a `GameInstance`. The manager's public surface stays the same.
- `src/routes/games/[code]/game.remote.ts` — every command now mints any required
  IDs and calls `game.dispatch({ type: '...', ... })`. The Zod schemas are unchanged.
  Combine `downvoteQuestion` + `voteOnQuestion` into one `toggleQuestionVote`
  command that takes `{ code, vote: 'up' | 'down' }` and works in both `writing`
  and `scoring`. (Today's `downvoteQuestion` callers in `WritingPhase.svelte` send
  it with no vote arg — they'll need updating; folds into Phase 5.)
- `getGame` query (`game.remote.ts:17`) — the live generator's `state!: GameState`
  type changes to `ViewerGameState`. The subscribe contract is unchanged.

**Verify**

- `pnpm check` clean. `pnpm test` green. The app may be temporarily broken in the
  browser at this point because components still expect the old shape — that's
  Phase 5's job.

## Phase 5 — Update components for the discriminated-union viewer state

The leverage win for the client. Components stop guarding optional fields.

**Tasks**

- `src/routes/games/[code]/+page.svelte` — `gameState` is now a discriminated
  union. Each `{:else if}` branch narrows the type; pass the narrowed slice to the
  child component without `!` or `??` defensives.
- `WritingPhase.svelte` — accept the writing-phase slice. Add an upvote button next
  to the existing downvote (the locked-in product change). Both call the new
  `toggleQuestionVote` command.
- `ScoringPhase.svelte` — accept the scoring-phase slice; the up/down buttons
  already exist. Wire to the unified `toggleQuestionVote`.
- `VotingPhase.svelte`, `LobbyPhase.svelte`, `PlayerList.svelte`,
  `CategoryPicker.svelte` — typecheck against the new slice shapes, fix any
  prop-shape mismatches.
- Remote command renames in component callers: `downvoteQuestion` →
  `toggleQuestionVote({ code, vote: 'down' })`; new `toggleQuestionVote({ code,
vote: 'up' })` for the writing-phase upvote.

**Verify**

- `pnpm check` clean. `pnpm lint` clean. `pnpm test` green.
- **Manual smoke** in `pnpm dev` with two browsers: create game, join, configure
  categories, start, write definitions, vote, score, up/downvote question in both
  writing and scoring, advance to next round, complete a few rounds, end game.
  Watch for console errors and broken states.
- Verify error path: temporarily make `getRandomQuestions` throw; confirm
  `error` phase renders and `back-to-lobby` recovers.

## Phase 6 — Cleanup

- `src/lib/types.ts` — delete `GamePhase` and `GameState`. Re-export the
  client-relevant types (`ViewerGameState`, `ViewerPlayer`, `Phase`) from
  `phase-machine` if other code reaches in. Keep `Question` and `Round` only if
  they have non-machine consumers (seed scripts).
- Search for `'reading'` and `'winner'` strings; remove any stragglers.
- Delete the helpers in old `game.ts` that have moved (`shuffleSeeded`,
  `calculateScores`, RNG).
- `pnpm format` to pick up any leftover whitespace nits.
- Update `docs/deepening-candidates.md`: candidate #1 status → `done`. Note where
  candidate #2 has been partially absorbed (vote-toggle unification).

## Acceptance criteria

- `pnpm test` green; coverage of every phase reducer and the dispatcher.
- `pnpm check` and `pnpm lint` clean.
- Manual smoke test passes a full multi-round game with two browsers.
- `git diff` shows: new `src/lib/phase-machine/` directory with reducers + tests;
  `src/lib/server/game.ts` deleted; `game-dispatcher.ts` introduced; components
  consume the discriminated union.
- The phrase "phase machine" in `docs/CONTEXT.md` matches what the code is.

## Open risks

1. **Vitest interaction with SvelteKit's experimental remote-functions / async
   compiler flags.** If `.test.ts` outside `src/routes/` triggers SvelteKit
   pre-processing, we may need to scope vitest's include/exclude carefully. Bail-out:
   put tests under a top-level `tests/` directory if `src/lib/` triggers issues.
2. **The `query.live` async-generator's interaction with the new dispatcher's
   subscribe contract.** Today the listener fires once on subscribe and on every
   state change. Keep this contract verbatim or the live updates break.
3. **Async effects ordering.** A `dispatch` may emit `notify-subscribers` synchronously
   while also kicking off `load-next-question` async. The current code is
   notify-then-async; preserve that order.
4. **Effect failure model.** `vote-question` fires-and-forgets a DB write. If it
   fails, in-memory state has already advanced. This matches today's behavior;
   document it and move on.
