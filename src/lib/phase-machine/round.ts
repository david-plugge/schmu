import type { InternalAnswer, InternalRound, Vote } from './types';

export const CORRECT_ANSWER_REWARD = 2;
export const FOOLED_ANSWER_REWARD = 3;

export function addAnswer(round: InternalRound, answer: InternalAnswer): InternalRound {
	return { ...round, answers: [...round.answers, answer] };
}

export function recordPlayerVote(
	round: InternalRound,
	playerId: string,
	answerId: string
): InternalRound | null {
	const answer = round.answers.find((a) => a.id === answerId);
	if (!answer) return null;
	if (answer.owner.type === 'player' && answer.owner.playerId === playerId) return null;
	return {
		...round,
		playerVotes: { ...round.playerVotes, [playerId]: answer.id }
	};
}

export interface QuestionVoteResult {
	round: InternalRound;
	delta: number;
}

export function toggleQuestionVote(
	round: InternalRound,
	playerId: string,
	vote: Vote
): QuestionVoteResult {
	const prev = round.questionVotes[playerId];
	const next: Vote | undefined = prev === vote ? undefined : vote;
	const delta = voteValue(next) - voteValue(prev);

	const questionVotes = { ...round.questionVotes };
	if (next === undefined) {
		delete questionVotes[playerId];
	} else {
		questionVotes[playerId] = next;
	}

	return { round: { ...round, questionVotes }, delta };
}

export function calculateRewardedPoints(round: InternalRound): Record<string, number> {
	const rewardedPoints: Record<string, number> = {};
	for (const playerId in round.playerVotes) {
		const answer = round.answers.find((a) => a.id === round.playerVotes[playerId]);
		if (!answer) continue;
		if (answer.owner.type === 'system') {
			rewardedPoints[playerId] = (rewardedPoints[playerId] ?? 0) + CORRECT_ANSWER_REWARD;
		} else {
			rewardedPoints[answer.owner.playerId] =
				(rewardedPoints[answer.owner.playerId] ?? 0) + FOOLED_ANSWER_REWARD;
		}
	}
	return rewardedPoints;
}

export function withRewardedPoints(
	round: InternalRound,
	rewardedPoints: Record<string, number>
): InternalRound {
	return { ...round, rewardedPoints };
}

function voteValue(vote: Vote | undefined): number {
	return vote === 'up' ? 1 : vote === 'down' ? -1 : 0;
}
