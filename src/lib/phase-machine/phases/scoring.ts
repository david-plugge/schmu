import {
	extractBase,
	findPlayer,
	isHost,
	questionVoteDelta,
	shuffleSeeded,
	toggleVote
} from '../helpers';
import type {
	Action,
	ActionType,
	TransitionResult,
	ViewerAnswerOwner,
	ViewerGameState,
	ViewerRoundResults
} from '../types';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set([
	'toggle-question-vote',
	'next-round',
	'end-game'
]);

function reduce(state: StateOf<'scoring'>, action: Action): TransitionResult {
	switch (action.type) {
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
		case 'next-round': {
			if (!isHost(state, action.playerId)) return { state, effects: [] };
			const newUsedWords = [...state.usedWords, state.currentRound.word];
			return {
				state: {
					...extractBase(state),
					roundIndex: state.roundIndex + 1,
					usedWords: newUsedWords,
					phase: 'loading-question',
					loadId: action.loadId
				},
				effects: [
					{
						type: 'load-next-question',
						loadId: action.loadId,
						usedWords: newUsedWords,
						categories: state.enabledCategories
					}
				]
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

function project(state: StateOf<'scoring'>, viewerId: string): ViewerGameState {
	const shuffled = shuffleSeeded(state.currentRound.answers, String(state.currentRound.questionId));
	const playerNameById = new Map(state.players.map((p) => [p.id, p.name]));
	const roundResults: ViewerRoundResults = {
		correctAnswerId: state.currentRound.correctAnswerId,
		playerGuesses: { ...state.currentRound.playerVotes },
		pointsChanges: { ...state.currentRound.rewardedPoints },
		answers: shuffled.map((a) => {
			const owner: ViewerAnswerOwner =
				a.owner.type === 'system'
					? { type: 'system' }
					: {
							type: 'player',
							name: playerNameById.get(a.owner.playerId) ?? 'Unbekannt',
							isOwn: a.owner.playerId === viewerId
						};
			return { id: a.id, text: a.text, owner };
		}),
		myGuessId: state.currentRound.playerVotes[viewerId]
	};
	return {
		phase: 'scoring',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1,
		currentWord: state.currentRound.word,
		roundResults,
		myQuestionVote: state.currentRound.questionVotes[viewerId]
	};
}

export const scoringPhase: PhaseRecord<'scoring'> = { accepts, reduce, project };
