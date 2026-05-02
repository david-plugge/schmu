import { command, form, query } from '$app/server';
import { gameManager } from '$lib/server/game-manager';
import { assertSession } from '$lib/server/session';
import type { GameState } from '$lib/types';
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
	const game = assertGame(code);
	let state!: GameState;
	let resolve: (() => void) | undefined;
	const unsub = game.subscribe((_state) => {
		state = _state;
		resolve?.();
	});

	try {
		while (true) {
			yield state;
			await new Promise<void>((r) => (resolve = r));
		}
	} finally {
		unsub();
	}
});

export const startGame = command(z.string(), (code) => {
	const session = assertSession();
	const game = assertGame(code);
	game.startGame(session.id);
});

export const submitAnswer = form(
	z.object({
		code: z.string(),
		answer: z.string().min(1)
	}),
	({ answer, code }) => {
		const session = assertSession();
		const game = assertGame(code);
		game.submitAnswer(session.id, answer);
	}
);

export const submitVote = command(
	z.object({
		code: z.string(),
		answerId: z.string().min(1)
	}),
	({ answerId, code }) => {
		const session = assertSession();
		const game = assertGame(code);
		game.submitVote(session.id, answerId);
	}
);

export const startNextRound = command(z.object({ code: z.string() }), ({ code }) => {
	assertSession();
	const game = assertGame(code);

	game.nextRound();
});
