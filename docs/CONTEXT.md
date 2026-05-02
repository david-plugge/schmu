# Context: Domain language

The source of truth for the names of things in schmu. Use these terms exactly when
discussing, documenting, or writing code; consistent vocabulary is what makes the
codebase navigable for humans and AI alike.

If a new concept emerges during design work, add it here.

## Core domain

### Game

A session identified by a 4-character code. Has players, a current **phase**, and a
sequence of **rounds**. Created in `lobby`; plays N rounds; ends when the host calls
`end-game`. Game state today is in-memory only (see the open persistence question in
`deepening-candidates.md`).

### Player

A participant in a game. Exactly one is the **host** — they created the game and can
configure categories, start the game, and end it. Each player has a score that
accumulates across rounds. The `Player` type is shared between internal state and
viewer projection — there is no "viewer player" variant; the divergence between
internal and viewer state lives on the state types, not the player.

### Round

One play cycle within a game: a **question** is loaded, players write fake
**answers**, players **vote**, scores are tallied. The `Round` object holds the
question reference, all answers (one real + up to one per player), the player votes,
the question votes, and the rewarded points for the round.

### Question

A persisted **word** + **definition** + category, stored in SQLite. Has aggregate
metadata (`votes`, `timesPlayed`) updated as games play out. The question catalogue
is shared across all games.

### Word

The obscure German word being defined in a round. Comes from a Question.

### Definition

The real meaning of the Word, stored on the Question.

### Answer

What players see during the **voting** phase: a candidate definition for the Word,
either the real Definition (one per round, owned by `system`) or a player-submitted
fake (owned by `player`). Answers are shuffled deterministically using the question
id as a seed so every player sees the same order.

### Vote

A player's pick during the voting phase — which Answer they believe is the real
Definition. Distinct from a **question vote** (up/down) which records an opinion of
the Question itself and flows back to the persistent Question's vote count.

## Phase model

### Phase

A named state in a game's lifecycle. Legal phases:

- `lobby` — players join; host configures categories
- `loading-question` — async fetch of the next Question (DB today, possibly LLM
  later)
- `writing` — players submit fake answers; players may also up/downvote the Question
- `voting` — players pick the answer they believe is the real Definition
- `scoring` — results shown; players may up/downvote the Question
- `error` — question fetch failed; only `back-to-lobby` and `end-game` are accepted
- `ended` — host ended the game

### Phase machine

The pure, lib-side module that owns phase identity, legal transitions, the actions
each phase accepts, and the viewer projection per phase. Importable from components
(no Node imports). The server-side dispatcher wraps it, holds in-memory state, and
executes effects.

### Action

A tagged-union value representing player, host, or system intent. The phase
machine's transition function processes actions; the dispatcher attaches the
acting player's id before dispatch.

### Effect

A data description of a side effect (DB write, async load, subscriber notification)
produced by the transition function and executed by the dispatcher. Keeps the phase
machine pure and testable.

### Viewer game state

The per-player projection of internal game state, shaped as a discriminated union
keyed by phase. Each phase exposes only the fields meaningful for that phase — no
defensive optionals on the client. Includes a `you: Player` field — the viewer's
own player record, resolved at projection time from the viewer id. Non-null because
`GameDispatcher.subscribe` rejects non-member viewers; strangers can't reach the
projection.

### Phase record

Per-phase tuple of `accepts` (which actions this phase processes), `reduce` (pure
state transition), and `project` (pure per-viewer projection). Lives in
`src/lib/phase-machine/phases/<phase>.ts`. The full set is collected into a
**phase registry** at `src/lib/phase-machine/registry.ts`, indexed by phase name;
`transition` and `project` are thin lookups against the registry.

### Game command

A remote function (or form) that binds the dispatcher seam to HTTP. Built via the
`gameCommand` / `gameForm` factories in `src/lib/server/game-command.ts`, which
run `assertSession` and `assertGame(args.code)` and pass `{ session, game, mintId }`
to the handler. The handler dispatches a single Action; `playerId` is sourced
from the session and never forged by callers.
