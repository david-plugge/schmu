import { command, form } from '$app/server';
import { error } from '@sveltejs/kit';
import type * as z from 'zod';
import { gameManager } from './game-manager';
import { assertSession, type Session } from './session';
import type { GameDispatcher } from './game-dispatcher';

interface GameCommandCtx {
	session: Session;
	game: GameDispatcher;
	mintId: () => string;
}

// Schemas passed to gameCommand / gameForm must produce an object containing `code: string`.
// Enforced at the call site by typing the handler's `args.code` as string; runtime is sound
// because the schema validates the field shape before the handler runs.
type WithCode = { code: string };

const defaultMintId = () => crypto.randomUUID();

function resolveCtx(args: WithCode): GameCommandCtx {
	const session = assertSession();
	const game = gameManager.getGame(args.code);
	if (!game) error(404);
	return { session, game, mintId: defaultMintId };
}

export function gameCommand<S extends z.ZodObject>(
	schema: S,
	handler: (args: z.infer<S> & WithCode, ctx: GameCommandCtx) => void
) {
	return command(schema, (args) => {
		const typed = args as z.infer<S> & WithCode;
		handler(typed, resolveCtx(typed));
	});
}

export function gameForm<S extends z.ZodObject>(
	schema: S,
	handler: (args: z.infer<S> & WithCode, ctx: GameCommandCtx) => void
) {
	// SvelteKit's `form` expects the schema's output to satisfy `RemoteFormInput` (a
	// record of form-postable primitives). Zod's generic object inference is wider
	// than that; cast around it. Runtime is sound — only zod object schemas reach here.
	return form(schema as never, (args) => {
		const typed = args as z.infer<S> & WithCode;
		handler(typed, resolveCtx(typed));
	});
}
