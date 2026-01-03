<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getLoggedInUser } from '../../setup.remote.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { startGame, startNextRound, submitAnswer, submitVote } from './game.remote.js';
	import PlayerList from './PlayerList.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { GameState } from '$lib/types.js';
	import { cn } from '$lib/utils.js';
	import { page } from '$app/state';

	let { params } = $props();

	const user = $derived(await getLoggedInUser());

	let gameState: GameState | null = $state(null);
	const currentPlayer = $derived.by(() =>
		gameState?.players.find((player) => player.id === user.id)
	);

	onMount(connect);

	function connect() {
		const sse = new EventSource(resolve('/api/events/[code]', { code: params.code }), {
			withCredentials: true
		});

		sse.addEventListener('message', (e) => {
			console.log('message', e.data);
			const data = JSON.parse(e.data);

			gameState = data;
		});
		sse.addEventListener('error', () => {
			console.log('error');

			setTimeout(connect, 1000);
		});
		sse.addEventListener('open', () => {
			console.log('open');
		});
	}

	let myVoteId = $state<string>();
	function vote(answerId: string) {
		if (currentPlayer?.hasVoted) return;

		myVoteId = answerId;
		submitVote({
			answerId,
			code: params.code
		});
	}
</script>

<div class="p-2">
	{#if !gameState}
		<p>Beitritt läuft...</p>
	{:else}
		{#if gameState.phase === 'lobby'}
			<div class="flex flex-col gap-4">
				<PlayerList players={gameState.players} />

				<div class="grid gap-2 md:grid-cols-2">
					<Button
						variant="outline"
						onclick={() => navigator.clipboard.writeText(`${page.url.origin}/games/${params.code}`)}
						class="truncate"
					>
						{`${page.url.origin}/games/${params.code}`}
					</Button>
					<Button variant="outline" onclick={() => navigator.clipboard.writeText(params.code)}>
						{params.code}
					</Button>
				</div>

				{#if currentPlayer?.isHost}
					<Button onclick={() => startGame(gameState!.code)}>Start</Button>
				{/if}
			</div>
		{:else if gameState.phase === 'loading-question'}
			<p>Spiel wird vorbereitet...</p>
		{:else if gameState.phase === 'writing'}
			{#if currentPlayer?.hasSubmitted}
				<p>
					Warte auf die anderen ({gameState.players.filter((p) => p.hasSubmitted).length}/{gameState
						.players.length})
				</p>
			{:else}
				<div class="mb-4">
					Was ist eigentlich der/die/das <span class="font-medium">{gameState.currentWord}</span>?
				</div>

				<form {...submitAnswer}>
					<input {...submitAnswer.fields.code.as('hidden', params.code)} />
					<Input {...submitAnswer.fields.answer.as('text')} />
				</form>
			{/if}
		{:else if gameState.phase === 'voting'}
			<div class="p-6 text-xl font-semibold">{gameState.currentWord}</div>

			<div class="flex flex-col gap-6 p-6">
				{#each gameState.possibleAnswers as answer (answer.id)}
					<button
						type="submit"
						class={cn(
							'rounded-lg border p-6 text-lg',
							myVoteId === answer.id && 'border-green-600'
						)}
						disabled={currentPlayer?.hasVoted}
						onclick={() => {
							if (currentPlayer?.hasVoted) return;
							vote(answer.id);
						}}
					>
						{answer.text}
					</button>
				{/each}
			</div>
		{:else if gameState.phase === 'scoring'}
			<pre>{JSON.stringify(gameState.roundResults, null, 2)}</pre>

			{#if currentPlayer?.isHost}
				<Button onclick={() => startNextRound({ code: params.code })}>Nächste runde!</Button>
			{/if}
		{/if}

		<!-- <pre>{JSON.stringify(gameState, null, 2)}</pre> -->
	{/if}
</div>
