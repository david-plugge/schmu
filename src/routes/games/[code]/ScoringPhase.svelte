<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { GameState, Player } from '$lib/types';
	import { startNextRound, voteOnQuestion } from './game.remote';
	import { ThumbsUp, ThumbsDown } from '@lucide/svelte';

	type Props = {
		code: string;
		currentWord: string;
		players: Player[];
		isHost: boolean;
		roundResults: NonNullable<GameState['roundResults']>;
	};
	let { code, currentWord, players, isHost, roundResults: results }: Props = $props();
</script>

<div class="flex flex-col gap-6">
	<div class="rounded-xl border border-neon-purple/30 bg-card/80 p-6 text-center backdrop-blur-sm">
		<p class="mb-2 text-sm text-muted-foreground">Was bedeutet...</p>
		<p class="text-3xl font-black text-neon-yellow">{currentWord}</p>
	</div>

	<!-- All answers with attribution -->
	<div class="flex flex-col gap-3">
		{#each results.answers as answer (answer.id)}
			{@const isCorrect = answer.id === results.correctAnswerId}
			{@const isMyGuess = answer.id === results.myGuessId}
			{@const voters = Object.entries(results.playerGuesses)
				.filter(([, aid]) => aid === answer.id)
				.map(([pid]) => players.find((p) => p.id === pid)?.name)
				.filter(Boolean)}
			<div
				class={cn(
					'rounded-xl border-2 p-4',
					isCorrect
						? 'border-neon-green/50 bg-neon-green/10'
						: isMyGuess
							? 'border-neon-pink/50 bg-neon-pink/10'
							: 'border-border/50 bg-card/60'
				)}
			>
				<div class="flex items-start justify-between gap-2">
					<p class="text-lg">{answer.text}</p>
					{#if isMyGuess}
						<span
							class="shrink-0 rounded-full bg-neon-cyan/20 px-2 py-0.5 text-xs font-bold text-neon-cyan"
						>
							Deine Wahl
						</span>
					{/if}
				</div>
				<p class="mt-1 text-sm text-muted-foreground">
					{#if answer.owner.type === 'system'}
						Richtige Antwort
					{:else}
						{answer.owner.name}
					{/if}
				</p>
				{#if voters.length > 0}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each voters as name, i (i)}
							<span
								class={cn(
									'rounded-full px-2 py-0.5 text-xs font-bold',
									isCorrect ? 'bg-neon-green/20 text-neon-green' : 'bg-neon-pink/20 text-neon-pink'
								)}
							>
								{name}
								{#if isCorrect}
									+2
								{:else}
									→ +3
								{/if}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Question vote -->
	<div class="flex items-center justify-center gap-4">
		<span class="text-sm text-muted-foreground">Frage bewerten:</span>
		<button
			onclick={() => voteOnQuestion({ code, vote: 'up' })}
			class={cn(
				'rounded-lg p-2 transition-colors',
				results.myQuestionVote === 'up'
					? 'bg-neon-green/20 text-neon-green'
					: 'text-muted-foreground hover:bg-neon-green/10 hover:text-neon-green'
			)}
		>
			<ThumbsUp size={20} />
		</button>
		<button
			onclick={() => voteOnQuestion({ code, vote: 'down' })}
			class={cn(
				'rounded-lg p-2 transition-colors',
				results.myQuestionVote === 'down'
					? 'bg-neon-pink/20 text-neon-pink'
					: 'text-muted-foreground hover:bg-neon-pink/10 hover:text-neon-pink'
			)}
		>
			<ThumbsDown size={20} />
		</button>
	</div>

	<!-- Points changes -->
	<div class="rounded-xl border border-neon-purple/30 bg-card/80 p-4">
		<h3 class="mb-3 text-center text-sm font-bold text-neon-purple">Punkte</h3>
		<div class="flex flex-col gap-1">
			{#each players.sort((a, b) => b.score - a.score) as player (player.id)}
				{@const pointsChange = results.pointsChanges[player.id] ?? 0}
				<div class="flex items-center justify-between rounded-lg px-3 py-2">
					<span class="font-medium">{player.name}</span>
					<div class="flex items-center gap-3">
						{#if pointsChange > 0}
							<span class="text-sm font-bold text-neon-green">+{pointsChange}</span>
						{:else if pointsChange < 0}
							<span class="text-sm font-bold text-destructive">{pointsChange}</span>
						{/if}
						<span class="min-w-8 text-right font-mono text-lg font-bold text-neon-yellow">
							{player.score}
						</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#if isHost}
		<Button
			onclick={() => startNextRound({ code })}
			class="bg-neon-pink text-lg font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
		>
			Nächste Runde!
		</Button>
	{/if}
</div>
