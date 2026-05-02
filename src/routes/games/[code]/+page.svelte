<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getLoggedInUser } from '../../setup.remote';
	import { backToLobby, getGame } from './game.remote';
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
		{#if gameState.phase !== 'lobby' && gameState.phase !== 'ended' && gameState.phase !== 'error'}
			<div class="mb-6 text-center">
				<span class="rounded-full bg-neon-purple/20 px-4 py-1 text-sm font-bold text-neon-purple">
					Runde {gameState.currentRoundNumber}
				</span>
			</div>
		{/if}

		{#if gameState.phase === 'lobby'}
			<LobbyPhase
				code={params.code}
				players={gameState.players}
				isHost={currentPlayer?.isHost ?? false}
				enabledCategories={gameState.enabledCategories}
			/>
		{:else if gameState.phase === 'loading-question'}
			<div class="flex min-h-[50vh] items-center justify-center">
				<p class="animate-pulse text-lg text-neon-yellow">Frage wird geladen...</p>
			</div>
		{:else if gameState.phase === 'writing' && currentPlayer}
			<WritingPhase
				code={params.code}
				currentWord={gameState.currentWord}
				{currentPlayer}
				players={gameState.players}
				myQuestionVote={gameState.myQuestionVote}
			/>
		{:else if gameState.phase === 'voting' && currentPlayer}
			<VotingPhase
				code={params.code}
				currentWord={gameState.currentWord}
				{currentPlayer}
				possibleAnswers={gameState.possibleAnswers}
			/>
		{:else if gameState.phase === 'scoring'}
			<ScoringPhase
				code={params.code}
				currentWord={gameState.currentWord}
				players={gameState.players}
				isHost={currentPlayer?.isHost ?? false}
				roundResults={gameState.roundResults}
				myQuestionVote={gameState.myQuestionVote}
			/>
		{:else if gameState.phase === 'error'}
			<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
				<p class="text-lg text-neon-pink">Fehler: {gameState.reason}</p>
				{#if currentPlayer?.isHost}
					<Button onclick={() => backToLobby(params.code)}>Zurück zur Lobby</Button>
				{/if}
			</div>
		{:else if gameState.phase === 'ended'}
			<div class="flex min-h-[50vh] items-center justify-center">
				<p class="text-lg text-neon-purple">Spiel beendet</p>
			</div>
		{/if}
	{/if}
</div>
