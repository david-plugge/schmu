<script lang="ts">
	import { dev } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { error } from '@sveltejs/kit';
	import { getWords, getWordsCount } from './words.remote';

	if (!dev) error(404);

	type Page = Awaited<ReturnType<typeof getWords>>;

	const [initialPage, initialCount] = await Promise.all([
		getWords({ cursor: null, search: '' }),
		getWordsCount({ search: '' })
	]);

	let pages = $state<Page[]>([initialPage]);
	let total = $state(initialCount);
	let activeSearch = $state('');
	let search = $state('');
	let loading = $state(false);

	let requestId = 0;

	async function runSearch(s: string) {
		const id = ++requestId;
		loading = true;
		try {
			const [first, c] = await Promise.all([
				getWords({ cursor: null, search: s }),
				getWordsCount({ search: s })
			]);
			if (id !== requestId) return;
			pages = [first];
			activeSearch = s;
			total = c;
		} finally {
			if (id === requestId) loading = false;
		}
	}

	$effect(() => {
		const s = search.trim();
		if (s === activeSearch) return;
		const timer = setTimeout(() => void runSearch(s), 200);
		return () => clearTimeout(timer);
	});

	const items = $derived(pages.flatMap((p) => p.items));
	const nextCursor = $derived(pages.at(-1)?.nextCursor ?? null);

	async function loadMore() {
		if (!nextCursor || loading) return;
		const id = ++requestId;
		loading = true;
		try {
			const next = await getWords({ cursor: nextCursor, search: activeSearch });
			if (id !== requestId) return;
			pages = [...pages, next];
		} finally {
			if (id === requestId) loading = false;
		}
	}
</script>

<div class="mx-auto max-w-3xl p-4">
	<div class="mb-6 flex items-baseline justify-between gap-4">
		<h1 class="text-3xl font-black tracking-tight text-neon-cyan">Wörter</h1>
		<span class="text-sm font-medium text-muted-foreground">
			{items.length} / {total}
		</span>
	</div>

	<div class="mb-6">
		<Input
			bind:value={search}
			placeholder="Suchen..."
			class="border-neon-purple/30 bg-background/50 placeholder:text-muted-foreground/50 focus:border-neon-pink"
		/>
	</div>

	{#if items.length === 0}
		<p class="text-center text-muted-foreground">Keine Wörter gefunden.</p>
	{:else}
		<ul class="flex flex-col gap-2" class:opacity-60={loading}>
			{#each items as { id, word, definition, votes } (id)}
				<li
					class="flex items-start gap-4 rounded-lg border border-neon-purple/20 bg-card/60 p-4 backdrop-blur-sm"
				>
					<div class="min-w-0 flex-1">
						<div class="font-bold text-neon-pink">{word}</div>
						<div class="mt-1 text-sm text-foreground/80">{definition}</div>
					</div>
					<span
						class="shrink-0 rounded-full bg-neon-purple/20 px-2.5 py-0.5 font-mono text-xs text-neon-purple"
						class:text-neon-green={votes > 0}
						class:text-destructive={votes < 0}
					>
						{votes > 0 ? '+' : ''}{votes}
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if nextCursor}
		<div class="mt-6 flex justify-center">
			<Button
				type="button"
				variant="ghost"
				disabled={loading}
				onclick={loadMore}
				class="text-neon-cyan hover:text-neon-pink"
			>
				{loading ? 'Lädt...' : 'Mehr laden'}
			</Button>
		</div>
	{/if}
</div>
