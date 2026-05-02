# schmu

Multiplayer word-bluff game (SvelteKit + SQLite). Players invent fake definitions for obscure words and vote.

## Stack

- **SvelteKit** with Node adapter; **Svelte 5 runes** (no legacy syntax)
- **Experimental flags on**: `kit.experimental.remoteFunctions` (`*.remote.ts`) and `compilerOptions.experimental.async` (await in components/$derived)
- **Drizzle ORM** + `better-sqlite3` (`./data/schmu.db`); schema at `src/lib/server/db/schema.ts`
- **Tailwind v4** + `bits-ui` (shadcn-style components in `src/lib/components/ui`)
- **AI SDK** (`ai` + `@ai-sdk/deepseek`) for question generation
- **pnpm** only; use package.json scripts (`dev`, `check`, `lint`, `format`, `db:push`, `db:seed`)

## Layout

- `src/lib/server/` — `game-manager.ts` (in-memory game state), `game.ts`, `session.ts`, `ai.ts`, `db/`
- `src/routes/games/[code]/` — game UI; remote functions in `*.remote.ts`
- `src/lib/types.ts` — shared `GameState`/`Player`/`Round` types

## Svelte MCP — mandatory when touching Svelte/SvelteKit

1. `list-sections` first to find relevant docs
2. `get-documentation` for every relevant section before writing code
3. `svelte-autofixer` on any Svelte code you produce; loop until clean
4. `playground-link` only if user asks AND code wasn't written to files
