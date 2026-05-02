import {
	extractBase,
	findPlayer,
	isHost,
	questionVoteDelta,
	toggleVote,
	updatePlayer
} from '../helpers';
import type {
	Action,
	ActionType,
	InternalAnswer,
	TransitionResult,
	ViewerGameState
} from '../types';
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

			const newAnswer: InternalAnswer = {
				id: action.answerId,
				owner: { type: 'player', playerId: player.id },
				text: action.text
			};
			const newRound = {
				...state.currentRound,
				answers: [...state.currentRound.answers, newAnswer]
			};
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
		case 'toggle-question-vote': {
			const player = findPlayer(state, action.playerId);
			if (!player) return { state, effects: [] };

			const prev = state.currentRound.questionVotes[player.id];
			const next = toggleVote(prev, action.vote);
			const delta = questionVoteDelta(prev, next);

			const newQuestionVotes = { ...state.currentRound.questionVotes };
			if (next === undefined) {
				delete newQuestionVotes[player.id];
			} else {
				newQuestionVotes[player.id] = next;
			}

			const effects =
				delta === 0
					? []
					: [
							{
								type: 'vote-question' as const,
								questionId: state.currentRound.questionId,
								delta
							}
						];

			return {
				state: {
					...state,
					currentRound: { ...state.currentRound, questionVotes: newQuestionVotes }
				},
				effects
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
