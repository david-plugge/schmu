import { extractBase, findPlayer, isHost } from '../helpers';
import { toggleQuestionVote } from '../round';
import type { Action, Effect, InternalState, TransitionResult } from '../types';

export function handleEndGame(
	state: InternalState,
	action: Extract<Action, { type: 'end-game' }>
): TransitionResult {
	if (!isHost(state, action.playerId)) return { state, effects: [] };
	return {
		state: { ...extractBase(state), phase: 'ended' },
		effects: []
	};
}

export function handleToggleQuestionVote(
	state: Extract<InternalState, { phase: 'writing' | 'scoring' }>,
	action: Extract<Action, { type: 'toggle-question-vote' }>
): TransitionResult {
	const player = findPlayer(state, action.playerId);
	if (!player) return { state, effects: [] };

	const { round: newRound, delta } = toggleQuestionVote(state.currentRound, player.id, action.vote);
	const effects: Effect[] = [];
	if (delta !== 0) {
		effects.push({
			type: 'vote-question',
			questionId: state.currentRound.questionId,
			delta
		});
	}
	return {
		state: { ...state, currentRound: newRound },
		effects
	};
}
