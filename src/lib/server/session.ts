import { resolve } from '$app/paths';
import { getRequestEvent } from '$app/server';
import { redirect, type RequestEvent } from '@sveltejs/kit';

const sessionCookieName = 'session';

type CookieOpts = Parameters<RequestEvent['cookies']['set']>[2];

const cookieOptions: CookieOpts = {
	path: '/',
	secure: false,
	httpOnly: true
};

export interface Session {
	id: string;
	username: string;
}

export function getSession(): Session | null {
	const { cookies } = getRequestEvent();

	const sessionStr = cookies.get(sessionCookieName);

	if (!sessionStr) {
		return null;
	}

	try {
		const session: Session = JSON.parse(sessionStr);
		return session;
	} catch {
		return null;
	}
}

export function assertSession() {
	const session = getSession();
	if (!session) redirect(303, resolve('/'));
	return session;
}

export function setSession(session: Session) {
	const { cookies } = getRequestEvent();

	const sessionStr = JSON.stringify(session);

	cookies.set(sessionCookieName, sessionStr, cookieOptions);
}

export function clearSession() {
	const { cookies } = getRequestEvent();

	cookies.delete(sessionCookieName, cookieOptions);
}
