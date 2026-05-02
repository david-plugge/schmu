import { query } from '$app/server';
import { gameManager } from '$lib/server/game-manager';
import { gameCommand, gameForm } from '$lib/server/game-command';
import { NotAMemberError } from '$lib/server/game-dispatcher';
import { assertSession } from '$lib/server/session';
import { error } from '@sveltejs/kit';
import type { ViewerGameState } from '$lib/phase-machine';
import { CATEGORY_SLUGS } from '$lib/categories';
import z from 'zod';

export const getGame = query.live(z.string(), async function* (code) {
	const session = assertSession();
	const game = gameManager.getGame(code);
	if (!game) error(404);
	let latest!: ViewerGameState;
	let dirty = false;
	let waiter: (() => void) | undefined;
	let unsub: () => void;
	try {
		unsub = game.subscribe(session.id, (state) => {
			latest = state;
			dirty = true;
			waiter?.();
			waiter = undefined;
		});
	} catch (err) {
		if (err instanceof NotAMemberError) error(403);
		throw err;
	}

	try {
		while (true) {
			if (!dirty) {
				await new Promise<void>((r) => (waiter = r));
			}
			dirty = false;
			yield latest;
		}
	} finally {
		unsub();
	}
});

export const startGame = gameCommand(
	z.object({ code: z.string() }),
	(_, { game, session, mintId }) => {
		game.dispatch({
			type: 'start-game',
			playerId: session.id,
			loadId: mintId()
		});
	}
);

export const setCategories = gameCommand(
	z.object({
		code: z.string(),
		categories: z.array(z.enum(CATEGORY_SLUGS)).min(1)
	}),
	({ categories }, { game, session }) => {
		game.dispatch({ type: 'set-categories', playerId: session.id, categories });
	}
);

export const submitAnswer = gameForm(
	z.object({
		code: z.string(),
		answer: z.string().min(1)
	}),
	({ answer }, { game, session, mintId }) => {
		game.dispatch({
			type: 'submit-answer',
			playerId: session.id,
			answerId: mintId(),
			text: answer
		});
	}
);

export const toggleQuestionVote = gameCommand(
	z.object({
		code: z.string(),
		vote: z.enum(['up', 'down'])
	}),
	({ vote }, { game, session }) => {
		game.dispatch({ type: 'toggle-question-vote', playerId: session.id, vote });
	}
);

export const skipWord = gameCommand(z.object({ code: z.string() }), (_, { game, session }) => {
	game.dispatch({ type: 'toggle-skip', playerId: session.id });
});

export const submitVote = gameCommand(
	z.object({
		code: z.string(),
		answerId: z.string().min(1)
	}),
	({ answerId }, { game, session }) => {
		game.dispatch({ type: 'submit-vote', playerId: session.id, answerId });
	}
);

export const startNextRound = gameCommand(
	z.object({ code: z.string() }),
	(_, { game, session, mintId }) => {
		game.dispatch({
			type: 'next-round',
			playerId: session.id,
			loadId: mintId()
		});
	}
);

export const endGame = gameCommand(z.object({ code: z.string() }), (_, { game, session }) => {
	game.dispatch({ type: 'end-game', playerId: session.id });
});

export const backToLobby = gameCommand(z.object({ code: z.string() }), (_, { game, session }) => {
	game.dispatch({ type: 'back-to-lobby', playerId: session.id });
});
