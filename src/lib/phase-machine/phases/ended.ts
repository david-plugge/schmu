import type { ActionType, TransitionResult, ViewerGameState } from '../types';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set();

function reduce(state: StateOf<'ended'>): TransitionResult {
	return { state, effects: [] };
}

function project(state: StateOf<'ended'>, viewerId: string): ViewerGameState {
	return {
		phase: 'ended',
		code: state.code,
		players: state.players,
		you: state.players.find((p) => p.id === viewerId)!,
		currentRoundNumber: state.roundIndex + 1
	};
}

export const endedPhase: PhaseRecord<'ended'> = { accepts, reduce, project };
