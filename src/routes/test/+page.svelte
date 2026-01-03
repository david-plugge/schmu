<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { createQuestion } from './question.remote';

	let quests = $state<
		{
			word: string;
			definition: string;
		}[]
	>();
</script>

<Button
	onclick={async () => {
		quests = await createQuestion();
	}}
>
	New question
</Button>

<!-- <pre>{JSON.stringify(quests, null, 2)}</pre> -->

<div class="container mx-auto flex flex-col gap-4">
	{#each quests as item, index (item.word)}
		<div class="flex flex-col gap-1 px-4 py-2">
			<div class="font-semibold">({index}) {item.word}</div>
			<div>{item.definition}</div>
		</div>
	{/each}
</div>
