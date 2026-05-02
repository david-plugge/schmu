import type { ActionType, TransitionResult, ViewerGameState } from '../types';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set();

function reduce(state: StateOf<'ended'>): TransitionResult {
	return { state, effects: [] };
}

function project(state: StateOf<'ended'>): ViewerGameState {
	return {
		phase: 'ended',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1
	};
}

export const endedPhase: PhaseRecord<'ended'> = { accepts, reduce, project };
