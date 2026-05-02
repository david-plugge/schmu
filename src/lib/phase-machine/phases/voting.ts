import {
	applyRewards,
	calculateRewardedPoints,
	extractBase,
	findPlayer,
	isHost,
	shuffleSeeded,
	updatePlayer
} from '../helpers';
import type { Action, ActionType, TransitionResult, ViewerAnswer, ViewerGameState } from '../types';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set(['submit-vote', 'end-game']);

function reduce(state: StateOf<'voting'>, action: Action): TransitionResult {
	switch (action.type) {
		case 'submit-vote': {
			const player = findPlayer(state, action.playerId);
			if (!player) return { state, effects: [] };
			if (player.hasVoted) return { state, effects: [] };

			const answer = state.currentRound.answers.find((a) => a.id === action.answerId);
			if (!answer) return { state, effects: [] };
			if (answer.owner.type === 'player' && answer.owner.playerId === player.id) {
				return { state, effects: [] };
			}

			const newPlayerVotes = {
				...state.currentRound.playerVotes,
				[player.id]: answer.id
			};
			const newPlayers = updatePlayer(state.players, player.id, { hasVoted: true });

			const allVoted = newPlayers.every((p) => p.hasVoted);
			if (allVoted) {
				const newRound = {
					...state.currentRound,
					playerVotes: newPlayerVotes
				};
				const rewardedPoints = calculateRewardedPoints(newRound);
				const playersWithScores = applyRewards(newPlayers, rewardedPoints);
				return {
					state: {
						...extractBase(state),
						players: playersWithScores,
						phase: 'scoring',
						currentRound: { ...newRound, rewardedPoints }
					},
					effects: []
				};
			}
			return {
				state: {
					...state,
					players: newPlayers,
					currentRound: { ...state.currentRound, playerVotes: newPlayerVotes }
				},
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

function project(state: StateOf<'voting'>, viewerId: string): ViewerGameState {
	const shuffled = shuffleSeeded(state.currentRound.answers, String(state.currentRound.questionId));
	const possibleAnswers: ViewerAnswer[] = shuffled.map((a) => ({
		id: a.id,
		text: a.text,
		isOwn: a.owner.type === 'player' && a.owner.playerId === viewerId
	}));
	return {
		phase: 'voting',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1,
		currentWord: state.currentRound.word,
		possibleAnswers
	};
}

export const votingPhase: PhaseRecord<'voting'> = { accepts, reduce, project };
