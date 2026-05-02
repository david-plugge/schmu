import { endedPhase } from './phases/ended';
import { errorPhase } from './phases/error';
import { lobbyPhase } from './phases/lobby';
import { loadingQuestionPhase } from './phases/loading-question';
import { scoringPhase } from './phases/scoring';
import { votingPhase } from './phases/voting';
import { writingPhase } from './phases/writing';
import type { PhaseRecord } from './phases/types';
import type { Phase } from './types';

export const phaseRecords = {
	lobby: lobbyPhase,
	'loading-question': loadingQuestionPhase,
	writing: writingPhase,
	voting: votingPhase,
	scoring: scoringPhase,
	error: errorPhase,
	ended: endedPhase
} as const satisfies { [P in Phase]: PhaseRecord<P> };
