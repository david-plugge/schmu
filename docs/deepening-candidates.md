# Deepening Candidates

Architectural friction points surfaced via `/improve-codebase-architecture`. Each candidate
identifies a **shallow module** (interface nearly as complex as the implementation) or
**smeared logic** (one concept requiring 3+ files to understand) and proposes a deepening —
turning a thin wrapper into a real module with locality and leverage.

Vocabulary (from the skill's `LANGUAGE.md`):

- **Module** — anything with an interface and an implementation.
- **Depth** — leverage at the interface; a lot of behaviour behind a small interface.
- **Seam** — where an interface lives.
- **Locality** — change, bugs, knowledge concentrated in one place.
- **Deletion test** — if I deleted this module, would complexity vanish, concentrate, or
  smear across N callers?

Status legend: `open` (not started), `picked` (currently being designed/grilled),
`in-progress`, `done`, `deferred` (with ADR), `rejected` (with ADR).

---

## 1. Phase is a string union; it wants to be a state-machine module

**Status:** done (see `docs/plans/01-phase-machine.md`)

**Files:**

- `src/lib/types.ts:3-12` — `GamePhase` union
- `src/lib/server/game.ts:68-81` — `transitionTo`
- `src/lib/server/game.ts:238-285` — `getGameState` (per-phase projection)
- 8 inline `if (this.phase !== 'X')` guards across action methods

**Problem:** Phase contract is smeared across three places — the union in `types.ts`, a
tiny transition switch with one real case in `game.ts:68`, and projection rules embedded
in `getGameState`. Two phases (`reading`, `winner`) are declared but never reached — dead
code in the contract. There's no single place that says "what does _voting_ mean? what
transitions are legal from _scoring_?" Each action method re-checks the phase manually.

**Solution:** Introduce a **phase machine** (see `CONTEXT.md`) — a pure, lib-side module
that owns phase identity, legal transitions, accepted actions, and the viewer
projection per phase. The server-side `GameInstance` shrinks to a thin dispatcher that
holds in-memory state, runs the transition function, and executes effects.

**Bug surfaced & fixed during smoke test:** the `query.live` async generator in
`game.remote.ts` had a race — it overwrote `state` on every notify but only re-armed
its `resolve` callback _after_ a yield was consumed. With the new async question
loading (`loading-question` → `writing` happens inside back-to-back microtasks), the
second notify dropped on the floor and the client hung in `loading-question`. Replaced
the `state + resolve?.()` pattern with a `latest + dirty + waiter` pattern that
buffers updates across the yield gap. The race was latent in the original code; only
the new async transitions made it observable.

### Decisions (locked in during grilling)

1. **Module location** — pure lib-side module at `src/lib/phase-machine/`; no Node
   imports. Server-side dispatcher in `src/lib/server/` imports it. Components import
   types only.
2. **Dead phases** — `reading` and `winner` are removed entirely. They are unreachable
   today.
3. **Reactive transitions** — the transition function is `(state, action) → { state,
effects: Effect[] }`. Readiness logic ("everyone has submitted") lives on phase
   edges as guards, not inside action methods.
4. **Action contract** — tagged union, one variant per verb. Player intents
   (`submit-answer`, `submit-vote`, `toggle-skip`, `toggle-question-vote`), host
   intents (`set-categories`, `start-game`, `end-game`, `back-to-lobby`), system
   intents (`next-round`, `question-loaded`, `question-load-failed`). Dispatcher
   attaches `playerId`.
5. **Pure transition + effects-as-data** — pure-state computation (scoring) is folded
   into the new state. I/O is described as `Effect` values (`load-next-question`,
   `vote-question`, `increment-times-played`, `notify-subscribers`) and executed by
   the dispatcher.
6. **`loading-question` kept** — async transitions are first-class. `start-game` and
   `next-round` transition into `loading-question` and emit a `load-next-question`
   effect with a fresh `loadId`. The dispatcher dispatches `question-loaded` /
   `question-load-failed` once the effect resolves; the reducer ignores resolutions
   whose `loadId` doesn't match the pending one (stale-load protection).
7. **`error` is recoverable** — accepts `back-to-lobby` and `end-game`.

### Product change folded in

`toggle-question-vote` is unified across `writing` and `scoring`: both phases accept
`'up'` or `'down'`. Today writing only allows downvotes; we decided upvotes during
writing are also fine. This folds part of candidate #2's vote-toggle dedupe into #1
because the unified action makes the two reducers symmetric.

### Design notes for the plan

- **UUID minting moves to the dispatcher.** Actions like `submit-answer` carry an
  `answerId` minted by the dispatcher before dispatch. Same for round identifiers.
  Keeps the transition function pure.
- **Effects are fire-and-forget by default.** `vote-question` and
  `increment-times-played` don't block transitions. Acceptable today (better-sqlite3
  is sync, failures would be programmer error). Worth flagging in the plan.
