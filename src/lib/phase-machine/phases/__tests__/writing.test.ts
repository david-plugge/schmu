import { describe, expect, it } from 'vitest';
import { writingPhase } from '../writing';
import {
	expectEffect,
	makePlayer,
	makePlayerAnswer,
	makeRound,
	makeWriting
} from '../../__tests__/builders';

describe('writing phase', () => {
	describe('submit-answer', () => {
		it('appends a player answer and marks hasSubmitted', () => {
			const state = makeWriting({
				players: [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
			});
			const result = writingPhase.reduce(state, {
				type: 'submit-answer',
				playerId: 'p1',
				answerId: 'ans-p1',
				text: 'a fake definition'
			});
			expect(result.state.phase).toBe('writing');
			if (result.state.phase !== 'writing') throw new Error('expected writing');
			expect(result.state.currentRound.answers).toHaveLength(2);
			expect(result.state.players.find((p) => p.id === 'p1')!.hasSubmitted).toBe(true);
		});

		it('rejects empty text', () => {
			const state = makeWriting({ players: [makePlayer({ id: 'p1' })] });
			const result = writingPhase.reduce(state, {
				type: 'submit-answer',
				playerId: 'p1',
				answerId: 'ans-p1',
				text: ''
			});
			expect(result.state).toBe(state);
		});

		it('transitions to voting when all submitted', () => {
			const state = makeWriting({
				players: [
					makePlayer({ id: 'p1', hasSubmitted: true }),
					makePlayer({ id: 'p2', hasSubmitted: false })
				]
			});
			const result = writingPhase.reduce(state, {
				type: 'submit-answer',
				playerId: 'p2',
				answerId: 'ans-p2',
				text: 'last one'
			});
			expect(result.state.phase).toBe('voting');
		});
	});

	describe('toggle-skip', () => {
		it('toggles hasSkipped on the player', () => {
			const state = makeWriting({
				players: [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
			});
			const result = writingPhase.reduce(state, { type: 'toggle-skip', playerId: 'p1' });
			expect(result.state.players.find((p) => p.id === 'p1')!.hasSkipped).toBe(true);
			expect(result.state.phase).toBe('writing');
		});

		it('transitions to loading-question when all skipped', () => {
			const state = makeWriting({
				players: [
					makePlayer({ id: 'p1', hasSkipped: true }),
					makePlayer({ id: 'p2', hasSkipped: false })
				]
			});
			const result = writingPhase.reduce(state, { type: 'toggle-skip', playerId: 'p2' });
			expect(result.state.phase).toBe('loading-question');
			expectEffect(result.effects, 'load-next-question', {});
		});
	});

	describe('toggle-question-vote', () => {
		it('records up vote and emits +1 delta', () => {
			const state = makeWriting({ players: [makePlayer({ id: 'p1' })] });
			const result = writingPhase.reduce(state, {
				type: 'toggle-question-vote',
				playerId: 'p1',
				vote: 'up'
			});
			if (result.state.phase !== 'writing') throw new Error('expected writing');
			expect(result.state.currentRound.questionVotes['p1']).toBe('up');
			expectEffect(result.effects, 'vote-question', { delta: 1 });
		});

		it('toggling same vote removes it (delta -1 for clearing up)', () => {
			const round = makeRound({ questionVotes: { p1: 'up' } });
			const state = makeWriting({
				players: [makePlayer({ id: 'p1' })],
				currentRound: round
			});
			const result = writingPhase.reduce(state, {
				type: 'toggle-question-vote',
				playerId: 'p1',
				vote: 'up'
			});
			if (result.state.phase !== 'writing') throw new Error('expected writing');
			expect(result.state.currentRound.questionVotes['p1']).toBeUndefined();
			expectEffect(result.effects, 'vote-question', { delta: -1 });
		});

		it('switching from up to down emits -2 delta', () => {
			const round = makeRound({ questionVotes: { p1: 'up' } });
			const state = makeWriting({
				players: [makePlayer({ id: 'p1' })],
				currentRound: round
			});
			const result = writingPhase.reduce(state, {
				type: 'toggle-question-vote',
				playerId: 'p1',
				vote: 'down'
			});
			expectEffect(result.effects, 'vote-question', { delta: -2 });
		});
	});

	describe('project', () => {
		it('exposes the current word and own question vote', () => {
			const round = makeRound({ word: 'Schmu', questionVotes: { p1: 'up' } });
			const state = makeWriting({
				players: [makePlayer({ id: 'p1' })],
				currentRound: round
			});
			const view = writingPhase.project(state, 'p1');
			expect(view.phase).toBe('writing');
			if (view.phase !== 'writing') throw new Error('expected writing');
			expect(view.currentWord).toBe('Schmu');
			expect(view.myQuestionVote).toBe('up');
		});

		it('does not leak other players answers (answers are not in viewer state for writing)', () => {
			const playerAnswer = makePlayerAnswer('ans-p2', 'p2', 'fake');
			const round = makeRound({
				answers: [{ id: 'correct-1', owner: { type: 'system' }, text: 'real' }, playerAnswer]
			});
			const state = makeWriting({
				players: [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })],
				currentRound: round
			});
			const view = writingPhase.project(state, 'p1');
			expect('possibleAnswers' in view).toBe(false);
		});
	});
});
