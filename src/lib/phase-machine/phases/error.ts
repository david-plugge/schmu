import { extractBase, isHost, resetRoundFlags } from '../helpers';
import type { Action, ActionType, TransitionResult, ViewerGameState } from '../types';
import { handleEndGame } from './shared';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set(['back-to-lobby', 'end-game']);

function reduce(state: StateOf<'error'>, action: Action): TransitionResult {
	switch (action.type) {
		case 'back-to-lobby': {
			if (!isHost(state, action.playerId)) return { state, effects: [] };
			return {
				state: {
					...extractBase(state),
					players: resetRoundFlags(state.players),
					phase: 'lobby'
				},
				effects: []
			};
		}
		case 'end-game':
			return handleEndGame(state, action);
	}
	return { state, effects: [] };
}

function project(state: StateOf<'error'>): ViewerGameState {
	return {
		phase: 'error',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1,
		reason: state.reason
	};
}

export const errorPhase: PhaseRecord<'error'> = { accepts, reduce, project };
