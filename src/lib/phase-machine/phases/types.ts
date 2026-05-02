import type {
	Action,
	ActionType,
	InternalState,
	Phase,
	TransitionResult,
	ViewerGameState
} from '../types';

export type StateOf<P extends Phase> = Extract<InternalState, { phase: P }>;

export interface PhaseRecord<P extends Phase> {
	readonly accepts: ReadonlySet<ActionType>;
	reduce(state: StateOf<P>, action: Action): TransitionResult;
	project(state: StateOf<P>, viewerId: string): ViewerGameState;
}
