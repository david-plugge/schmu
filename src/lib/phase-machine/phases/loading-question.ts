import { extractBase, isHost, resetRoundFlags } from '../helpers';
import type {
	Action,
	ActionType,
	InternalRound,
	TransitionResult,
	ViewerGameState
} from '../types';
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
		case 'end-game': {
			if (!isHost(state, action.playerId)) return { state, effects: [] };
			return {
				state: { ...extractBase(state), phase: 'ended' },
				effects: []
			};
		}
	}
	return { state, effects: [] };
}

function project(state: StateOf<'loading-question'>): ViewerGameState {
	return {
		phase: 'loading-question',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1
	};
}

export const loadingQuestionPhase: PhaseRecord<'loading-question'> = {
	accepts,
	reduce,
	project
};
