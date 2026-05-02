<script lang="ts">
	import { getLoggedInUser } from '../../setup.remote';
	import { getGame } from './game.remote';
	import LobbyPhase from './LobbyPhase.svelte';
	import ScoringPhase from './ScoringPhase.svelte';
	import VotingPhase from './VotingPhase.svelte';
	import WritingPhase from './WritingPhase.svelte';

	let { params } = $props();

	const user = $derived(await getLoggedInUser());

	const gameStateLive = $derived(getGame(params.code));
	const gameState = $derived(await gameStateLive);
	const currentPlayer = $derived.by(() =>
		gameState?.players.find((player) => player.id === user.id)
	);
</script>

<div class="mx-auto max-w-2xl p-4">
	{#if !gameState}
		<div class="flex min-h-[50vh] items-center justify-center">
			<p class="animate-pulse text-lg text-neon-cyan">Beitritt läuft...</p>
		</div>
	{:else}
		{#if gameState.phase !== 'lobby'}
			<div class="mb-6 text-center">
				<span class="rounded-full bg-neon-purple/20 px-4 py-1 text-sm font-bold text-neon-purple">
					Runde {gameState.currentRound}
				</span>
			</div>
		{/if}

		{#if gameState.phase === 'lobby'}
			<LobbyPhase
				code={params.code}
				players={gameState.players}
				isHost={currentPlayer?.isHost ?? false}
			/>
		{:else if gameState.phase === 'loading-question'}
			<div class="flex min-h-[50vh] items-center justify-center">
				<p class="animate-pulse text-lg text-neon-yellow">Frage wird geladen...</p>
			</div>
		{:else if gameState.phase === 'writing' && currentPlayer}
			<WritingPhase
				code={params.code}
				currentWord={gameState.currentWord!}
				{currentPlayer}
				players={gameState.players}
				hasDownvotedQuestion={gameState.hasDownvotedQuestion ?? false}
			/>
		{:else if gameState.phase === 'voting' && currentPlayer && gameState.possibleAnswers}
			<VotingPhase
				code={params.code}
				currentWord={gameState.currentWord!}
				{currentPlayer}
				possibleAnswers={gameState.possibleAnswers}
			/>
		{:else if gameState.phase === 'scoring' && gameState.roundResults}
			<ScoringPhase
				code={params.code}
				currentWord={gameState.currentWord!}
				players={gameState.players}
				isHost={currentPlayer?.isHost ?? false}
				roundResults={gameState.roundResults}
			/>
		{/if}
	{/if}
</div>
