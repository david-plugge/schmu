import { GameDispatcher } from './game-dispatcher';
import { createDbCatalogue } from './question-catalogue';

class GameManager {
	private readonly games = new Map<string, GameDispatcher>();

	createGame(playerId: string, playerName: string): string {
		const code = createRandomCode();
		const game = new GameDispatcher(code, {
			catalogue: createDbCatalogue(),
			mintId: () => crypto.randomUUID()
		});
		game.dispatch({ type: 'add-player', playerId, name: playerName, isHost: true });
		this.games.set(code, game);
		return code;
	}

	joinGame(code: string, playerId: string, playerName: string): void {
		const game = this.games.get(code);
		if (!game) throw new Error('Game not found');
		game.dispatch({ type: 'add-player', playerId, name: playerName, isHost: false });
	}

	getGame(code: string): GameDispatcher | undefined {
		return this.games.get(code);
	}
}

function createRandomCode(): string {
	return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export const gameManager = new GameManager();
