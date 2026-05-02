import type { CategorySlug } from '$lib/categories';
import type { InternalPlayer, InternalState } from './types';

export interface BaseFields {
	code: string;
	players: InternalPlayer[];
	enabledCategories: CategorySlug[];
	roundIndex: number;
}

export function extractBase(state: InternalState): BaseFields {
	return {
		code: state.code,
		players: state.players,
		enabledCategories: state.enabledCategories,
		roundIndex: state.roundIndex
	};
}

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

export function applyRewards(
	players: InternalPlayer[],
	rewardedPoints: Record<string, number>
): InternalPlayer[] {
	return players.map((p) =>
		rewardedPoints[p.id] != null ? { ...p, score: p.score + rewardedPoints[p.id] } : p
	);
}
