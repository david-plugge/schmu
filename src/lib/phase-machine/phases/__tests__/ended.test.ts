import { describe, expect, it } from 'vitest';
import { transition } from '../../transition';
import { makeEnded, makePlayer } from '../../__tests__/builders';

describe('ended phase', () => {
	it('ignores all actions', () => {
		const state = makeEnded({ players: [makePlayer({ id: 'p1', isHost: true })] });
		const after = transition(state, { type: 'end-game', playerId: 'p1' });
		expect(after.state).toBe(state);
		expect(after.effects).toEqual([]);
	});
});
