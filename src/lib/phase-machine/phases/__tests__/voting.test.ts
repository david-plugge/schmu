import { describe, expect, it } from 'vitest';
import { votingPhase } from '../voting';
import { makePlayer, makePlayerAnswer, makeRound, makeVoting } from '../../__tests__/builders';

describe('voting phase', () => {
	describe('submit-vote', () => {
		it('records the vote and marks hasVoted', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('ans-p2', 'p2', 'fake')
				]
			});
			const state = makeVoting({
				players: [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })],
				currentRound: round
			});
			const result = votingPhase.reduce(state, {
				type: 'submit-vote',
				playerId: 'p1',
				answerId: 'correct-1'
			});
			if (result.state.phase !== 'voting') throw new Error('expected voting');
			expect(result.state.currentRound.playerVotes['p1']).toBe('correct-1');
			expect(result.state.players.find((p) => p.id === 'p1')!.hasVoted).toBe(true);
		});

		it('rejects voting for own answer', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('ans-p1', 'p1', 'mine')
				]
			});
			const state = makeVoting({
				players: [makePlayer({ id: 'p1' })],
				currentRound: round
			});
			const result = votingPhase.reduce(state, {
				type: 'submit-vote',
				playerId: 'p1',
				answerId: 'ans-p1'
			});
			expect(result.state).toBe(state);
		});

		it('rejects unknown answerId', () => {
			const state = makeVoting({ players: [makePlayer({ id: 'p1' })] });
			const result = votingPhase.reduce(state, {
				type: 'submit-vote',
				playerId: 'p1',
				answerId: 'nope'
			});
			expect(result.state).toBe(state);
		});

		it('transitions to scoring with rewards when all voted', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('ans-p1', 'p1', 'fake1'),
					makePlayerAnswer('ans-p2', 'p2', 'fake2')
				],
				playerVotes: { p1: 'correct-1' }
			});
			const state = makeVoting({
				players: [
					makePlayer({ id: 'p1', hasVoted: true }),
					makePlayer({ id: 'p2', hasVoted: false })
				],
				currentRound: round
			});
			const result = votingPhase.reduce(state, {
				type: 'submit-vote',
				playerId: 'p2',
				answerId: 'ans-p1'
			});
			expect(result.state.phase).toBe('scoring');
			if (result.state.phase !== 'scoring') throw new Error('expected scoring');
			// p1 voted correct = 2 pts; p2 voted for p1's fake → p1 fooled p2 → 3 pts to p1
			expect(result.state.currentRound.rewardedPoints['p1']).toBe(5);
			expect(result.state.players.find((p) => p.id === 'p1')!.score).toBe(5);
		});
	});

	describe('project', () => {
		it('exposes shuffled possibleAnswers with isOwn flag', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('ans-p1', 'p1', 'mine'),
					makePlayerAnswer('ans-p2', 'p2', 'theirs')
				]
			});
			const state = makeVoting({
				players: [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })],
				currentRound: round
			});
			const view = votingPhase.project(state, 'p1');
			if (view.phase !== 'voting') throw new Error('expected voting');
			expect(view.possibleAnswers).toHaveLength(3);
			const mine = view.possibleAnswers.find((a) => a.id === 'ans-p1');
			expect(mine?.isOwn).toBe(true);
			const theirs = view.possibleAnswers.find((a) => a.id === 'ans-p2');
			expect(theirs?.isOwn).toBe(false);
		});
	});
});
