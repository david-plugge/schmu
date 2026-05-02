<script lang="ts">
	import { cn } from '$lib/utils';
	import type { ViewerGameState } from '$lib/phase-machine';
	import { submitVote } from './game.remote';

	type Props = {
		// renamed to `view` locally because Svelte 5's `$state` rune conflicts with a binding named `state`
		state: Extract<ViewerGameState, { phase: 'voting' }>;
	};
	let { state: view }: Props = $props();

	let myVoteId = $state<string>();

	function vote(answerId: string) {
		if (view.you.hasVoted) return;

		myVoteId = answerId;
		submitVote({ answerId, code: view.code });
	}
</script>

<div class="flex flex-col gap-6">
	<div class="rounded-xl border border-neon-purple/30 bg-card/80 p-6 text-center backdrop-blur-sm">
		<p class="mb-2 text-sm text-muted-foreground">Was bedeutet...</p>
		<p class="text-3xl font-black text-neon-yellow">{view.currentWord}</p>
	</div>

	<div class="flex flex-col gap-3">
		{#each view.possibleAnswers as answer, i (answer.id)}
			{@const colors = ['neon-pink', 'neon-cyan', 'neon-green', 'neon-yellow', 'neon-purple']}
			{@const color = colors[i % colors.length]}
			<button
				type="button"
				class={cn(
					'rounded-xl border-2 p-5 text-left text-lg transition-all',
					answer.isOwn && 'cursor-not-allowed opacity-50',
					myVoteId === answer.id
						? 'border-neon-green bg-neon-green/10 shadow-md shadow-neon-green/20'
						: `border-${color}/30 bg-card/60 hover:border-${color}/60 hover:bg-card/80`,
					view.you.hasVoted && myVoteId !== answer.id && 'opacity-50'
				)}
				disabled={view.you.hasVoted || answer.isOwn}
				onclick={() => vote(answer.id)}
			>
				<span
					class="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-{color}/20 text-sm font-bold text-{color}"
				>
					{String.fromCharCode(65 + i)}
				</span>
				{answer.text}
			</button>
		{/each}
	</div>
</div>
