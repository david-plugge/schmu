<script lang="ts">
	import { dev } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { CATEGORIES, type CategorySlug } from '$lib/categories';
	import { DIFFICULTIES, type DifficultySlug } from '$lib/difficulties';
	import { ThumbsDown, ThumbsUp } from '@lucide/svelte';
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
				getWords({ cursor: null, search: s }).run(),
				getWordsCount({ search: s }).run()
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
			const next = await getWords({ cursor: nextCursor, search: activeSearch }).run();
			if (id !== requestId) return;
			pages = [...pages, next];
		} finally {
			if (id === requestId) loading = false;
		}
	}

	const DIFFICULTY_CLASS: Record<DifficultySlug, string> = {
		leicht: 'bg-neon-green/15 text-neon-green',
		mittel: 'bg-neon-yellow/15 text-neon-yellow',
		schwer: 'bg-neon-pink/15 text-neon-pink'
	};

	const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });

	function formatRelative(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		const diffSec = (d.getTime() - Date.now()) / 1000;
		const abs = Math.abs(diffSec);
		if (abs < 60) return RELATIVE_FORMATTER.format(Math.round(diffSec), 'second');
		if (abs < 3600) return RELATIVE_FORMATTER.format(Math.round(diffSec / 60), 'minute');
		if (abs < 86400) return RELATIVE_FORMATTER.format(Math.round(diffSec / 3600), 'hour');
		if (abs < 2592000) return RELATIVE_FORMATTER.format(Math.round(diffSec / 86400), 'day');
		if (abs < 31536000) return RELATIVE_FORMATTER.format(Math.round(diffSec / 2592000), 'month');
		return RELATIVE_FORMATTER.format(Math.round(diffSec / 31536000), 'year');
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
			{#each items as { id, word, definition, category, difficulty, votes, timesPlayed, createdAt } (id)}
				<li
					class="flex items-start gap-4 rounded-lg border border-neon-purple/20 bg-card/60 p-4 backdrop-blur-sm"
				>
					<div class="min-w-0 flex-1">
						<div class="font-bold text-neon-pink">{word}</div>
						<div class="mt-1 text-sm text-foreground/80">{definition}</div>
						<div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
							<span class="rounded-full bg-neon-cyan/15 px-2 py-0.5 font-medium text-neon-cyan">
								{CATEGORIES[category as CategorySlug]}
							</span>
							<span
								class={`rounded-full px-2 py-0.5 font-medium ${DIFFICULTY_CLASS[difficulty as DifficultySlug]}`}
							>
								{DIFFICULTIES[difficulty as DifficultySlug]}
							</span>
							<span class="text-muted-foreground" title="Gespielt">
								{timesPlayed}× gespielt
							</span>
							<span class="text-muted-foreground" title={new Date(createdAt).toLocaleString('de')}>
								· {formatRelative(createdAt)}
							</span>
						</div>
					</div>
					<span
						class="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2.5 py-0.5 text-xs font-medium"
						class:text-neon-green={votes > 0}
						class:text-destructive={votes < 0}
						class:text-muted-foreground={votes === 0}
						title={votes === 0
							? 'Noch keine Bewertungen'
							: `Netto-Bewertung: ${votes > 0 ? '+' : ''}${votes}`}
					>
						{#if votes < 0}
							<ThumbsDown class="size-3.5" />
						{:else}
							<ThumbsUp class="size-3.5" />
						{/if}
						{Math.abs(votes)}
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
