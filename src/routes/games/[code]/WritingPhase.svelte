<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { ViewerGameState } from '$lib/phase-machine';
	import { ThumbsDown, ThumbsUp, SkipForward } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { submitAnswer, toggleQuestionVote, skipWord } from './game.remote';

	type Props = {
		state: Extract<ViewerGameState, { phase: 'writing' }>;
	};
	let { state }: Props = $props();

	let skipCount = $derived(state.players.filter((p) => p.hasSkipped).length);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { value: _, ...inputField } = $derived(submitAnswer.fields.answer.as('text'));
</script>

{#if state.you.hasSubmitted}
	<div class="flex min-h-[40vh] flex-col items-center justify-center gap-4">
		<div class="text-4xl">&#9996;</div>
		<p class="text-lg text-neon-green">Antwort abgegeben!</p>
		<p class="text-sm text-muted-foreground">
			Warte auf die anderen ({state.players.filter((p) => p.hasSubmitted).length}/{state.players
				.length})
		</p>
	</div>
{:else}
	<div class="flex flex-col gap-6">
		<div
			class="rounded-xl border border-neon-purple/30 bg-card/80 p-6 text-center backdrop-blur-sm"
		>
			<p class="mb-2 text-sm text-muted-foreground">Was ist eigentlich...</p>
			<p class="text-3xl font-black text-neon-yellow">{state.currentWord}</p>
		</div>

		<form {...submitAnswer} class="flex flex-col gap-3">
			<input {...submitAnswer.fields.code.as('hidden', state.code)} />
			<Input
				{...inputField}
				placeholder="Deine kreative Antwort..."
				class="border-neon-purple/30 bg-background/50 text-lg placeholder:text-muted-foreground/50 focus:border-neon-pink"
			/>
			<Button
				type="submit"
				class="bg-neon-pink font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
			>
				Abschicken
			</Button>
		</form>

		<div class="flex items-center justify-center gap-3">
			<button
				onclick={() => toggleQuestionVote({ code: state.code, vote: 'up' })}
				class={cn(
					'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
					state.myQuestionVote === 'up'
						? 'bg-neon-green/20 text-neon-green'
						: 'text-muted-foreground hover:bg-neon-green/10 hover:text-neon-green'
				)}
			>
				<ThumbsUp size={16} />
				Gutes Wort
			</button>
			<button
				onclick={() => toggleQuestionVote({ code: state.code, vote: 'down' })}
				class={cn(
					'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
					state.myQuestionVote === 'down'
						? 'bg-neon-pink/20 text-neon-pink'
						: 'text-muted-foreground hover:bg-neon-pink/10 hover:text-neon-pink'
				)}
			>
				<ThumbsDown size={16} />
				Schlechtes Wort
			</button>
			<button
				onclick={() => skipWord({ code: state.code })}
				class={cn(
					'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors',
					state.you.hasSkipped
						? 'bg-neon-purple/20 text-neon-purple'
						: 'text-muted-foreground hover:bg-neon-purple/10 hover:text-neon-purple'
				)}
			>
				<SkipForward size={16} />
				Überspringen
				{#if skipCount > 0}
					({skipCount}/{state.players.length})
				{/if}
			</button>
		</div>
	</div>
{/if}
