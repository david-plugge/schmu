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

<div class="flex flex-col gap-1 rounded-lg border p-2">
	{#each players as player (player.id)}
		<div class="rounded-md bg-accent px-2 py-1">
			{player.name}
			{#if player.id === user.id}
				(ich)
			{/if}
		</div>
	{/each}
</div>
