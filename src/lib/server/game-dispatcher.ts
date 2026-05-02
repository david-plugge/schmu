import {
	initialState,
	project,
	transition,
	type Action,
	type Effect,
	type InternalState,
	type ViewerGameState
} from '$lib/phase-machine';
import type { QuestionCatalogue } from './question-catalogue';

export interface DispatcherDeps {
	catalogue: QuestionCatalogue;
	mintId(): string;
}

type Listener = () => void;

export class NotAMemberError extends Error {
	constructor(
		public readonly code: string,
		public readonly viewerId: string
	) {
		super(`viewer ${viewerId} is not a member of game ${code}`);
		this.name = 'NotAMemberError';
	}
}

export class GameDispatcher {
	private state: InternalState;
	private readonly listeners = new Set<Listener>();

	constructor(
		public readonly code: string,
		private readonly deps: DispatcherDeps
	) {
		this.state = initialState(code);
	}

	dispatch(action: Action): void {
		const result = transition(this.state, action);
		const stateChanged = result.state !== this.state;
		this.state = result.state;
		if (stateChanged) this.notify();
		this.executeEffects(result.effects);
	}

	subscribe(viewerId: string, sub: (state: ViewerGameState) => void): () => void {
		if (!this.state.players.some((p) => p.id === viewerId)) {
			throw new NotAMemberError(this.code, viewerId);
		}
		const listener: Listener = () => sub(project(this.state, viewerId));
		this.listeners.add(listener);
		listener();
		return () => {
			this.listeners.delete(listener);
		};
	}

	private executeEffects(effects: Effect[]): void {
		for (const effect of effects) {
			switch (effect.type) {
				case 'vote-question':
					this.deps.catalogue.recordVote(effect.questionId, effect.delta);
					break;
				case 'increment-times-played':
					this.deps.catalogue.recordPlay(effect.questionId);
					break;
				case 'load-next-question':
					this.handleLoad(effect);
					break;
			}
		}
	}

	private handleLoad(effect: Extract<Effect, { type: 'load-next-question' }>): void {
		try {
			const question = this.deps.catalogue.pickNext(effect.categories);
			if (!question) {
				this.dispatch({
					type: 'question-load-failed',
					loadId: effect.loadId,
					reason: 'no-questions'
				});
				return;
			}
			this.dispatch({
				type: 'question-loaded',
				loadId: effect.loadId,
				question,
				correctAnswerId: this.deps.mintId()
			});
		} catch (err) {
			this.dispatch({
				type: 'question-load-failed',
				loadId: effect.loadId,
				reason: err instanceof Error ? err.message : String(err)
			});
		}
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
