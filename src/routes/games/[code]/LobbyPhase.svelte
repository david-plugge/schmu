<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { ViewerGameState } from '$lib/phase-machine';
	import PlayerList from './PlayerList.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import { startGame } from './game.remote';
	import { page } from '$app/state';

	type Props = {
		state: Extract<ViewerGameState, { phase: 'lobby' }>;
	};
	let { state }: Props = $props();
</script>

<div class="flex flex-col gap-6">
	<div class="text-center">
		<h2
			class="text-3xl font-black tracking-tight"
			style="background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
		>
			SCHMU
		</h2>
		<p class="mt-1 text-sm text-muted-foreground">Warteraum</p>
	</div>

	<PlayerList players={state.players} you={state.you} />

	<CategoryPicker code={state.code} enabled={state.enabledCategories} isHost={state.you.isHost} />

	<div class="grid gap-2 md:grid-cols-2">
		<Button
			variant="outline"
			onclick={() => navigator.clipboard.writeText(`${page.url.origin}/games/${state.code}`)}
			class="truncate border-neon-purple/30 text-muted-foreground hover:border-neon-cyan hover:text-neon-cyan"
		>
			{`${page.url.origin}/games/${state.code}`}
		</Button>
		<Button
			variant="outline"
			onclick={() => navigator.clipboard.writeText(state.code)}
			class="border-neon-purple/30 font-mono text-lg tracking-widest text-neon-yellow hover:border-neon-yellow"
		>
			{state.code}
		</Button>
	</div>

	{#if state.you.isHost}
		<Button
			onclick={() => startGame({ code: state.code })}
			class="bg-neon-pink text-lg font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
		>
			Spiel starten!
		</Button>
	{:else}
		<p class="animate-pulse text-center text-sm text-muted-foreground">Warte auf den Host...</p>
	{/if}
</div>
