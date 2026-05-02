import { describe, expect, it } from 'vitest';
import {
	addAnswer,
	calculateRewardedPoints,
	recordPlayerVote,
	toggleQuestionVote,
	withRewardedPoints
} from '../round';
import { makePlayerAnswer, makeRound } from './builders';

describe('round', () => {
	describe('addAnswer', () => {
		it('appends without mutating', () => {
			const round = makeRound();
			const before = round.answers;
			const next = addAnswer(round, makePlayerAnswer('a-p1', 'p1', 'fake'));
			expect(next.answers).toHaveLength(2);
			expect(round.answers).toBe(before);
			expect(round.answers).toHaveLength(1);
		});
	});

	describe('recordPlayerVote', () => {
		it('records a vote for a valid answer', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('a-p2', 'p2', 'fake')
				]
			});
			const next = recordPlayerVote(round, 'p1', 'correct-1');
			expect(next).not.toBeNull();
			expect(next!.playerVotes).toEqual({ p1: 'correct-1' });
		});

		it('returns null for unknown answer', () => {
			const round = makeRound();
			expect(recordPlayerVote(round, 'p1', 'nope')).toBeNull();
		});

		it('returns null when voting for own answer', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('a-p1', 'p1', 'mine')
				]
			});
			expect(recordPlayerVote(round, 'p1', 'a-p1')).toBeNull();
		});
	});

	describe('toggleQuestionVote', () => {
		it('first up vote yields delta +1', () => {
			const round = makeRound();
			const { round: next, delta } = toggleQuestionVote(round, 'p1', 'up');
			expect(next.questionVotes).toEqual({ p1: 'up' });
			expect(delta).toBe(1);
		});

		it('toggling same vote clears it (delta -1 for clearing up)', () => {
			const round = makeRound({ questionVotes: { p1: 'up' } });
			const { round: next, delta } = toggleQuestionVote(round, 'p1', 'up');
			expect(next.questionVotes).toEqual({});
			expect(delta).toBe(-1);
		});

		it('switching from up to down emits -2 delta', () => {
			const round = makeRound({ questionVotes: { p1: 'up' } });
			const { round: next, delta } = toggleQuestionVote(round, 'p1', 'down');
			expect(next.questionVotes).toEqual({ p1: 'down' });
			expect(delta).toBe(-2);
		});

		it('switching from down to up emits +2 delta', () => {
			const round = makeRound({ questionVotes: { p1: 'down' } });
			const { delta } = toggleQuestionVote(round, 'p1', 'up');
			expect(delta).toBe(2);
		});

		it('multiple players vote independently', () => {
			const round = makeRound({ questionVotes: { p1: 'up' } });
			const { round: next } = toggleQuestionVote(round, 'p2', 'down');
			expect(next.questionVotes).toEqual({ p1: 'up', p2: 'down' });
		});
	});

	describe('calculateRewardedPoints', () => {
		it('correct guess earns 2', () => {
			const round = makeRound({ playerVotes: { p1: 'correct-1' } });
			expect(calculateRewardedPoints(round)).toEqual({ p1: 2 });
		});

		it('fooling another player earns 3 to the answer owner', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('a-p1', 'p1', 'fake')
				],
				playerVotes: { p2: 'a-p1' }
			});
			expect(calculateRewardedPoints(round)).toEqual({ p1: 3 });
		});

		it('mixed: p1 correct (2) + p2 fooled by p1 (3) → p1=5, p2=0', () => {
			const round = makeRound({
				answers: [
					{ id: 'correct-1', owner: { type: 'system' }, text: 'real' },
					makePlayerAnswer('a-p1', 'p1', 'fake1'),
					makePlayerAnswer('a-p2', 'p2', 'fake2')
				],
				playerVotes: { p1: 'correct-1', p2: 'a-p1' }
			});
			expect(calculateRewardedPoints(round)).toEqual({ p1: 5 });
		});
	});

	describe('withRewardedPoints', () => {
		it('attaches rewardedPoints without mutating', () => {
			const round = makeRound();
			const next = withRewardedPoints(round, { p1: 5 });
			expect(next.rewardedPoints).toEqual({ p1: 5 });
			expect(round.rewardedPoints).toEqual({});
		});
	});
});