- **Viewer game state becomes a discriminated union by phase.** Components stop
  guarding optional fields — TS narrows per branch. This is the leverage win for the
  client.

**Benefits:** Locality — phase semantics in one module. Leverage — adding or changing
a phase is one new record. Tests — every reducer is a pure unit test
(`(state, action) → { state, effects }`); projection per phase is a pure function on
the round; the transition graph can be asserted explicitly.

---

## 2. `Round` is a passive struct; the rules around it are smeared across `GameInstance`

**Status:** done

**Outcome:** Pure-function `Round` module at `src/lib/phase-machine/round.ts` with
`addAnswer`, `recordPlayerVote` (returns `Round | null` — null = invalid: not found
or own answer; the "can't vote for own answer" invariant now lives on Round),
`toggleQuestionVote` (returns `{ round, delta }` — replaces the duplicated 25-line
toggle blocks in `writing.ts` and `scoring.ts`), `calculateRewardedPoints`, and
`withRewardedPoints`. 13 new unit tests on the round module; 60 tests total.
`helpers.ts` shrank — removed `toggleVote`, `questionVoteDelta`,
`calculateRewardedPoints`, and the reward constants (now on Round). `applyRewards`
stays in helpers because it operates on players, not Round.

**Files:**

- `src/lib/types.ts:65-84` — `Round` interface
- `src/lib/server/game.ts:116-205` — six methods poking Round fields
- `src/lib/server/game.ts:287-310` — `calculateScores`

**Problem:** `downvoteQuestion` (writing phase, lines 139–153) and `voteOnQuestion`
(scoring phase, 187–205) both mutate `currentRound.questionVotes` and compute a delta
to push to the DB — same operation, two implementations, slightly different toggle
semantics. `submitAnswer`, `submitVote`, and `calculateScores` all reach into Round's
fields directly. The invariant "you can't vote for your own answer" lives in
`submitVote`, not on Round.

**Solution sketch:** A Round module that owns `addAnswer`, `recordPlayerVote`,
`recordQuestionVote(player, vote|null) → delta`, `score()`. GameInstance asks Round to
do these; Round enforces invariants in one place.

**Benefits:** Locality — round logic in one module. Leverage — duplicated vote-toggle
becomes one method. Tests — scoring becomes a pure unit test on Round, no
game/players/phases needed. **Deletion test:** moving these methods _into_ Round
concentrates complexity exactly where it should be.

---

## 3. Player phase-state is three booleans pretending to be one enum

**Status:** rejected (see [ADR 0001](adr/0001-player-round-flags-stay-independent-booleans.md))

**Rejection summary:** The premise was wrong — the booleans are independent
facts, not one-of-N states. `submitted` and `skipped` can coexist in writing
phase (skip is a veto, submit is a commitment); `submitted` persists into voting
phase alongside `voted`. No invalid combinations to make unrepresentable, so the
deletion test yields no concentration of complexity.

**Files:**

- `src/lib/types.ts:18-21` — `hasSubmitted`, `hasVoted`, `hasSkipped` on `Player`
- `src/lib/server/game.ts:340-344` — manual reset block
- Readiness checks at `game.ts:132, 162, 180`

**Problem:** Three independent booleans encode an invariant they can't enforce: exactly
one applies per round, and all reset together at round start. The reset is a
hand-maintained 3-line block — adding a fourth state means remembering to update it.
Readiness checks are scattered (`every(p => p.hasSubmitted)`, `every(p => p.hasSkipped)`,
`every(p => p.hasVoted)`).

**Solution sketch:** A single `roundStatus: 'waiting' | 'submitted' | 'skipped' | 'voted'`
per player, reset by Round (see candidate 2) when a new round starts.

**Benefits:** Locality — invalid combinations unrepresentable. Leverage — readiness
checks unify on one field. Tests — readiness becomes testable on a player array alone.

---

## 4. `GameInstance` is a wide-interface, multi-concern module — the seam is in the wrong shape

