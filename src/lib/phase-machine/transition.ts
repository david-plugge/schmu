import { phaseRecords } from './registry';
import type { Action, InternalState, TransitionResult } from './types';

export function transition(state: InternalState, action: Action): TransitionResult {
	const record = phaseRecords[state.phase];
	if (!record.accepts.has(action.type)) return { state, effects: [] };
	// Cast: TS can't see that record's `P` matches state.phase, but the registry's
	// `satisfies { [P in Phase]: PhaseRecord<P> }` enforces it at construction.
	return record.reduce(state as never, action);
}
