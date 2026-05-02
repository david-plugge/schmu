import { applyRewards, extractBase, findPlayer, shuffleSeeded, updatePlayer } from '../helpers';
import { calculateRewardedPoints, recordPlayerVote, withRewardedPoints } from '../round';
import type { Action, ActionType, TransitionResult, ViewerAnswer, ViewerGameState } from '../types';
import { handleEndGame } from './shared';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set(['submit-vote', 'end-game']);

function reduce(state: StateOf<'voting'>, action: Action): TransitionResult {
	switch (action.type) {
		case 'submit-vote': {
			const player = findPlayer(state, action.playerId);
			if (!player) return { state, effects: [] };
			if (player.hasVoted) return { state, effects: [] };

			const newRound = recordPlayerVote(state.currentRound, player.id, action.answerId);
			if (!newRound) return { state, effects: [] };

			const newPlayers = updatePlayer(state.players, player.id, { hasVoted: true });

			const allVoted = newPlayers.every((p) => p.hasVoted);
			if (allVoted) {
				const rewardedPoints = calculateRewardedPoints(newRound);
				const playersWithScores = applyRewards(newPlayers, rewardedPoints);
				return {
					state: {
						...extractBase(state),
						players: playersWithScores,
						phase: 'scoring',
						currentRound: withRewardedPoints(newRound, rewardedPoints)
					},
					effects: []
				};
			}
			return {
				state: { ...state, players: newPlayers, currentRound: newRound },
				effects: []
			};
		}
		case 'end-game':
			return handleEndGame(state, action);
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
