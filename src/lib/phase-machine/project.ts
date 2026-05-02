import { endedPhase } from './phases/ended';
import { errorPhase } from './phases/error';
import { lobbyPhase } from './phases/lobby';
import { loadingQuestionPhase } from './phases/loading-question';
import { scoringPhase } from './phases/scoring';
import { votingPhase } from './phases/voting';
import { writingPhase } from './phases/writing';
import type { InternalState, ViewerGameState } from './types';

export function project(state: InternalState, viewerId: string): ViewerGameState {
	switch (state.phase) {
		case 'lobby':
			return lobbyPhase.project(state, viewerId);
		case 'loading-question':
			return loadingQuestionPhase.project(state, viewerId);
		case 'writing':
			return writingPhase.project(state, viewerId);
		case 'voting':
			return votingPhase.project(state, viewerId);
		case 'scoring':
			return scoringPhase.project(state, viewerId);
		case 'error':
			return errorPhase.project(state, viewerId);
		case 'ended':
			return endedPhase.project(state, viewerId);
	}
}