**Status:** done (absorbed by candidate #1)

**Outcome:** The 363-line `GameInstance` class was deleted in #1 and replaced by
`GameDispatcher` (~90 lines) with one verb (`dispatch`) plus `subscribe`. The five
mixed concerns (validate / transition / project / persist / notify) are now separated:
validation and transition live in pure phase reducers (`phase-machine/phases/`),
projection is a pure function per phase, persistence is described as `Effect` values
and executed by the dispatcher, and listener fan-out is a tiny method. The remote
layer keeps 8 thin `command(...)` exports for per-action Zod validation; further
narrowing would lose ergonomics.

**Files:**

- `src/lib/server/game.ts` — 363-line class with 11 public methods
- `src/routes/games/[code]/game.remote.ts` — 109 lines that mirror those 11 methods 1:1

**Problem:** Every remote function is `assertSession + assertGame + game.X(session.id, ...)`.
The remote file is a thin RPC mirror; the GameInstance class is wide on both sides.
Inside, GameInstance mixes (a) action validation, (b) phase transitions and side effects,
(c) per-viewer projection, (d) DB writes, (e) listener fan-out. A bug in any of these
requires understanding all five.

**Solution sketch:** Narrow the seam to one verb — `dispatch(playerId, action)` where
action is a tagged union — and split the implementation along its concerns (validate,
transition, project, persist, notify).

**Benefits:** Leverage — adding a player action is one case + one remote handler, not 11
methods on both sides. Locality — concerns separate, each independently testable. Tests
— projection becomes a pure function of `(round, viewer)`.

**Note:** Likely interacts with #1 (state machine) and #2 (Round); pursue after those.

---

## 5. `db/questions.ts` is shallow; the question catalogue wants to be deep

**Status:** done

**Outcome:** New `src/lib/server/question-catalogue.ts` exports a
`QuestionCatalogue` interface (`pickNext`, `recordPlay`, `recordVote`) plus a
`createDbCatalogue()` factory backed by Drizzle. The catalogue tracks
`usedWords` internally per-game (created fresh in `GameManager.createGame`),
so the dispatcher no longer threads it through state and effects. Selection
policy (exclude used words, filter by category, order by play count + random)
now lives in one place. `usedWords` removed from `BaseState` and from the
`load-next-question` Effect. `db/questions.ts` deleted. Per the user's "no
fetch/LLM at runtime" call, the catalogue is sync; the dispatcher's
`handleLoad` dropped its async wrapper. Dispatcher tests updated to mock the
catalogue.

**Files:**

- `src/lib/server/db/questions.ts` — 40 lines, three thin Drizzle wrappers
- `src/lib/server/game.ts:3, 347-362` — callers
- `src/routes/words/words.remote.ts` — likely sibling caller

**Problem:** `getRandomQuestions`, `incrementTimesPlayed`, `voteQuestion` are 1:1 Drizzle
pass-throughs. **Deletion test:** inlining them adds ~6 lines and loses nothing.
Meanwhile, the actual selection policy — exclude words used this game, weight by
category, tiebreak by play count — is half in SQL `orderBy`/`where` and half in
`GameInstance.getUsedWords()`. The catalogue _has_ logic; it's just not in this module.

**Solution sketch:** Grow the module into a real question-catalogue module that owns
"give me the next question for this game" (used words, category prefs in; question out;
play count recorded). Don't keep a shallow wrapper around three Drizzle calls.

**Benefits:** Locality — selection policy in one module. Tests — catalogue rules testable
without standing up a game. **Deletion test:** today deleting it moves ~6 lines; after
deepening it would have load-bearing logic.

---

## 6. `GameManager` is a `Map` with a wrapper

**Status:** deferred (no current pain; Redis migration would reshape the problem)

**Reason:** After #1 absorbed the dead `endGame` method that motivated the
"asymmetric lifecycle" framing, `GameManager` is a 31-line wrapper around a
`Map` that adds no abstraction today. Two paths were considered:

- **Inline** the Map into a registry module (Path A) — cosmetic; the deletion
  test barely passes (~3 lines saved).
- **Deepen** with idle-timeout GC and `'ended'`-phase auto-cleanup (Path B) —
  introduces real product behaviour that isn't observably needed today.

Both paths sit awkwardly relative to a possible future Redis migration. Redis
would make Redis itself the source of truth: `getGame` becomes `EXISTS code`,
TTL handles idle expiry natively, no process-local Map is needed. Path B's
in-memory lifecycle work would be obviated. The Redis-relevant deepening is a
different one — extracting a `GameStore` interface from `GameDispatcher`'s
state-and-listeners ownership — which is bigger and only worth doing when
Redis is on a real roadmap.

Revisit if: (a) memory leaks become observable in production, (b) Redis (or
similar shared state) becomes a real requirement, or (c) end-of-game cleanup
becomes user-visible (e.g., a "your game expired" message).

**Files:**

- `src/lib/server/game-manager.ts` — 36 lines

**Problem:** `getGame` is `Map.get`. `createGame` / `joinGame` / `endGame` are 3-line
delegations to `GameInstance`. Asymmetry: "ending" must go through GameManager (because
it deletes from the Map), every other action goes through GameInstance. **Deletion test:**
today, replacing it with a Map lookup in a registry seam loses nothing.

**Solution sketch:** Either inline into a registry exposed at the request layer, _or_
make GameManager own something a Map can't — game expiration, lifecycle hooks,
snapshot/persistence (see open question below). The current shape is the worst of both.

**Benefits:** Locality — if it deepens, game lifecycle has an obvious home. Leverage —
features like "expire idle games" gain a place to live.

---

## 7. `InternalPlayer` and `ViewerPlayer` are structurally identical — the projection layer for players does no projection

**Status:** picked

**Files:**

- `src/lib/phase-machine/types.ts:40-48` — `InternalPlayer`
- `src/lib/phase-machine/types.ts:108-116` — `ViewerPlayer` (identical seven fields)
- All seven phase reducers do `players: state.players.map((p) => ({ ...p }))` in
  `project` (e.g. `writing.ts:90`, `voting.ts:56`, `scoring.ts:70`, `lobby.ts:79`,
  `loading-question.ts:69`, `error.ts:31`, `ended.ts`)

**Problem:** Two interfaces with the same shape under different names, plus a
shallow-copy `.map(p => ({...p}))` in every projection that produces no structural
change. The "viewer player" name suggests a divergence that doesn't exist; the
projection is paying the cost of separation (two type names, a copy per player per
state change per viewer) with no benefit. `+page.svelte:16-18` and
`PlayerList.svelte:10` independently re-derive "the current player" because that
information isn't on the projection.

**Solution sketch:** Collapse to one `Player` type and make the projection do
genuine per-viewer work — add `you: Player` to `BaseViewerState`. The
`ViewerPlayer` name disappears; the per-viewer "me" lookup happens once at
projection time instead of in two component files.

### Decisions (locked in during grilling)

1. **Collapse the type.** Drop `ViewerPlayer`; rename `InternalPlayer` → `Player`.
   The internal/viewer distinction stays where it does work — on the state type
   (`InternalState` vs `ViewerGameState`).
2. **Drop the seven defensive `.map` copies.** The projection crosses a
   serialization boundary (SvelteKit's `query.live` JSONs the value before it
   leaves the server), so client-side mutation can't reach internal state. A test
   that mutates a projection result is a test bug worth catching, not a reason to
   pre-copy.
3. **Add `you: Player` (non-null) to `BaseViewerState`.** Each phase's `project`
   computes it as `state.players.find(p => p.id === viewerId)!`. The non-null is
   sound because of #4.
4. **`GameDispatcher.subscribe(viewerId, ...)` enforces membership.** Throws if
   `viewerId` isn't in `state.players`. `game.remote.ts:getGame` catches and
   returns `error(403)`. Strangers can't reach the projection — matches the user's
   intent ("a stranger should not be able to view the game").
5. **All seven `Player` fields stay viewer-visible** (id, name, isHost, score,
   hasSubmitted, hasVoted, hasSkipped). The projection doesn't filter; it
   resolves `you`. ADR 0001 is unaffected — that decision is about how the round
   flags are _stored_, not about whether viewers see them.

**Benefits:** Locality — the "are you me?" question lives at the projection seam,
not in two components. Leverage — components stop importing `getLoggedInUser` to
recompute their own user; they read `state.you`. Tests — `subscribe` membership
guard becomes a unit-testable invariant; today the invariant is implicit and
enforced only by happenstance (every actual entrypoint goes through `joinGame` /
`createGame` first).

---

## 8. Phase components redo the discriminated union as ad-hoc flat props — the **viewer game state** seam stops at the page boundary

**Status:** picked (depends on #7)

**Files:**

- `src/routes/games/[code]/+page.svelte:35-69` — destructures every variant and
  rebuilds it as flat props for each phase component
- `src/routes/games/[code]/WritingPhase.svelte:9-16` — re-declares `Props` as
  `{ code, currentWord, currentPlayer, players, myQuestionVote }`
- `src/routes/games/[code]/VotingPhase.svelte`, `ScoringPhase.svelte`,
  `LobbyPhase.svelte` — same pattern; inconsistent shapes (some take
  `currentPlayer`, some take `isHost`, both derived from the same lookup at
  `+page.svelte:16-18`)
- `src/routes/games/[code]/PlayerList.svelte` — re-fetches `getLoggedInUser` to
  mark "ich"

**Problem:** `ViewerGameState` is a discriminated union — the leverage win
promised in plan 01 ("components stop guarding optional fields — TS narrows per
branch"). But the page un-narrows it back into flat props, and each phase
component declares its own prop shape with no structural link to the phase
variant. Adding a field to a phase's projection requires four mechanical touches:
the `ViewerGameState` variant, the phase's `project`, the page's
`<XPhase ...>` props, and the component's `Props`. Three of those four are pure
scaffolding.

**Solution sketch:** Each phase component takes one prop, the typed slice:
`state: Extract<ViewerGameState, { phase: 'X' }>`. The page becomes a thin
phase switch.

### Decisions (locked in during grilling)

1. **Component prop is the slice.** Each phase component:
   ```ts
   type Props = { state: Extract<ViewerGameState, { phase: 'writing' }> };
   ```
   Reads `state.code`, `state.players`, `state.you`, plus phase-specific fields.
2. **Drop the separate `code` prop everywhere.** It's already on
   `BaseViewerState.code`. One source of truth. Caller side: `<WritingPhase
{state} />`, no `code={params.code}`.
3. **`LobbyPhase` follows the same pattern.** No exception for the no-round phases.
4. **`PlayerList` takes `{ players, you }` explicitly**, not the whole slice.
   The component is phase-agnostic; declaring only what it needs is honest about
   the dependency. Drops the `getLoggedInUser` import.
5. **`+page.svelte:16-18` (`currentPlayer = $derived.by(...)`) disappears.** The
   "who is me?" question is answered by the projection, not the page.

**Benefits:** Locality — per-phase viewer shape lives once, in the reducer's
`project`. Leverage — adding a phase field is a one-line change in the projection;
the component sees it via the discriminated union immediately. Tests — the
projection's return type _is_ the contract; today the per-component `Props`
types aren't exercised structurally.

---

## 9. The remote layer is `assertSession + assertGame + dispatch` repeated nine times — the **dispatcher seam at the request layer** has no helper

**Status:** picked

**Files:**

- `src/routes/games/[code]/game.remote.ts:43-132` — nine commands, each begins
  with the same two-line prefix
- `src/routes/games/[code]/game.remote.ts:9-15` — `assertGame` helper
- `src/lib/server/session.ts:37-41` — `assertSession`

**Problem:** The dispatcher is the seam: one verb (`dispatch`), 11 actions. The
remote layer's job is to bind that seam to HTTP. Today every command duplicates
the three-step prefix:

```ts
const session = assertSession();
const game = assertGame(code);
game.dispatch({ type: '...', playerId: session.id, ... });
```

That prefix appears nine times. The `playerId: session.id` attachment isn't
enforced by types — `Action` declares `playerId: string`, so the dispatcher
would happily accept an action with the wrong `playerId`. The remote layer is the
only place where the user→action binding happens, but the binding is open-coded
and uncentralized.

**Solution sketch:** A `gameCommand` / `gameForm` factory pair that does the
prefix work once and forwards to the underlying `command` / `form` primitives
from `$app/server`.

### Decisions (locked in during grilling)

1. **Factory pair, not a single `gameAction`.** `gameCommand` wraps `command`;
   `gameForm` wraps `form`. They have different framework semantics (multipart,
   fields, progressive enhancement); separate names.
2. **Handler dispatches itself.** Signature `(args, ctx) => void` where
   `ctx = { session, game, mintId }`. The factory does
   `assertSession() + assertGame(args.code) + handler(args, ctx)`.
3. **Schemas standardize to `z.object({ code: z.string(), ...rest })`.** The
   five commands today using bare `z.string()` get wrapped. The factory always
   reads `args.code` to call `assertGame`.
4. **`mintId` lives on ctx.** Defaults to `crypto.randomUUID` at module scope.
   Mirrors the dispatcher's existing `DispatcherDeps.mintId` pattern. If a test
   seam is needed later, the factory grows an option then — don't pre-build.
5. **Module location.** New file `src/lib/server/game-command.ts`. Imports from
   `./session`, `./game-manager`. Re-exported from nowhere — remote files import
   directly.

**Sample shape:**

```ts
export const startGame = gameCommand(
	z.object({ code: z.string() }),
	(_, { game, session, mintId }) => {
		game.dispatch({ type: 'start-game', playerId: session.id, loadId: mintId() });
	}
);
```

**Benefits:** Locality — the user→action binding lives in one place, not nine.
Leverage — adding a player action is "declare schema + return action," no more
copy-paste of session/game scaffolding. Tests — the factory is testable in
isolation (mock `assertSession` / `gameManager`); today the prefix can't be
tested.

---

## 10. `transition.ts` and `project.ts` are mirror 7-case switches — the phase records want to be a registry

**Status:** picked

**Files:**

- `src/lib/phase-machine/transition.ts:10-41` — switch over `state.phase`,
  dispatch to each phase's `accepts.has(...) ? reduce : noop`
- `src/lib/phase-machine/project.ts:10-27` — switch over `state.phase`, dispatch
  to each phase's `project`
- `src/lib/phase-machine/phases/types.ts:12-16` — `PhaseRecord<P>` exists,
  suggesting a registry was already intended

**Problem:** The phase records are well-formed, but the lookup is open-coded as
two redundant switch statements. Adding a phase requires touching `Phase`,
`InternalState`, `ViewerGameState`, the new reducer file, _plus_ a case in
`transition.ts` and a case in `project.ts`. The last two are pure mechanical
scaffolding. The "phase record" abstraction implies a registry; today it's a
record without a registry.

**Solution sketch:** A `Record<Phase, PhaseRecord<P>>` registry; `transition` and
`project` become thin lookups against it.

### Decisions (locked in during grilling)

1. **The cast is acceptable.** `phaseRecords[state.phase].reduce(state as never,
action)` — single cast, two call sites. The runtime invariant
   (`record.phase === state.phase`) is verified once at registry construction
   via `as const satisfies { [P in Phase]: PhaseRecord<P> }`. TS can't see the
   invariant at the lookup site, but it's sound; the cast is the price for
   collapsing 7-case duplication into a single dictionary.
2. **Registry location: new file `src/lib/phase-machine/registry.ts`.** Both
   `transition.ts` and `project.ts` import from it. Don't bloat the barrel
   (`index.ts`).
3. **`accepts` stays on the phase record.** The gate
   `record.accepts.has(action.type)` stays inside `transition`; not promoted to
   the registry's keys. Status quo for that piece.

**Benefits:** Locality — phase orchestration lives in one dictionary. Leverage —
adding a phase is one entry in the registry; the two switch updates disappear.
Tests — both `transition` and `project` shrink to ~5 lines, no per-case branch
to cover; the per-phase reducers/projections are still testable in isolation as
today.

---

## 11. `loadId` is a hand-passed token across state/action/effect — the stale-load invariant wants its own seam

**Status:** open

**Files:**

- `src/lib/phase-machine/types.ts:60` — `loadId: string` on `loading-question` state
- `src/lib/phase-machine/types.ts:80, 81, 87, 91` — `loadId` on `start-game`, `next-round`,
  `question-loaded`, `question-load-failed` actions
- `src/lib/phase-machine/types.ts:100` — `loadId` on `load-next-question` Effect
- `src/lib/phase-machine/phases/loading-question.ts:21, 51` — duplicated `if
  (action.loadId !== state.loadId) return` guards
- `src/lib/phase-machine/phases/writing.ts:55-67` — fabricates `'skip:${correctAnswerId}'`
  because `toggle-skip` carries no `loadId`
- `src/lib/server/game-dispatcher.ts:88-91` — dispatcher echoes `effect.loadId` back into
  the resolution action
- `src/routes/games/[code]/game.remote.ts:50, 110` — remote layer mints loadIds via
  `mintId()` and threads them onto `start-game` / `next-round`

**Problem:** A single invariant — "ignore late resolutions of a load that's been
superseded" — is encoded as a token that travels through five surfaces (action → state
→ effect → dispatcher → resolution-action). Three different code paths produce loadIds:
the dispatcher mints two via `mintId()`; the writing reducer synthesizes a third
deterministically. The `'skip:'` prefix in writing.ts is the smell — a pure reducer has
no business minting identifiers, but the action it's processing didn't carry one. The
stale-check is duplicated (loading-question.ts:21 and :51).

**Solution sketch:** Replace the externally-minted token with a state-internal **load
generation counter**. Every transition into `loading-question` increments it; the
load-next-question effect carries the generation; resolution actions carry the
generation they were spawned for; the reducer rejects mismatches. The dispatcher no
longer mints loadIds. The writing-skip path stops fabricating IDs.

### Decisions (locked in during grilling)

1. **Counter location: `BaseState`, not `loading-question`-only.** A monotonic
   `loadGeneration: number` always present; `lobby`/`writing`/`voting`/`scoring` simply
   don't read it. Alternatives considered: a `pendingLoad: number | null` on base
   (rejected — adds the same "non-null in this phase" invariant the loadId field already
   has, just renamed); the field on `loading-question` only (rejected — the counter has
   to come *from somewhere* on entry, which puts it back on the action).
2. **Reducer increments, dispatcher does not.** Reducers stay pure; every `→
   loading-question` transition does `loadGeneration: state.loadGeneration + 1` and
   emits the load effect with that number. The dispatcher's `handleLoad` just runs
   `pickNext` and dispatches `question-loaded` / `question-load-failed` with
   `effect.generation`.
3. **Skip-triggered loads stop being special.** `writing`'s all-skipped path bumps the
   counter like any other entry. The `'skip:'` fabrication disappears.
4. **`mintId` keeps one caller per layer.** Dispatcher's `DispatcherDeps.mintId` retains
   `correctAnswerId` minting at resolution time. `gameCommand`'s `ctx.mintId` retains
   `submit-answer.answerId` minting. Loses `loadId` minting on `start-game` and
   `next-round`.
5. **Strict equality on the staleness check.** `action.generation ===
   state.loadGeneration`; same semantics as today. No "≥" / last-writer-wins logic
   because in-flight loads are always cardinality 1.

### Test surface after deepening

Three asserts on `loadingQuestionPhase.reduce` capture the full staleness contract:

- `(loading-question @ gen=5, question-loaded @ gen=5)` → transitions to writing
- `(loading-question @ gen=5, question-loaded @ gen=4)` → unchanged
- `(loading-question @ gen=5, question-load-failed @ gen=4)` → unchanged

Dispatcher-side: mock `pickNext`, observe that the resolution action carries
`effect.generation`.

### Blast radius

Single PR, ~12 files: 4 reducers, dispatcher's `handleLoad`, 2 `gameCommand` calls,
`Action` and `Effect` types, several phase reducer tests. All mechanical.

**Benefits:** Locality — staleness lives in one counter on state, not a token threaded
through five layers. Leverage — a fourth load-triggering path doesn't have to invent an
ID convention. Tests — staleness becomes a unit-test invariant on the loading-question
reducer alone.

**Deletion test:** removing the loadId field today breaks stale rejection (load-bearing).
Moving the responsibility from "five-surface token" to "single counter on state"
concentrates the invariant from 5 sites to 1. ✓

---

## 12. Phase components duplicate the "word card" visual idiom (and partly the question-vote toolbar)

**Status:** open

**Files:**

- `src/routes/games/[code]/WritingPhase.svelte:31-36` — word card ("Was ist eigentlich…")
- `src/routes/games/[code]/VotingPhase.svelte:23-26` — same card ("Was bedeutet…")
- `src/routes/games/[code]/ScoringPhase.svelte:17-20` — same card ("Was bedeutet…")
- `src/routes/games/[code]/WritingPhase.svelte:53-93` and
  `src/routes/games/[code]/ScoringPhase.svelte:82-106` — thumbs-up/down toolbar wired to
  `toggleQuestionVote`, near-identical Tailwind classes, slightly drifted layout

**Problem:** Three phase components carry copy-pasted markup for the same UI primitive.
The "word card" is the visual language for "the current Word" (a glossary concept) — but
it isn't a component, just markup. The thumbs-up/down toolbar appears in two phases with
slightly drifted styling. A change to the card's gradient or the toolbar's hover state
requires three (or two) edits with no compiler help. Adding a fourth phase that needs
the card means a fourth copy.

**Solution sketch:** Extract `WordCard.svelte` (props: `prompt`, `word`) and
`QuestionVoteToolbar.svelte` (props: `code`, `myQuestionVote`, optional skip slot for
writing). Phase components import them. The "word card" becomes a real module owned at
the route level.

**Open design questions to resolve at grilling time:**

1. Where do the new components live — `src/routes/games/[code]/` (route-local) or
   `src/lib/components/`? Likely route-local; they're game-specific.
2. Does the toolbar's writing-phase variant (which includes a `skipWord` button + count)
   take a slot, a discriminated-union `mode: 'writing' | 'scoring'` prop, or stay as two
   sibling components? The writing variant has more state (`skipCount`,
   `you.hasSkipped`) — a `mode` prop may be cleanest, but slot keeps them decoupled.
3. Is the prompt copy ("Was ist eigentlich…" vs "Was bedeutet…") meaningful UX or
   incidental drift? If incidental, drop one — fewer props.

**Benefits:** Locality — the visual contract for "displaying the Word" lives once.
Leverage — restyling, A/B testing the prompt copy, or i18n is a single edit. Tests —
component-level snapshot is feasible per primitive instead of per phase.

**Deletion test:** today, deleting any one copy breaks one phase. After extraction, the
card's complexity concentrates in one file. ✓

---

## 13. `helpers.ts` is a kitchen sink — three unrelated concerns under a non-name

**Status:** open

**Files:**

- `src/lib/phase-machine/helpers.ts` — exports `extractBase` (state plumbing), `hashSeed`
  / `mulberry32` / `shuffleSeeded` (RNG + answer-shuffling fairness), `findPlayer` /
  `isHost` / `updatePlayer` / `resetRoundFlags` / `applyRewards` (player ops + scoring)

**Problem:** Three semantic groups bundled under one filename:

1. **Answer-shuffling fairness** (`hashSeed`, `mulberry32`, `shuffleSeeded`) — genuine
   domain logic enforcing the invariant "every player sees answers in the same order"
   (CONTEXT.md, Answer). The invariant is invisible because the function is named
   generically; a reader has to trace `shuffleSeeded` → `mulberry32` → hash logic to
   understand it's intentional anti-cheating design.
2. **Player ops** (`findPlayer`, `isHost`, `updatePlayer`, `resetRoundFlags`,
   `applyRewards`) — `findPlayer` and `isHost` are pass-through wrappers around
   `players.find` / `?.isHost === true` (deletion test for these specifically: inlining
   loses nothing, they are themselves shallow). `updatePlayer`, `resetRoundFlags`,
   `applyRewards` do real work (concentrate the immutable-update pattern).
3. **State plumbing** (`extractBase`, `BaseFields`) — concentrates "what survives a phase
   transition," used at every phase-edge. Real, but belongs near the state-shape
   definition.

**Solution sketch:**

- Create `src/lib/phase-machine/answer-shuffling.ts` — owns the fairness invariant + RNG.
  Narrow public surface: `shuffleAnswersForRound(answers, questionId)`. Add a property
  test asserting determinism per `questionId`.
- Move `extractBase` and `BaseFields` into `types.ts` next to `BaseState`.
- Inline `findPlayer` and `isHost` (one-liners that hide nothing). Keep `updatePlayer`,
  `resetRoundFlags`, `applyRewards` — they earn their keep.
- Decide: do the surviving immutable-update helpers stay in a renamed file (e.g.
  `player.ts`) or move into `round.ts` / phase reducers? Probably the former.

**Open design questions to resolve at grilling time:**

1. Does `applyRewards` belong in `round.ts` (it's scoring; round.ts already has
   `calculateRewardedPoints`) or stay with player ops (it operates on the players array)?
2. Does `extractBase` move into `types.ts` or `initial.ts`? `types.ts` is the canonical
   shape file; arguably the better home.
3. Worth introducing a `phase-machine/rng.ts` with `hashSeed`/`mulberry32` separate from
   `answer-shuffling.ts`, or fold both into the latter? Fold — there's only one consumer
   of the RNG, and naming it `answer-shuffling` is the load-bearing semantic step.

**Benefits:** Locality — answer-fairness rule has a semantic home; "what survives a
phase transition" sits next to `BaseState`. Leverage — small; mostly readability. Tests
— the fairness invariant becomes a property test on a named module instead of an
untested `shuffleSeeded`.

**Deletion test:** Mixed signal. Splitting `shuffleSeeded` → `answer-shuffling`
concentrates a domain rule (✓). Inlining `findPlayer` / `isHost` removes shallowness (✓).
The `extractBase` move and the rename of the survivors are organizational, not
deepening. Worth doing as a small house-cleaning PR; not a "leverage win" candidate.

---

## Open architectural question (not a deepening, possibly an ADR)

**Persistence is asymmetric.** `schema.ts` has `questions` and `rejected_words` only.
Question metadata (votes, play count) persists; gameplay (rounds, answers, scores, who
voted for whom) does not. A server restart wipes every active game; there's no post-game
audit trail. This may be intentional (small project, ephemeral fun) — but it's not
currently _recorded_ as a decision. If we reject deepening this seam, an ADR ("game
state is intentionally volatile because…") would prevent it being re-suggested.
