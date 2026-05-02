import { phaseRecords } from './registry';
import type { InternalState, ViewerGameState } from './types';

export function project(state: InternalState, viewerId: string): ViewerGameState {
	return phaseRecords[state.phase].project(state as never, viewerId);
}
