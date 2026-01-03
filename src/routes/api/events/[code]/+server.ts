import { gameManager } from '$lib/server/game-manager';
import { getSession } from '$lib/server/session';
import { error } from '@sveltejs/kit';

export const GET = ({ params: { code } }) => {
	const session = getSession();
	if (!session) {
		error(403);
	}

	const currentGame = gameManager.getGame(code);
	if (!currentGame) error(404);

	const { promise: closeStreamPromise, resolve: closeStream } = Promise.withResolvers<void>();

	const stream = new ReadableStream({
		start(controller) {
			const unsubscribe = currentGame.subscribe((state) => {
				const data = JSON.stringify(state);
				controller.enqueue(`data: ${data}\n\n`);
			});

			closeStreamPromise.then(unsubscribe);
		},
		cancel() {
			closeStream();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
