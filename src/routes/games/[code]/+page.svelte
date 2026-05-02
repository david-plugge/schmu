<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { backToLobby, getGame } from './game.remote';
	import LobbyPhase from './LobbyPhase.svelte';
	import ScoringPhase from './ScoringPhase.svelte';
	import VotingPhase from './VotingPhase.svelte';
	import WritingPhase from './WritingPhase.svelte';

	let { params } = $props();

	const gameStateLive = $derived(getGame(params.code));
	const gameState = $derived(await gameStateLive);
</script>

<div class="mx-auto max-w-2xl p-4">
	{#if !gameState}
		<div class="flex min-h-[50vh] items-center justify-center">
			<p class="animate-pulse text-lg text-neon-cyan">Beitritt läuft...</p>
		</div>
	{:else}
		{#if gameState.phase !== 'lobby' && gameState.phase !== 'ended' && gameState.phase !== 'error'}
			<div class="mb-6 text-center">
				<span class="rounded-full bg-neon-purple/20 px-4 py-1 text-sm font-bold text-neon-purple">
					Runde {gameState.currentRoundNumber}
				</span>
			</div>
		{/if}

		{#if gameState.phase === 'lobby'}
			<LobbyPhase state={gameState} />
		{:else if gameState.phase === 'loading-question'}
			<div class="flex min-h-[50vh] items-center justify-center">
				<p class="animate-pulse text-lg text-neon-yellow">Frage wird geladen...</p>
			</div>
		{:else if gameState.phase === 'writing'}
			<WritingPhase state={gameState} />
		{:else if gameState.phase === 'voting'}
			<VotingPhase state={gameState} />
		{:else if gameState.phase === 'scoring'}
			<ScoringPhase state={gameState} />
		{:else if gameState.phase === 'error'}
			<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
				<p class="text-lg text-neon-pink">Fehler: {gameState.reason}</p>
				{#if gameState.you.isHost}
					<Button onclick={() => backToLobby({ code: params.code })}>Zurück zur Lobby</Button>
				{/if}
			</div>
		{:else if gameState.phase === 'ended'}
			<div class="flex min-h-[50vh] items-center justify-center">
				<p class="text-lg text-neon-purple">Spiel beendet</p>
			</div>
		{/if}
	{/if}
</div>
