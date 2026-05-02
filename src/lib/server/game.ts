import type { GamePhase, GameState, Player, Question, Round } from '$lib/types';
import { getRandomQuestions } from './db/questions';

type GameStateListener = (state: GameState) => void;

const CORRECT_ANSWER_REWARD = 2;
const FOOLED_ANSWER_REWARD = 3;

export class GameInstance {
	private readonly listeners = new Set<GameStateListener>();

	public readonly code: string;
	private phase: GamePhase;
	private players = new Map<string, Player>();
	private readonly questionQueue: Question[] = [];
	private currentRound: Round | null = null;
	private readonly rounds: Round[] = [];

	constructor(code: string) {
		this.code = code;
		this.phase = 'lobby';
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
			hasVoted: false
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

	public submitVote(playerId: string, answerId: string) {
		if (this.phase !== 'voting' || !this.currentRound) return;
		const player = this.players.get(playerId);
		if (!player) return;
		const answer = this.currentRound.answers.find((a) => a.id === answerId);
		if (!answer) return;

		this.currentRound.playerVotes[playerId] = answer.id;
		player.hasVoted = true;

		if (this.players.values().every((p) => p.hasVoted)) {
			this.transitionTo('scoring');
		} else {
			this.notify();
		}
	}

	public nextRound() {
		try {
			this.setupNewRound();
			this.transitionTo('writing');
		} catch {
			this.transitionTo('error');
		}
	}

	public subscribe(sub: GameStateListener) {
		this.listeners.add(sub);
		sub(this.getGameState());

		return () => {
			this.listeners.delete(sub);
		};
	}

	private notify() {
		const state = this.getGameState();
		for (const sub of this.listeners) {
			sub(state);
		}
	}

	private getGameState(): GameState {
		return {
			code: this.code,
			phase: this.phase,
			players: this.players.values().toArray(),
			currentRound: this.rounds.length + 1,
			possibleAnswers:
				(this.phase === 'reading' || this.phase === 'voting') && this.currentRound
					? this.currentRound.answers.map((a) => ({
							id: a.id,
							text: a.text
						}))
					: undefined,
			currentWord: this.currentRound?.word,
			roundResults:
				this.phase === 'scoring' && this.currentRound
					? {
							correctAnswerId: this.currentRound.correctAnswerId,
							playerGuesses: this.currentRound.playerVotes,
							pointsChanges: this.currentRound.rewardedPoints,
							answers: this.currentRound.answers
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
			rewardedPoints: {},
			playerVotes: {}
		};
		this.players.forEach((player) => {
			player.hasSubmitted = false;
			player.hasVoted = false;
		});
	}

	private getNextQuestion() {
		if (!this.questionQueue.length) {
			this.loadQuestions();
		}

		return this.questionQueue.shift();
	}

	private loadQuestions() {
		const newQuestions = getRandomQuestions(5, this.getUsedWords());
		this.questionQueue.push(...newQuestions);
	}

	private getUsedWords() {
		return this.rounds.map((r) => r.word);
	}
}
