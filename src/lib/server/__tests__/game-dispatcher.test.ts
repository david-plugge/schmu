import { describe, expect, it, vi } from 'vitest';
import type { Question } from '$lib/phase-machine';
import { GameDispatcher, type DispatcherDeps } from '../game-dispatcher';

function flush() {
	return new Promise((r) => setTimeout(r, 0));
}

function makeDeps(overrides: Partial<DispatcherDeps> = {}): DispatcherDeps {
	let counter = 0;
	return {
		loadQuestion: vi.fn(),
		voteQuestion: vi.fn(),
		incrementTimesPlayed: vi.fn(),
		mintId: () => `id-${++counter}`,
		...overrides
	};
}

const Q: Question = { id: 42, word: 'Schmu', definition: 'Real definition' };

describe('GameDispatcher', () => {
	it('subscribe fires immediately with current viewer state', () => {
		const d = new GameDispatcher('ABCD', makeDeps());
		const cb = vi.fn();
		d.subscribe('p1', cb);
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].phase).toBe('lobby');
	});

	it('dispatches actions and notifies subscribers on state change', () => {
		const d = new GameDispatcher('ABCD', makeDeps());
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].phase).toBe('lobby');
		expect(cb.mock.calls[0][0].players).toHaveLength(1);
	});

	it('does not notify when reducer rejects an action', () => {
		const d = new GameDispatcher('ABCD', makeDeps());
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: false });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		// non-host start-game → reducer rejects
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		expect(cb).not.toHaveBeenCalled();
	});

	it('async load resolves into writing', async () => {
		const deps = makeDeps({
			loadQuestion: vi.fn().mockResolvedValue(Q)
		});
		const d = new GameDispatcher('ABCD', deps);
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		// loading-question phase
		expect(cb.mock.calls[0][0].phase).toBe('loading-question');
		await flush();
		// writing phase after load resolves
		const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
		expect(lastCall[0].phase).toBe('writing');
		expect(lastCall[0].currentWord).toBe('Schmu');
		expect(deps.incrementTimesPlayed).toHaveBeenCalledWith(42);
	});

	it('stale question-loaded is ignored when host returned to lobby', async () => {
		let resolveLoad!: (q: Question | null) => void;
		const deps = makeDeps({
			loadQuestion: vi
				.fn()
				.mockImplementation(() => new Promise<Question | null>((r) => (resolveLoad = r)))
		});
		const d = new GameDispatcher('ABCD', deps);
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		// Simulate the load failing while user goes back-to-lobby in error phase
		resolveLoad(null); // null question → question-load-failed
		await flush();
		expect(deps.incrementTimesPlayed).not.toHaveBeenCalled();
		// Now in error phase
		const cb = vi.fn();
		d.subscribe('p1', cb);
		expect(cb.mock.calls[0][0].phase).toBe('error');
	});

	it('vote-question effect calls the DB', async () => {
		const deps = makeDeps({ loadQuestion: vi.fn().mockResolvedValue(Q) });
		const d = new GameDispatcher('ABCD', deps);
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		await flush();
		// now in writing
		d.dispatch({ type: 'toggle-question-vote', playerId: 'p1', vote: 'down' });
		expect(deps.voteQuestion).toHaveBeenCalledWith(42, -1);
	});

	it('load failure surfaces error phase', async () => {
		const deps = makeDeps({
			loadQuestion: vi.fn().mockRejectedValue(new Error('db down'))
		});
		const d = new GameDispatcher('ABCD', deps);
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		await flush();
		const last = cb.mock.calls[cb.mock.calls.length - 1][0];
		expect(last.phase).toBe('error');
		expect(last.reason).toBe('db down');
	});
});
