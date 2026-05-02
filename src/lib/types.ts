export type GamePhase =
	| 'error'
	| 'lobby'
	| 'loading-question'
	| 'writing'
	| 'reading'
	| 'voting'
	| 'scoring'
	| 'winner'
	| 'ended';

export interface Player {
	id: string;
	name: string;
	score: number;
	isHost: boolean;
	hasSubmitted: boolean;
	hasVoted: boolean;
	hasSkipped: boolean;
}

export interface GameState {
	code: string;
	players: Player[];
	phase: GamePhase;
	currentRound: number;
	currentWord?: string;
	hasDownvotedQuestion?: boolean;
	possibleAnswers?: Array<{
		id: string;
		text: string;
		isOwn: boolean;
	}>;
	roundResults?: {
		correctAnswerId: string;
		playerGuesses: Record<string, string>;
		pointsChanges: Record<string, number>;
		answers: Array<{
			id: string;
			text: string;
			owner:
				| {
						type: 'system';
				  }
				| {
						type: 'player';
						name: string;
						isOwn: boolean;
				  };
		}>;
		myGuessId?: string;
		myQuestionVote?: 'up' | 'down';
	};
}

export interface Question {
	id: number;
	word: string;
	definition: string;
}

export interface Round {
	word: string;
	questionId: number;
	correctAnswerId: string;
	answers: Array<{
		id: string;
		owner:
			| {
					type: 'system';
			  }
			| {
					type: 'player';
					playerId: string;
			  };
		text: string;
	}>;
	playerVotes: Record<string, string>;
	rewardedPoints: Record<string, number>;
	questionVotes: Record<string, 'up' | 'down'>;
}
