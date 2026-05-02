import type { CategorySlug } from '$lib/categories';
import type { InternalPlayer, InternalRound, InternalState, Vote } from './types';

export interface BaseFields {
	code: string;
	players: InternalPlayer[];
	enabledCategories: CategorySlug[];
	roundIndex: number;
	usedWords: string[];
}

export function extractBase(state: InternalState): BaseFields {
	return {
		code: state.code,
		players: state.players,
		enabledCategories: state.enabledCategories,
		roundIndex: state.roundIndex,
		usedWords: state.usedWords
	};
}

export const CORRECT_ANSWER_REWARD = 2;
export const FOOLED_ANSWER_REWARD = 3;

export function hashSeed(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

export function mulberry32(seed: number) {
	let s = seed;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffleSeeded<T>(arr: readonly T[], seed: string): T[] {
	const result = arr.slice();
	const rng = mulberry32(hashSeed(seed));
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function findPlayer(state: InternalState, id: string): InternalPlayer | undefined {
	return state.players.find((p) => p.id === id);
}

export function isHost(state: InternalState, id: string): boolean {
	return findPlayer(state, id)?.isHost === true;
}

export function updatePlayer(
	players: InternalPlayer[],
	id: string,
	patch: Partial<InternalPlayer>
): InternalPlayer[] {
	return players.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export function resetRoundFlags(players: InternalPlayer[]): InternalPlayer[] {
	return players.map((p) => ({
		...p,
		hasSubmitted: false,
		hasVoted: false,
		hasSkipped: false
	}));
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

export function applyRewards(
	players: InternalPlayer[],
	rewardedPoints: Record<string, number>
): InternalPlayer[] {
	return players.map((p) =>
		rewardedPoints[p.id] != null ? { ...p, score: p.score + rewardedPoints[p.id] } : p
	);
}

export function toggleVote(prev: Vote | undefined, next: Vote): Vote | undefined {
	return prev === next ? undefined : next;
}

export function questionVoteDelta(prev: Vote | undefined, next: Vote | undefined): number {
	const prevValue = prev === 'up' ? 1 : prev === 'down' ? -1 : 0;
	const nextValue = next === 'up' ? 1 : next === 'down' ? -1 : 0;
	return nextValue - prevValue;
}
