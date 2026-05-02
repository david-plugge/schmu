import type { CategorySlug } from '$lib/categories';
import {
	initialState,
	project,
	transition,
	type Action,
	type Effect,
	type InternalState,
	type Question,
	type ViewerGameState
} from '$lib/phase-machine';

export interface DispatcherDeps {
	loadQuestion(usedWords: string[], categories: CategorySlug[]): Promise<Question | null>;
	voteQuestion(questionId: number, delta: number): void;
	incrementTimesPlayed(questionId: number): void;
	mintId(): string;
}

type Listener = () => void;

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
					this.deps.voteQuestion(effect.questionId, effect.delta);
					break;
				case 'increment-times-played':
					this.deps.incrementTimesPlayed(effect.questionId);
					break;
				case 'load-next-question':
					void this.handleLoad(effect);
					break;
			}
		}
	}

	private async handleLoad(effect: Extract<Effect, { type: 'load-next-question' }>): Promise<void> {
		try {
			const question = await this.deps.loadQuestion(effect.usedWords, effect.categories);
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
