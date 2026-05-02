import { describe, expect, it } from 'vitest';
import { errorPhase } from '../error';
import { makeError, makePlayer } from '../../__tests__/builders';

describe('error phase', () => {
	it('host can return to lobby and round flags reset', () => {
		const state = makeError({
			players: [
				makePlayer({ id: 'p1', isHost: true, hasSubmitted: true }),
				makePlayer({ id: 'p2', hasVoted: true })
			]
		});
		const result = errorPhase.reduce(state, { type: 'back-to-lobby', playerId: 'p1' });
		expect(result.state.phase).toBe('lobby');
		expect(result.state.players.every((p) => !p.hasSubmitted && !p.hasVoted)).toBe(true);
	});

	it('non-host cannot back-to-lobby', () => {
		const state = makeError({
			players: [makePlayer({ id: 'p1', isHost: false })]
		});
		const result = errorPhase.reduce(state, { type: 'back-to-lobby', playerId: 'p1' });
		expect(result.state).toBe(state);
	});

	it('host can end-game from error', () => {
		const state = makeError({
			players: [makePlayer({ id: 'p1', isHost: true })]
		});
		const result = errorPhase.reduce(state, { type: 'end-game', playerId: 'p1' });
		expect(result.state.phase).toBe('ended');
	});
});
