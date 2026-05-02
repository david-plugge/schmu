import { command, form, query } from '$app/server';
import { gameManager } from '$lib/server/game-manager';
import { assertSession } from '$lib/server/session';
import type { ViewerGameState } from '$lib/phase-machine';
import { CATEGORY_SLUGS } from '$lib/categories';
import { error } from '@sveltejs/kit';
import z from 'zod';

const assertGame = (code: string) => {
	const game = gameManager.getGame(code);
	if (!game) {
		error(404);
	}
	return game;
};

export const getGame = query.live(z.string(), async function* (code) {
	const session = assertSession();
	const game = assertGame(code);
	let latest!: ViewerGameState;
	let dirty = false;
	let waiter: (() => void) | undefined;
	const unsub = game.subscribe(session.id, (state) => {
		latest = state;
		dirty = true;
		waiter?.();
		waiter = undefined;
	});

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

export const startGame = command(z.string(), (code) => {
	const session = assertSession();
	const game = assertGame(code);
	game.dispatch({
		type: 'start-game',
		playerId: session.id,
		loadId: crypto.randomUUID()
	});
});

export const setCategories = command(
	z.object({
		code: z.string(),
		categories: z.array(z.enum(CATEGORY_SLUGS)).min(1)
	}),
	({ code, categories }) => {
		const session = assertSession();
		const game = assertGame(code);
		game.dispatch({ type: 'set-categories', playerId: session.id, categories });
	}
);

export const submitAnswer = form(
	z.object({
		code: z.string(),
		answer: z.string().min(1)
	}),
	({ answer, code }) => {
		const session = assertSession();
		const game = assertGame(code);
		game.dispatch({
			type: 'submit-answer',
			playerId: session.id,
			answerId: crypto.randomUUID(),
			text: answer
		});
	}
);

export const toggleQuestionVote = command(
	z.object({
		code: z.string(),
		vote: z.enum(['up', 'down'])
	}),
	({ code, vote }) => {
		const session = assertSession();
		const game = assertGame(code);
		game.dispatch({ type: 'toggle-question-vote', playerId: session.id, vote });
	}
);

export const skipWord = command(z.string(), (code) => {
	const session = assertSession();
	const game = assertGame(code);
	game.dispatch({ type: 'toggle-skip', playerId: session.id });
});

export const submitVote = command(
	z.object({
		code: z.string(),
		answerId: z.string().min(1)
	}),
	({ answerId, code }) => {
		const session = assertSession();
		const game = assertGame(code);
		game.dispatch({ type: 'submit-vote', playerId: session.id, answerId });
	}
);

export const startNextRound = command(z.object({ code: z.string() }), ({ code }) => {
	const session = assertSession();
	const game = assertGame(code);
	game.dispatch({
		type: 'next-round',
		playerId: session.id,
		loadId: crypto.randomUUID()
	});
});

export const endGame = command(z.string(), (code) => {
	const session = assertSession();
	const game = assertGame(code);
	game.dispatch({ type: 'end-game', playerId: session.id });
});

export const backToLobby = command(z.string(), (code) => {
	const session = assertSession();
	const game = assertGame(code);
	game.dispatch({ type: 'back-to-lobby', playerId: session.id });
});
