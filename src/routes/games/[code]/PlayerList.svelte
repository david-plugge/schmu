<script lang="ts">
	import { getLoggedInUser } from '../../setup.remote';

	type Player = {
		id: string;
		name: string;
		score: number;
		isHost: boolean;
		hasSubmitted: boolean;
	};

	type Props = {
		players: Player[];
	};
	let { players }: Props = $props();

	const user = $derived(await getLoggedInUser());
</script>

<div
	class="flex flex-col gap-2 rounded-xl border border-neon-purple/30 bg-card/80 p-3 backdrop-blur-sm"
>
	{#each players as player, i (player.id)}
		{@const colors = [
			'bg-neon-pink/15 text-neon-pink border-neon-pink/30',
			'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30',
			'bg-neon-green/15 text-neon-green border-neon-green/30',
			'bg-neon-yellow/15 text-neon-yellow border-neon-yellow/30',
			'bg-neon-purple/15 text-neon-purple border-neon-purple/30'
		]}
		<div class="flex items-center gap-3 rounded-lg border px-3 py-2 {colors[i % colors.length]}">
			<span class="text-lg font-bold">{player.name}</span>
			{#if player.id === user.id}
				<span class="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">ich</span>
			{/if}
			{#if player.isHost}
				<span class="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">Host</span>
			{/if}
			{#if player.score > 0}
				<span class="ml-auto font-mono text-sm font-bold">{player.score}</span>
			{/if}
		</div>
	{/each}
</div>
