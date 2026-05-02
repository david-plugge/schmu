import { describe, expect, it } from 'vitest';
import { lobbyPhase } from '../lobby';
import { makeLobby, makePlayer, expectEffect } from '../../__tests__/builders';
import type { Action } from '../../types';

describe('lobby phase', () => {
	describe('add-player', () => {
		it('adds a new player', () => {
			const state = makeLobby();
			const action: Action = { type: 'add-player', playerId: 'p1', name: 'Alice', isHost: true };
			const result = lobbyPhase.reduce(state, action);
			expect(result.state.players).toHaveLength(1);
			expect(result.state.players[0]).toMatchObject({
				id: 'p1',
				name: 'Alice',
				isHost: true,
				score: 0
			});
			expect(result.effects).toEqual([]);
		});

		it('is a no-op for duplicate player id', () => {
			const state = makeLobby({ players: [makePlayer({ id: 'p1' })] });
			const action: Action = { type: 'add-player', playerId: 'p1', name: 'Bob', isHost: false };
			const result = lobbyPhase.reduce(state, action);
			expect(result.state).toBe(state);
		});
	});

	describe('set-categories', () => {
		it('rejects non-host', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: false })]
			});
			const result = lobbyPhase.reduce(state, {
				type: 'set-categories',
				playerId: 'p1',
				categories: ['medizin']
			});
			expect(result.state).toBe(state);
		});

		it('accepts from host with non-empty unique list', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: true })]
			});
			const result = lobbyPhase.reduce(state, {
				type: 'set-categories',
				playerId: 'p1',
				categories: ['medizin', 'medizin', 'recht']
			});
			expect(result.state.enabledCategories).toEqual(['medizin', 'recht']);
		});

		it('rejects empty list', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: true })]
			});
			const result = lobbyPhase.reduce(state, {
				type: 'set-categories',
				playerId: 'p1',
				categories: []
			});
			expect(result.state).toBe(state);
		});
	});

	describe('start-game', () => {
		it('rejects non-host', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: false })]
			});
			const result = lobbyPhase.reduce(state, {
				type: 'start-game',
				playerId: 'p1',
				loadId: 'load-1'
			});
			expect(result.state).toBe(state);
		});

		it('rejects when no players', () => {
			const state = makeLobby();
			const result = lobbyPhase.reduce(state, {
				type: 'start-game',
				playerId: 'p1',
				loadId: 'load-1'
			});
			expect(result.state).toBe(state);
		});

		it('transitions to loading-question and emits load-next-question', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: true })]
			});
			const result = lobbyPhase.reduce(state, {
				type: 'start-game',
				playerId: 'p1',
				loadId: 'load-1'
			});
			expect(result.state.phase).toBe('loading-question');
			expectEffect(result.effects, 'load-next-question', { loadId: 'load-1' });
		});
	});

	describe('end-game', () => {
		it('host transitions to ended', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: true })]
			});
			const result = lobbyPhase.reduce(state, { type: 'end-game', playerId: 'p1' });
			expect(result.state.phase).toBe('ended');
		});

		it('non-host rejected', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: false })]
			});
			const result = lobbyPhase.reduce(state, { type: 'end-game', playerId: 'p1' });
			expect(result.state).toBe(state);
		});
	});

	describe('project', () => {
		it('exposes lobby viewer state', () => {
			const state = makeLobby({
				players: [makePlayer({ id: 'p1', isHost: true })],
				enabledCategories: ['medizin', 'recht']
			});
			const view = lobbyPhase.project(state, 'p1');
			expect(view.phase).toBe('lobby');
			expect(view.code).toBe(state.code);
			if (view.phase !== 'lobby') throw new Error('expected lobby phase');
			expect(view.enabledCategories).toEqual(['medizin', 'recht']);
		});
	});
});
