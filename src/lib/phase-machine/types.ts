import type { CategorySlug } from '$lib/categories';

export type Vote = 'up' | 'down';

export interface Question {
	id: number;
	word: string;
	definition: string;
}

export type Phase =
	| 'lobby'
	| 'loading-question'
	| 'writing'
	| 'voting'
	| 'scoring'
	| 'error'
	| 'ended';

// ─── Internal state ──────────────────────────────────────────────────────────

export type AnswerOwner = { type: 'system' } | { type: 'player'; playerId: string };

export interface InternalAnswer {
	id: string;
	owner: AnswerOwner;
	text: string;
}

export interface InternalRound {
	word: string;
	questionId: number;
	correctAnswerId: string;
	answers: InternalAnswer[];
	playerVotes: Record<string, string>;
	rewardedPoints: Record<string, number>;
	questionVotes: Record<string, Vote>;
}

export interface InternalPlayer {
	id: string;
	name: string;
	isHost: boolean;
	score: number;
	hasSubmitted: boolean;
	hasVoted: boolean;
	hasSkipped: boolean;
}

interface BaseState {
	code: string;
	players: InternalPlayer[];
	enabledCategories: CategorySlug[];
	roundIndex: number;
	usedWords: string[];
}

export type InternalState = BaseState &
	(
		| { phase: 'lobby' }
		| { phase: 'loading-question'; loadId: string }
		| { phase: 'writing'; currentRound: InternalRound }
		| { phase: 'voting'; currentRound: InternalRound }
		| { phase: 'scoring'; currentRound: InternalRound }
		| { phase: 'error'; reason: string }
		| { phase: 'ended' }
	);

// ─── Actions ─────────────────────────────────────────────────────────────────

export type Action =
	// Player setup
	| { type: 'add-player'; playerId: string; name: string; isHost: boolean }
	// Player intents
	| { type: 'submit-answer'; playerId: string; answerId: string; text: string }
	| { type: 'submit-vote'; playerId: string; answerId: string }
	| { type: 'toggle-skip'; playerId: string }
	| { type: 'toggle-question-vote'; playerId: string; vote: Vote }
	// Host intents
	| { type: 'set-categories'; playerId: string; categories: CategorySlug[] }
	| { type: 'start-game'; playerId: string; loadId: string }
	| { type: 'next-round'; playerId: string; loadId: string }
	| { type: 'end-game'; playerId: string }
	| { type: 'back-to-lobby'; playerId: string }
	// System intents (no senderPlayerId)
	| {
			type: 'question-loaded';
			loadId: string;
			question: Question;
			correctAnswerId: string;
	  }
	| { type: 'question-load-failed'; loadId: string; reason: string };

export type ActionType = Action['type'];

// ─── Effects ─────────────────────────────────────────────────────────────────

export type Effect =
	| {
			type: 'load-next-question';
			loadId: string;
			usedWords: string[];
			categories: CategorySlug[];
	  }
	| { type: 'vote-question'; questionId: number; delta: number }
	| { type: 'increment-times-played'; questionId: number };

// ─── Viewer state ────────────────────────────────────────────────────────────

export interface ViewerPlayer {
	id: string;
	name: string;
	isHost: boolean;
	score: number;
	hasSubmitted: boolean;
	hasVoted: boolean;
	hasSkipped: boolean;
}

export interface ViewerAnswer {
	id: string;
	text: string;
	isOwn: boolean;
}

export type ViewerAnswerOwner =
	| { type: 'system' }
	| { type: 'player'; name: string; isOwn: boolean };

export interface ViewerRoundResults {
	correctAnswerId: string;
	playerGuesses: Record<string, string>;
	pointsChanges: Record<string, number>;
	answers: Array<{ id: string; text: string; owner: ViewerAnswerOwner }>;
	myGuessId: string | undefined;
}

interface BaseViewerState {
	code: string;
	players: ViewerPlayer[];
	currentRoundNumber: number;
}

export type ViewerGameState = BaseViewerState &
	(
		| { phase: 'lobby'; enabledCategories: CategorySlug[] }
		| { phase: 'loading-question' }
		| { phase: 'writing'; currentWord: string; myQuestionVote: Vote | undefined }
		| { phase: 'voting'; currentWord: string; possibleAnswers: ViewerAnswer[] }
		| {
				phase: 'scoring';
				currentWord: string;
				roundResults: ViewerRoundResults;
				myQuestionVote: Vote | undefined;
		  }
		| { phase: 'error'; reason: string }
		| { phase: 'ended' }
	);

// ─── Transition result ───────────────────────────────────────────────────────

export interface TransitionResult {
	state: InternalState;
	effects: Effect[];
}
