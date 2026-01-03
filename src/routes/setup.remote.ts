import { resolve } from '$app/paths';
import { form, query } from '$app/server';
import { gameManager } from '$lib/server/game-manager';
import { getSession, assertSession, setSession, clearSession } from '$lib/server/session';
import { invalid, redirect } from '@sveltejs/kit';
import * as z from 'zod';

export const login = form(
	z.object({
		username: z.string().min(4)
	}),
	async ({ username }) => {
		console.log('login', { username });

		const id = crypto.randomUUID();

		setSession({
			id,
			username: username
		});
	}
);

export const logout = form(() => {
	clearSession();
});

export const getUser = query(() => {
	console.log('getUser', getSession());

	return getSession();
});

export const getLoggedInUser = query(() => {
	return assertSession();
});

export const joinGame = form(
	z.object({
		code: z.string()
	}),
	({ code }, issue) => {
		const session = assertSession();
		try {
			gameManager.joinGame(code, session.id, session.username);
		} catch {
			invalid(issue.code('Spiel nicht gefunden'));
		}
		redirect(303, resolve('/games/[code]', { code }));
	}
);

export const createGame = form(() => {
	const session = assertSession();
	const code = gameManager.createGame(session.id, session.username);
	redirect(303, resolve('/games/[code]', { code }));
});
