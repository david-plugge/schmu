import { GameInstance } from './game';

class GameManager {
	private readonly games = new Map<string, GameInstance>();

	createGame(playerId: string, playerName: string) {
		const code = createRandomCode();
		const game = new GameInstance(code);
		game.addPlayer(playerId, playerName, true);
		this.games.set(code, game);
		return code;
	}

	joinGame(code: string, playerId: string, playerName: string) {
		const game = this.games.get(code);
		if (!game) throw new Error('Game not found');
		game.addPlayer(playerId, playerName, false);
	}

	endGame(code: string) {
		const game = this.games.get(code);
		if (!game) throw new Error('Game not found');
		game.endGame();
		this.games.delete(code);
	}

	getGame(code: string) {
		return this.games.get(code);
	}
}

function createRandomCode() {
	return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export const gameManager = new GameManager();
