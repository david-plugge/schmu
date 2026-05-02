import { describe, expect, it } from 'vitest';
import { scoringPhase } from '../scoring';
import {
	expectEffect,
	makePlayer,
	makePlayerAnswer,
	makeRound,
	makeScoring
} from '../../__tests__/builders';

describe('scoring phase', () => {
	describe('toggle-question-vote', () => {
		it('switching from down to up emits +2 delta', () => {
			const round = makeRound({ questionVotes: { p1: 'down' } });
			const state = makeScoring({
				players: [makePlayer({ id: 'p1' })],
				currentRound: round
			});
			const result = scoringPhase.reduce(state, {
				type: 'toggle-question-vote',
				playerId: 'p1',
				vote: 'up'
			});
			if (result.state.phase !== 'scoring') throw new Error('expected scoring');
			expect(result.state.currentRound.questionVotes['p1']).toBe('up');
			expectEffect(result.effects, 'vote-question', { delta: 2 });
		});

		it('toggling same vote clears it', () => {
			const round = makeRound({ questionVotes: { p1: 'down' } });
			const state = makeScoring({
				players: [makePlayer({ id: 'p1' })],
				currentRound: round
			});
			const result = scoringPhase.reduce(state, {
				type: 'toggle-question-vote',
				playerId: 'p1',
				vote: 'down'
			});
			if (result.state.phase !== 'scoring') throw new Error('expected scoring');
			expect(result.state.currentRound.questionVotes['p1']).toBeUndefined();
			expectEffect(result.effects, 'vote-question', { delta: 1 });
		});
	});

	describe('next-round', () => {
		it('rejects non-host', () => {
			const state = makeScoring({
				players: [makePlayer({ id: 'p1', isHost: false })]
			});
			const result = scoringPhase.reduce(state, {
				type: 'next-round',
				playerId: 'p1',
				loadId: 'load-2'
			});
			expect(result.state).toBe(state);
		});

		it('host transitions to loading-question, increments roundIndex, adds word to usedWords', () => {
			const round = makeRound({ word: 'CurrentWord' });
			const state = makeScoring({
				players: [makePlayer({ id: 'p1', isHost: true })],
				currentRound: round,
				roundIndex: 0,
				usedWords: ['Vorwort']
			});
			const result = scoringPhase.reduce(state, {
				type: 'next-round',
				playerId: 'p1',
				loadId: 'load-2'
			});
			expect(result.state.phase).toBe('loading-question');
			expect(result.state.roundIndex).toBe(1);
			expect(result.state.usedWords).toEqual(['Vorwort', 'CurrentWord']);
			expectEffect(result.effects, 'load-next-question', { loadId: 'load-2' });
		});
	});

	describe('project', () => {
		it('exposes round results with player names and own-answer flags', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('ans-p2', 'p2', 'fake')
				],
				playerVotes: { p1: 'ans-p2', p2: 'correct-1' },
				rewardedPoints: { p1: 0, p2: 2 },
				questionVotes: { p1: 'up' }
			});
			const state = makeScoring({
				players: [
					makePlayer({ id: 'p1', name: 'Alice', score: 0 }),
					makePlayer({ id: 'p2', name: 'Bob', score: 2 })
				],
				currentRound: round
			});
			const view = scoringPhase.project(state, 'p1');
			if (view.phase !== 'scoring') throw new Error('expected scoring');
			expect(view.myQuestionVote).toBe('up');
			expect(view.roundResults.myGuessId).toBe('ans-p2');
			const bobAnswer = view.roundResults.answers.find((a) => a.id === 'ans-p2');
			expect(bobAnswer?.owner.type).toBe('player');
			if (bobAnswer?.owner.type !== 'player') throw new Error('expected player owner');
			expect(bobAnswer.owner.name).toBe('Bob');
			expect(bobAnswer.owner.isOwn).toBe(false);
		});
	});
});
