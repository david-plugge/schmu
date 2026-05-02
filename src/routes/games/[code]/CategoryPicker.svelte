<script lang="ts">
	import { CATEGORIES, CATEGORY_SLUGS, type CategorySlug } from '$lib/categories';
	import { cn } from '$lib/utils';
	import { setCategories } from './game.remote';

	type Props = {
		code: string;
		enabled: CategorySlug[];
		isHost: boolean;
	};
	let { code, enabled, isHost }: Props = $props();

	const enabledSet = $derived(new Set(enabled));

	async function toggle(slug: CategorySlug) {
		if (!isHost) return;
		const next = enabledSet.has(slug) ? enabled.filter((c) => c !== slug) : [...enabled, slug];
		if (next.length === 0) return;
		await setCategories({ code, categories: next });
	}
</script>

<div class="flex flex-col gap-2">
	<p class="text-sm font-bold text-muted-foreground">Kategorien</p>
	<div class="flex flex-wrap gap-2">
		{#each CATEGORY_SLUGS as slug (slug)}
			{@const active = enabledSet.has(slug)}
			<button
				type="button"
				onclick={() => toggle(slug)}
				disabled={!isHost}
				class={cn(
					'rounded-full border px-3 py-1 text-xs font-bold transition-all',
					active
						? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
						: 'border-border bg-transparent text-muted-foreground line-through',
					isHost ? 'cursor-pointer hover:border-neon-cyan/60' : 'cursor-default opacity-80'
				)}
			>
				{CATEGORIES[slug]}
			</button>
		{/each}
	</div>
	{#if !isHost}
		<p class="text-xs text-muted-foreground">Der Host wählt die Kategorien.</p>
	{/if}
</div>
