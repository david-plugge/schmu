import { endedPhase } from './phases/ended';
import { errorPhase } from './phases/error';
import { lobbyPhase } from './phases/lobby';
import { loadingQuestionPhase } from './phases/loading-question';
import { scoringPhase } from './phases/scoring';
import { votingPhase } from './phases/voting';
import { writingPhase } from './phases/writing';
import type { Action, InternalState, TransitionResult } from './types';

export function transition(state: InternalState, action: Action): TransitionResult {
	switch (state.phase) {
		case 'lobby':
			return lobbyPhase.accepts.has(action.type)
				? lobbyPhase.reduce(state, action)
				: { state, effects: [] };
		case 'loading-question':
			return loadingQuestionPhase.accepts.has(action.type)
				? loadingQuestionPhase.reduce(state, action)
				: { state, effects: [] };
		case 'writing':
			return writingPhase.accepts.has(action.type)
				? writingPhase.reduce(state, action)
				: { state, effects: [] };
		case 'voting':
			return votingPhase.accepts.has(action.type)
				? votingPhase.reduce(state, action)
				: { state, effects: [] };
		case 'scoring':
			return scoringPhase.accepts.has(action.type)
				? scoringPhase.reduce(state, action)
				: { state, effects: [] };
		case 'error':
			return errorPhase.accepts.has(action.type)
				? errorPhase.reduce(state, action)
				: { state, effects: [] };
		case 'ended':
			return endedPhase.accepts.has(action.type)
				? endedPhase.reduce(state, action)
				: { state, effects: [] };
	}
}
