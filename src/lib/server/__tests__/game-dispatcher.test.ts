import { describe, expect, it, vi } from 'vitest';
import type { Question } from '$lib/phase-machine';
import { GameDispatcher, NotAMemberError, type DispatcherDeps } from '../game-dispatcher';
import type { QuestionCatalogue } from '../question-catalogue';

function makeCatalogue(overrides: Partial<QuestionCatalogue> = {}): QuestionCatalogue {
	return {
		pickNext: vi.fn(),
		recordPlay: vi.fn(),
		recordVote: vi.fn(),
		...overrides
	};
}

function makeDeps(overrides: Partial<DispatcherDeps> = {}): DispatcherDeps {
	let counter = 0;
	return {
		catalogue: makeCatalogue(),
		mintId: () => `id-${++counter}`,
		...overrides
	};
}

const Q: Question = { id: 42, word: 'Schmu', definition: 'Real definition' };

describe('GameDispatcher', () => {
	it('subscribe fires immediately with current viewer state', () => {
		const d = new GameDispatcher('ABCD', makeDeps());
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].phase).toBe('lobby');
	});

	it('subscribe throws NotAMemberError for non-member viewers', () => {
		const d = new GameDispatcher('ABCD', makeDeps());
		expect(() => d.subscribe('stranger', vi.fn())).toThrow(NotAMemberError);
		// even after a member joins, the stranger is still rejected
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		expect(() => d.subscribe('stranger', vi.fn())).toThrow(NotAMemberError);
	});

	it('dispatches actions and notifies subscribers on state change', () => {
		const d = new GameDispatcher('ABCD', makeDeps());
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'add-player', playerId: 'p2', name: 'Bob', isHost: false });
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].phase).toBe('lobby');
		expect(cb.mock.calls[0][0].players).toHaveLength(2);
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

	it('catalogue.pickNext returning a question lands in writing', () => {
		const catalogue = makeCatalogue({ pickNext: vi.fn().mockReturnValue(Q) });
		const d = new GameDispatcher('ABCD', makeDeps({ catalogue }));
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		const last = cb.mock.calls[cb.mock.calls.length - 1][0];
		expect(last.phase).toBe('writing');
		expect(last.currentWord).toBe('Schmu');
		expect(catalogue.recordPlay).toHaveBeenCalledWith(42);
	});

	it('catalogue.pickNext returning null surfaces error phase', () => {
		const catalogue = makeCatalogue({ pickNext: vi.fn().mockReturnValue(null) });
		const d = new GameDispatcher('ABCD', makeDeps({ catalogue }));
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		const last = cb.mock.calls[cb.mock.calls.length - 1][0];
		expect(last.phase).toBe('error');
		expect(last.reason).toBe('no-questions');
		expect(catalogue.recordPlay).not.toHaveBeenCalled();
	});

	it('vote-question effect calls catalogue.recordVote', () => {
		const catalogue = makeCatalogue({ pickNext: vi.fn().mockReturnValue(Q) });
		const d = new GameDispatcher('ABCD', makeDeps({ catalogue }));
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		// now in writing
		d.dispatch({ type: 'toggle-question-vote', playerId: 'p1', vote: 'down' });
		expect(catalogue.recordVote).toHaveBeenCalledWith(42, -1);
	});

	it('catalogue.pickNext throwing surfaces error phase', () => {
		const catalogue = makeCatalogue({
			pickNext: vi.fn().mockImplementation(() => {
				throw new Error('db down');
			})
		});
		const d = new GameDispatcher('ABCD', makeDeps({ catalogue }));
		d.dispatch({ type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true });
		const cb = vi.fn();
		d.subscribe('p1', cb);
		cb.mockClear();
		d.dispatch({ type: 'start-game', playerId: 'p1', loadId: 'load-1' });
		const last = cb.mock.calls[cb.mock.calls.length - 1][0];
		expect(last.phase).toBe('error');
		expect(last.reason).toBe('db down');
	});
});
