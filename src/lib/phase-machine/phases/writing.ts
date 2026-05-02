import { extractBase, findPlayer, updatePlayer } from '../helpers';
import { addAnswer } from '../round';
import type { Action, ActionType, TransitionResult, ViewerGameState } from '../types';
import { handleEndGame, handleToggleQuestionVote } from './shared';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set([
	'submit-answer',
	'toggle-skip',
	'toggle-question-vote',
	'end-game'
]);

function reduce(state: StateOf<'writing'>, action: Action): TransitionResult {
	switch (action.type) {
		case 'submit-answer': {
			const player = findPlayer(state, action.playerId);
			if (!player) return { state, effects: [] };
			if (player.hasSubmitted) return { state, effects: [] };
			if (action.text.length === 0) return { state, effects: [] };

			const newRound = addAnswer(state.currentRound, {
				id: action.answerId,
				owner: { type: 'player', playerId: player.id },
				text: action.text
			});
			const newPlayers = updatePlayer(state.players, player.id, { hasSubmitted: true });

			const allSubmitted = newPlayers.every((p) => p.hasSubmitted);
			if (allSubmitted) {
				return {
					state: {
						...extractBase(state),
						players: newPlayers,
						phase: 'voting',
						currentRound: newRound
					},
					effects: []
				};
			}
			return {
				state: { ...state, players: newPlayers, currentRound: newRound },
				effects: []
			};
		}
		case 'toggle-skip': {
			const player = findPlayer(state, action.playerId);
			if (!player) return { state, effects: [] };

			const newPlayers = updatePlayer(state.players, player.id, {
				hasSkipped: !player.hasSkipped
			});

			const allSkipped = newPlayers.every((p) => p.hasSkipped);
			if (allSkipped) {
				const skipLoadId = `skip:${state.currentRound.correctAnswerId}`;
				const newUsedWords = [...state.usedWords, state.currentRound.word];
				return {
					state: {
						...extractBase(state),
						players: newPlayers,
						usedWords: newUsedWords,
						phase: 'loading-question',
						loadId: skipLoadId
					},
					effects: [
						{
							type: 'load-next-question',
							loadId: skipLoadId,
							usedWords: newUsedWords,
							categories: state.enabledCategories
						}
					]
				};
			}
			return {
				state: { ...state, players: newPlayers },
				effects: []
			};
		}
		case 'toggle-question-vote':
			return handleToggleQuestionVote(state, action);
		case 'end-game':
			return handleEndGame(state, action);
	}
	return { state, effects: [] };
}

function project(state: StateOf<'writing'>, viewerId: string): ViewerGameState {
	return {
		phase: 'writing',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1,
		currentWord: state.currentRound.word,
		myQuestionVote: state.currentRound.questionVotes[viewerId]
	};
}

export const writingPhase: PhaseRecord<'writing'> = { accepts, reduce, project };
