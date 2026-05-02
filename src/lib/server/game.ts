import type { GamePhase, GameState, Player, Question, Round } from '$lib/types';
import { CATEGORY_SLUGS, type CategorySlug } from '$lib/categories';
import { getRandomQuestions, incrementTimesPlayed, voteQuestion } from './db/questions';

type GameStateListener = (state: GameState) => void;

const CORRECT_ANSWER_REWARD = 2;
const FOOLED_ANSWER_REWARD = 3;

function hashSeed(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number) {
	let s = seed;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffleSeeded<T>(arr: readonly T[], seed: string): T[] {
	const result = arr.slice();
	const rng = mulberry32(hashSeed(seed));
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export class GameInstance {
	private readonly listeners = new Set<() => void>();

	public readonly code: string;
	private phase: GamePhase;
	private players = new Map<string, Player>();
	private readonly questionQueue: Question[] = [];
	private currentRound: Round | null = null;
	private readonly rounds: Round[] = [];
	private enabledCategories: CategorySlug[] = [...CATEGORY_SLUGS];

	constructor(code: string) {
		this.code = code;
		this.phase = 'lobby';
	}

	public setEnabledCategories(playerId: string, categories: CategorySlug[]) {
		if (this.phase !== 'lobby') return;
		const player = this.players.get(playerId);
		if (player?.isHost !== true) return;
		if (categories.length === 0) return;

		const unique = [...new Set(categories)].filter((c) => CATEGORY_SLUGS.includes(c));
		if (unique.length === 0) return;
		this.enabledCategories = unique;
		this.notify();
	}

	private transitionTo(phase: GamePhase) {
		if (this.phase === phase) return;
		console.log(`[${this.code}] Transition: ${this.phase} -> ${phase}`);
		this.phase = phase;

		switch (phase) {
			case 'scoring':
				this.calculateScores();
				this.saveRound();
				break;
		}

		this.notify();
	}

	public addPlayer(id: string, name: string, isHost: boolean) {
		if (this.phase !== 'lobby') return;
		if (this.players.has(id)) return;
		this.players.set(id, {
			id,
			name,
			isHost,
			score: 0,
			hasSubmitted: false,
			hasVoted: false,
			hasSkipped: false
		});
		this.notify();
	}

	public removePlayer(id: string) {
		const deleted = this.players.delete(id);
		if (!deleted) return;
		this.notify();
	}

	public startGame(playerId: string) {
		if (this.phase !== 'lobby') return;
		const player = this.players.get(playerId);
		if (player?.isHost !== true) return;

		this.nextRound();
	}

	public endGame() {
		this.transitionTo('ended');
	}

	public submitAnswer(playerId: string, text: string) {
		if (this.phase !== 'writing' || !this.currentRound) return;
		const player = this.players.get(playerId);
		if (!player) return;

		const answerId = crypto.randomUUID();
		this.currentRound.answers.push({
			id: answerId,
			owner: {
				type: 'player',
				playerId: player.id
			},
			text
		});
		player.hasSubmitted = true;

		if (this.players.values().every((p) => p.hasSubmitted)) {
			this.transitionTo('voting');
		} else {
			this.notify();
		}
	}

	public downvoteQuestion(playerId: string) {
		if (this.phase !== 'writing' || !this.currentRound) return;
		const player = this.players.get(playerId);
		if (!player) return;

		const previousVote = this.currentRound.questionVotes[playerId];
		if (previousVote === 'down') {
			delete this.currentRound.questionVotes[playerId];
			voteQuestion(this.currentRound.questionId, 1);
		} else {
			this.currentRound.questionVotes[playerId] = 'down';
			voteQuestion(this.currentRound.questionId, -1);
		}
		this.notify();
	}

	public skipWord(playerId: string) {
		if (this.phase !== 'writing' || !this.currentRound) return;
		const player = this.players.get(playerId);
		if (!player) return;

		player.hasSkipped = !player.hasSkipped;

		if (this.players.values().every((p) => p.hasSkipped)) {
			this.nextRound();
		} else {
			this.notify();
		}
	}

	public submitVote(playerId: string, answerId: string) {
		if (this.phase !== 'voting' || !this.currentRound) return;
		const player = this.players.get(playerId);
		if (!player) return;
		const answer = this.currentRound.answers.find((a) => a.id === answerId);
		if (!answer) return;
		if (answer.owner.type === 'player' && answer.owner.playerId === playerId) return;

		this.currentRound.playerVotes[playerId] = answer.id;
		player.hasVoted = true;

		if (this.players.values().every((p) => p.hasVoted)) {
			this.transitionTo('scoring');
		} else {
			this.notify();
		}
	}

	public voteOnQuestion(playerId: string, vote: 'up' | 'down') {
		if (this.phase !== 'scoring' || !this.currentRound) return;
		const player = this.players.get(playerId);
		if (!player) return;

		const previousVote = this.currentRound.questionVotes[playerId];
		if (previousVote === vote) return;

		// Calculate delta for DB update
		let delta = vote === 'up' ? 1 : -1;
		if (previousVote) {
			// Undo previous vote: if was 'up' subtract 1, if was 'down' add 1
			delta += previousVote === 'up' ? -1 : 1;
		}

		this.currentRound.questionVotes[playerId] = vote;
		voteQuestion(this.currentRound.questionId, delta);
		this.notify();
	}

	public nextRound() {
		try {
			const wasWriting = this.phase === 'writing';
			this.setupNewRound();
			if (wasWriting) {
				this.notify();
			} else {
				this.transitionTo('writing');
			}
		} catch (err) {
			console.error(`[${this.code}] nextRound failed:`, err);
			this.transitionTo('error');
		}
	}

	public subscribe(viewerPlayerId: string, sub: GameStateListener) {
		const listener = () => sub(this.getGameState(viewerPlayerId));
		this.listeners.add(listener);
		listener();

		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify() {
		for (const listener of this.listeners) {
			listener();
		}
	}

	private getGameState(viewerPlayerId: string): GameState {
		const shuffledAnswers = this.currentRound
			? shuffleSeeded(this.currentRound.answers, String(this.currentRound.questionId))
			: [];

		return {
			code: this.code,
			phase: this.phase,
			players: this.players.values().toArray(),
			currentRound: this.rounds.length + 1,
			enabledCategories: [...this.enabledCategories],
			hasDownvotedQuestion:
				this.phase === 'writing' && this.currentRound
					? this.currentRound.questionVotes[viewerPlayerId] === 'down'
					: undefined,
			possibleAnswers:
				(this.phase === 'reading' || this.phase === 'voting') && this.currentRound
					? shuffledAnswers.map((a) => ({
							id: a.id,
							text: a.text,
							isOwn: a.owner.type === 'player' && a.owner.playerId === viewerPlayerId
						}))
					: undefined,
			currentWord: this.currentRound?.word,
			roundResults:
				this.phase === 'scoring' && this.currentRound
					? {
							correctAnswerId: this.currentRound.correctAnswerId,
							playerGuesses: this.currentRound.playerVotes,
							pointsChanges: this.currentRound.rewardedPoints,
							answers: shuffledAnswers.map((a) => ({
								id: a.id,
								text: a.text,
								owner:
									a.owner.type === 'system'
										? { type: 'system' as const }
										: {
												type: 'player' as const,
												name: this.players.get(a.owner.playerId)?.name ?? 'Unbekannt',
												isOwn: a.owner.playerId === viewerPlayerId
											}
							})),
							myGuessId: this.currentRound.playerVotes[viewerPlayerId],
							myQuestionVote: this.currentRound.questionVotes[viewerPlayerId]
						}
					: undefined
		};
	}

	private calculateScores() {
		const round = this.currentRound;
		if (!round) return;

		for (const playerId in round.playerVotes) {
			const answer = round.answers.find((a) => a.id === round.playerVotes[playerId]);
			if (answer) {
				if (answer.owner.type === 'system') {
					round.rewardedPoints[playerId] ??= 0;
					round.rewardedPoints[playerId] += CORRECT_ANSWER_REWARD;
				} else {
					round.rewardedPoints[answer.owner.playerId] ??= 0;
					round.rewardedPoints[answer.owner.playerId] += FOOLED_ANSWER_REWARD;
				}
			}
		}

		for (const playerId in round.rewardedPoints) {
			const player = this.players.get(playerId);
			if (player) {
				player.score += round.rewardedPoints[playerId];
			}
		}
	}

	private saveRound() {
		if (!this.currentRound) return;
		this.rounds.push(this.currentRound);
	}

	private setupNewRound() {
		const question = this.getNextQuestion();
		if (!question) {
			throw new Error('unable to load next question');
		}
		const correctAnswerId = crypto.randomUUID();

		this.currentRound = {
			correctAnswerId,
			answers: [
				{
					id: correctAnswerId,
					owner: { type: 'system' },
					text: question.definition
				}
			],
			word: question.word,
			questionId: question.id,
			rewardedPoints: {},
			playerVotes: {},
			questionVotes: {}
		};
		incrementTimesPlayed(question.id);
		this.players.forEach((player) => {
			player.hasSubmitted = false;
			player.hasVoted = false;
			player.hasSkipped = false;
		});
	}

	private getNextQuestion() {
		if (!this.questionQueue.length) {
			this.loadQuestions();
		}

		return this.questionQueue.shift();
	}

	private loadQuestions() {
		const newQuestions = getRandomQuestions(5, this.getUsedWords(), this.enabledCategories);
		this.questionQueue.push(...newQuestions);
	}

	private getUsedWords() {
		return this.rounds.map((r) => r.word);
	}
}
