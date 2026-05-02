import { CATEGORY_SLUGS } from '$lib/categories';
import type { InternalState } from './types';

export function initialState(code: string): InternalState {
	return {
		phase: 'lobby',
		code,
		players: [],
		enabledCategories: [...CATEGORY_SLUGS],
		roundIndex: 0,
		usedWords: []
	};
}
