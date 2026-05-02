<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { Player } from '$lib/types';
	import PlayerList from './PlayerList.svelte';
	import { startGame } from './game.remote';
	import { page } from '$app/state';

	type Props = {
		code: string;
		players: Player[];
		isHost: boolean;
	};
	let { code, players, isHost }: Props = $props();
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

	<PlayerList {players} />

	<div class="grid gap-2 md:grid-cols-2">
		<Button
			variant="outline"
			onclick={() => navigator.clipboard.writeText(`${page.url.origin}/games/${code}`)}
			class="truncate border-neon-purple/30 text-muted-foreground hover:border-neon-cyan hover:text-neon-cyan"
		>
			{`${page.url.origin}/games/${code}`}
		</Button>
		<Button
			variant="outline"
			onclick={() => navigator.clipboard.writeText(code)}
			class="border-neon-purple/30 font-mono text-lg tracking-widest text-neon-yellow hover:border-neon-yellow"
		>
			{code}
		</Button>
	</div>

	{#if isHost}
		<Button
			onclick={() => startGame(code)}
			class="bg-neon-pink text-lg font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
		>
			Spiel starten!
		</Button>
	{:else}
		<p class="animate-pulse text-center text-sm text-muted-foreground">Warte auf den Host...</p>
	{/if}
</div>
