import { extractBase, resetRoundFlags } from '../helpers';
import type {
	Action,
	ActionType,
	InternalRound,
	TransitionResult,
	ViewerGameState
} from '../types';
import { handleEndGame } from './shared';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set([
	'question-loaded',
	'question-load-failed',
	'end-game'
]);

function reduce(state: StateOf<'loading-question'>, action: Action): TransitionResult {
	switch (action.type) {
		case 'question-loaded': {
			if (action.loadId !== state.loadId) {
				// stale load, ignore
				return { state, effects: [] };
			}
			const round: InternalRound = {
				word: action.question.word,
				questionId: action.question.id,
				correctAnswerId: action.correctAnswerId,
				answers: [
					{
						id: action.correctAnswerId,
						owner: { type: 'system' },
						text: action.question.definition
					}
				],
				playerVotes: {},
				rewardedPoints: {},
				questionVotes: {}
			};
			return {
				state: {
					...extractBase(state),
					players: resetRoundFlags(state.players),
					phase: 'writing',
					currentRound: round
				},
				effects: [{ type: 'increment-times-played', questionId: action.question.id }]
			};
		}
		case 'question-load-failed': {
			if (action.loadId !== state.loadId) {
				return { state, effects: [] };
			}
			return {
				state: { ...extractBase(state), phase: 'error', reason: action.reason },
				effects: []
			};
		}
		case 'end-game':
			return handleEndGame(state, action);
	}
	return { state, effects: [] };
}

function project(state: StateOf<'loading-question'>, viewerId: string): ViewerGameState {
	return {
		phase: 'loading-question',
		code: state.code,
		players: state.players,
		you: state.players.find((p) => p.id === viewerId)!,
		currentRoundNumber: state.roundIndex + 1
	};
}

export const loadingQuestionPhase: PhaseRecord<'loading-question'> = {
	accepts,
	reduce,
	project
};
