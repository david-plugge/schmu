import { describe, expect, it } from 'vitest';
import { loadingQuestionPhase } from '../loading-question';
import { expectEffect, makeLoadingQuestion, makePlayer } from '../../__tests__/builders';

describe('loading-question phase', () => {
	it('ignores stale question-loaded', () => {
		const state = makeLoadingQuestion({ loadId: 'load-1' });
		const result = loadingQuestionPhase.reduce(state, {
			type: 'question-loaded',
			loadId: 'load-stale',
			question: { id: 1, word: 'Schmu', definition: 'Definition' },
			correctAnswerId: 'correct-1'
		});
		expect(result.state).toBe(state);
		expect(result.effects).toEqual([]);
	});

	it('matching question-loaded transitions to writing and emits increment', () => {
		const state = makeLoadingQuestion({
			loadId: 'load-1',
			players: [
				makePlayer({ id: 'p1', hasSubmitted: true }),
				makePlayer({ id: 'p2', hasSkipped: true })
			]
		});
		const result = loadingQuestionPhase.reduce(state, {
			type: 'question-loaded',
			loadId: 'load-1',
			question: { id: 42, word: 'Wort', definition: 'Real' },
			correctAnswerId: 'correct-42'
		});
		expect(result.state.phase).toBe('writing');
		if (result.state.phase !== 'writing') throw new Error('expected writing');
		expect(result.state.currentRound.word).toBe('Wort');
		expect(result.state.currentRound.questionId).toBe(42);
		expect(result.state.currentRound.answers).toEqual([
			{ id: 'correct-42', owner: { type: 'system' }, text: 'Real' }
		]);
		expect(result.state.players.every((p) => !p.hasSubmitted && !p.hasSkipped)).toBe(true);
		expectEffect(result.effects, 'increment-times-played', { questionId: 42 });
	});

	it('matching question-load-failed transitions to error', () => {
		const state = makeLoadingQuestion({ loadId: 'load-1' });
		const result = loadingQuestionPhase.reduce(state, {
			type: 'question-load-failed',
			loadId: 'load-1',
			reason: 'no questions available'
		});
		expect(result.state.phase).toBe('error');
		if (result.state.phase !== 'error') throw new Error('expected error');
		expect(result.state.reason).toBe('no questions available');
	});

	it('end-game from host transitions to ended', () => {
		const state = makeLoadingQuestion({
			loadId: 'load-1',
			players: [makePlayer({ id: 'p1', isHost: true })]
		});
		const result = loadingQuestionPhase.reduce(state, { type: 'end-game', playerId: 'p1' });
		expect(result.state.phase).toBe('ended');
	});
});
