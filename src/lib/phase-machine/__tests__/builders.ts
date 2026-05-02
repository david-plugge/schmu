import { CATEGORY_SLUGS, type CategorySlug } from '$lib/categories';
import { expect } from 'vitest';
import type { Effect, InternalAnswer, Player, InternalRound, InternalState } from '../types';

export function makePlayer(overrides: Partial<Player> = {}): Player {
	return {
		id: 'p1',
		name: 'Player 1',
		isHost: false,
		score: 0,
		hasSubmitted: false,
		hasVoted: false,
		hasSkipped: false,
		...overrides
	};
}

export function makeRound(overrides: Partial<InternalRound> = {}): InternalRound {
	return {
		word: 'Schmu',
		questionId: 1,
		correctAnswerId: 'correct-1',
		answers: [
			{
				id: 'correct-1',
				owner: { type: 'system' },
				text: 'Real definition'
			}
		],
		playerVotes: {},
		rewardedPoints: {},
		questionVotes: {},
		...overrides
	};
}

export function makePlayerAnswer(id: string, playerId: string, text: string): InternalAnswer {
	return { id, owner: { type: 'player', playerId }, text };
}

interface BaseStateInput {
	code?: string;
	players?: Player[];
	enabledCategories?: CategorySlug[];
	roundIndex?: number;
}

function withBase(input: BaseStateInput) {
	return {
		code: input.code ?? 'ABCD',
		players: input.players ?? [],
		enabledCategories: input.enabledCategories ?? [...CATEGORY_SLUGS],
		roundIndex: input.roundIndex ?? 0
	};
}

export function makeLobby(input: BaseStateInput = {}): Extract<InternalState, { phase: 'lobby' }> {
	return { ...withBase(input), phase: 'lobby' };
}

export function makeLoadingQuestion(
	input: BaseStateInput & { loadId?: string } = {}
): Extract<InternalState, { phase: 'loading-question' }> {
	return { ...withBase(input), phase: 'loading-question', loadId: input.loadId ?? 'load-1' };
}

export function makeWriting(
	input: BaseStateInput & { currentRound?: InternalRound } = {}
): Extract<InternalState, { phase: 'writing' }> {
	return { ...withBase(input), phase: 'writing', currentRound: input.currentRound ?? makeRound() };
}

export function makeVoting(
	input: BaseStateInput & { currentRound?: InternalRound } = {}
): Extract<InternalState, { phase: 'voting' }> {
	return { ...withBase(input), phase: 'voting', currentRound: input.currentRound ?? makeRound() };
}

export function makeScoring(
	input: BaseStateInput & { currentRound?: InternalRound } = {}
): Extract<InternalState, { phase: 'scoring' }> {
	return { ...withBase(input), phase: 'scoring', currentRound: input.currentRound ?? makeRound() };
}

export function makeError(
	input: BaseStateInput & { reason?: string } = {}
): Extract<InternalState, { phase: 'error' }> {
	return { ...withBase(input), phase: 'error', reason: input.reason ?? 'Boom' };
}

export function makeEnded(input: BaseStateInput = {}): Extract<InternalState, { phase: 'ended' }> {
	return { ...withBase(input), phase: 'ended' };
}

export function expectEffect<T extends Effect['type']>(
	effects: Effect[],
	type: T,
	partial: Partial<Extract<Effect, { type: T }>>
): void {
	const matching = effects.filter((e) => e.type === type) as Array<Extract<Effect, { type: T }>>;
	expect(
		matching.some((e) =>
			Object.entries(partial).every(([k, v]) => (e as Record<string, unknown>)[k] === v)
		)
	).toBe(true);
}
