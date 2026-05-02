import { CATEGORY_SLUGS, type CategorySlug } from '$lib/categories';
import { extractBase, isHost } from '../helpers';
import type {
	Action,
	ActionType,
	InternalPlayer,
	TransitionResult,
	ViewerGameState
} from '../types';
import type { PhaseRecord, StateOf } from './types';

const accepts: ReadonlySet<ActionType> = new Set([
	'add-player',
	'set-categories',
	'start-game',
	'end-game'
]);

function reduce(state: StateOf<'lobby'>, action: Action): TransitionResult {
	switch (action.type) {
		case 'add-player': {
			if (state.players.some((p) => p.id === action.playerId)) {
				return { state, effects: [] };
			}
			const newPlayer: InternalPlayer = {
				id: action.playerId,
				name: action.name,
				isHost: action.isHost,
				score: 0,
				hasSubmitted: false,
				hasVoted: false,
				hasSkipped: false
			};
			return {
				state: { ...state, players: [...state.players, newPlayer] },
				effects: []
			};
		}
		case 'set-categories': {
			if (!isHost(state, action.playerId)) return { state, effects: [] };
			const unique: CategorySlug[] = [...new Set(action.categories)].filter((c) =>
				CATEGORY_SLUGS.includes(c)
			);
			if (unique.length === 0) return { state, effects: [] };
			return {
				state: { ...state, enabledCategories: unique },
				effects: []
			};
		}
		case 'start-game': {
			if (!isHost(state, action.playerId)) return { state, effects: [] };
			if (state.players.length === 0) return { state, effects: [] };
			return {
				state: {
					...extractBase(state),
					phase: 'loading-question',
					loadId: action.loadId
				},
				effects: [
					{
						type: 'load-next-question',
						loadId: action.loadId,
						usedWords: state.usedWords,
						categories: state.enabledCategories
					}
				]
			};
		}
		case 'end-game': {
			if (!isHost(state, action.playerId)) return { state, effects: [] };
			return {
				state: { ...extractBase(state), phase: 'ended' },
				effects: []
			};
		}
	}
	return { state, effects: [] };
}

function project(state: StateOf<'lobby'>): ViewerGameState {
	return {
		phase: 'lobby',
		code: state.code,
		players: state.players.map((p) => ({ ...p })),
		currentRoundNumber: state.roundIndex + 1,
		enabledCategories: [...state.enabledCategories]
	};
}

export const lobbyPhase: PhaseRecord<'lobby'> = { accepts, reduce, project };
