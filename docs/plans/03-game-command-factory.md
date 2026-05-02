# Plan 03 — Game command factory

Implements deepening candidate **#9** from `docs/deepening-candidates.md`.
Vocabulary in `docs/CONTEXT.md` (Game command). Decisions locked in during
grilling are referenced inline.

## Goal

Replace the 9× `assertSession() + assertGame(code) + dispatch({ ..., playerId:
session.id, ... })` prefix in `game.remote.ts` with `gameCommand` / `gameForm`
factories. Standardize all remote schemas to `z.object({ code: z.string(),
...rest })`.

## Non-goals

- No changes to the `Action` union, the dispatcher, or any reducer.
- No changes to component callers' command-invocation shape — the schema
  standardization is internal to the remote layer; callers already pass `code`
  in an object for most commands.
- The `getGame` `query.live` stays open-coded — it's the only `query.live` and
  doesn't fit the command/form pattern. Skip.

## Strategy

Build the factory module first with full type safety, then convert the nine
commands. The factory's signature is small enough to land alongside the first
converted command for typecheck validation; the rest follow mechanically.

## Phase 1 — Build the factory module

**File to create:** `src/lib/server/game-command.ts`

Exports:

```ts
import { command, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { gameManager } from './game-manager';
import { assertSession } from './session';
import type { GameDispatcher } from './game-dispatcher';
import type * as z from 'zod';

interface Session {
	id: string;
	username: string;
}

interface GameCommandCtx {
	session: Session;
	game: GameDispatcher;
	mintId: () => string;
}

type CodeSchema = z.ZodObject<{ code: z.ZodString } & Record<string, z.ZodType>>;

const defaultMintId = () => crypto.randomUUID();

function resolve<S extends CodeSchema>(
	args: z.infer<S>
): { session: Session; game: GameDispatcher } {
	const session = assertSession();
	const game = gameManager.getGame(args.code);
	if (!game) error(404);
	return { session, game };
}

export function gameCommand<S extends CodeSchema>(
	schema: S,
	handler: (args: z.infer<S>, ctx: GameCommandCtx) => void
) {
	return command(schema, (args) => {
		const { session, game } = resolve<S>(args);
		handler(args, { session, game, mintId: defaultMintId });
	});
}

export function gameForm<S extends CodeSchema>(
	schema: S,
	handler: (args: z.infer<S>, ctx: GameCommandCtx) => void
) {
	return form(schema, (args) => {
		const { session, game } = resolve<S>(args);
		handler(args, { session, game, mintId: defaultMintId });
	});
}
```

Notes:

- The `Session` interface is duplicated locally rather than imported from
  `session.ts` — `session.ts` declares it un-exported. Either export it or
  duplicate. Prefer exporting from `session.ts` (one-line change).
- `assertGame` (currently inlined in `game.remote.ts:9-15`) moves into this
  module as the `resolve` helper. Delete the local `assertGame` from
  `game.remote.ts`.
- The `CodeSchema` constraint is the type-system enforcement that every game
  command's schema has a `code` field.

**Verify**

- `pnpm check` clean. The module is dead code — no callers yet.

## Phase 2 — Convert the nine commands

**File:** `src/routes/games/[code]/game.remote.ts`

Convert each command. Standardize all schemas to `z.object({ code:
z.string(), ...rest })`. After conversion the file should have no
`assertSession`, no `assertGame`, no `gameManager.getGame` calls — only
`gameCommand` / `gameForm` invocations and the live `getGame` query.

Pre/post for each command:

- `startGame` — schema `z.string()` → `z.object({ code: z.string() })`. Body:
  `(_, { game, session, mintId }) => game.dispatch({ type: 'start-game',
playerId: session.id, loadId: mintId() })`.
- `setCategories` — already object schema. Body uses `mintId` not needed.
- `submitAnswer` (form) — already object schema. Use `gameForm`. Body uses
  `mintId` for `answerId`.
- `toggleQuestionVote` — already object schema.
- `skipWord` — schema `z.string()` → `z.object({ code: z.string() })`.
  Caller side note: `WritingPhase.svelte` calls `skipWord(code)` — needs to
  become `skipWord({ code })`.
- `submitVote` — already object schema.
- `startNextRound` — already object schema.
- `endGame` — schema `z.string()` → `z.object({ code: z.string() })`.
  Caller-side update: there is no current caller (search to confirm); if a
  caller exists, update to `{ code }` form.
- `backToLobby` — schema `z.string()` → `z.object({ code: z.string() })`.
  Caller-side: `+page.svelte:74` calls `backToLobby(params.code)` — becomes
  `backToLobby({ code: params.code })`.

**Caller-side updates required (object-schema standardization):**

- `WritingPhase.svelte:82` — `skipWord(code)` → `skipWord({ code })`.
- `+page.svelte:74` — `backToLobby(params.code)` → `backToLobby({ code:
params.code })`.
- `startGame` callers — search; update to `{ code }` form.
- `endGame` callers — search; update if any.

**Verify**

- `pnpm check` clean.
- `pnpm lint` clean.
- `pnpm test` green (no test changes expected — these are remote-layer
  changes; reducer tests are unaffected).
- **Manual smoke** in `pnpm dev` with two browsers: full game flow exercising
  every command path — start, set categories, submit, skip, toggle question
  vote in both writing and scoring, vote, next round, end, back-to-lobby
  from error.

## Phase 3 — Cleanup

- Verify `assertGame` is gone from `game.remote.ts`.
- Verify `assertSession` is no longer imported in `game.remote.ts` (it's used
  only inside the factory module).
- `pnpm format`.

## Acceptance criteria

- Every command in `game.remote.ts` (except `getGame`) is built via
  `gameCommand` or `gameForm`.
- No remote command body contains `assertSession()` or `gameManager.getGame()`.
- All command schemas are `z.object({ code: z.string(), ...rest })`.
- Body of each command is a single `game.dispatch(...)` call.
- Component callers use the object form for every command.
- `pnpm check`, `pnpm lint`, `pnpm test` clean.
- Manual smoke covers every command path.

## Open risks

1. **`form` vs `command` semantics for `submitAnswer`.** Forms support
   progressive enhancement and have field metadata
   (`submitAnswer.fields.code.as('hidden', code)`). Verify the factory's
   `gameForm` preserves the `.fields` API on the returned object —
   SvelteKit's `form` returns a callable with extra properties. The factory
   wraps `form` directly; the return value should retain those properties.
   If TypeScript narrows away the form-specific properties, restructure the
   factory to return `form(...)` without spreading.
2. **Type narrowing on `args.code` inside the factory.** The
   `CodeSchema` generic constraint may not be enough for TS to narrow
   `args.code` to `string` inside `resolve`. If it doesn't work, fall back
   to `(args as { code: string }).code` inside `resolve` — the constraint
   guarantees correctness even without inference.
3. **`mintId` not used by every handler.** Some commands (e.g.
   `setCategories`) don't need IDs. The handler ignores the field —
   destructuring `{ game, session }` and skipping `mintId` is fine; TS
   doesn't complain about unused destructured properties when not using
   strict-unused-locals on patterns.
