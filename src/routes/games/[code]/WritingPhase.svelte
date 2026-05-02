<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { Player } from '$lib/types';
	import { submitAnswer } from './game.remote';

	type Props = {
		code: string;
		currentWord: string;
		currentPlayer: Player;
		players: Player[];
	};
	let { code, currentWord, currentPlayer, players }: Props = $props();
</script>

{#if currentPlayer.hasSubmitted}
	<div class="flex min-h-[40vh] flex-col items-center justify-center gap-4">
		<div class="text-4xl">&#9996;</div>
		<p class="text-lg text-neon-green">Antwort abgegeben!</p>
		<p class="text-sm text-muted-foreground">
			Warte auf die anderen ({players.filter((p) => p.hasSubmitted).length}/{players.length})
		</p>
	</div>
{:else}
	<div class="flex flex-col gap-6">
		<div
			class="rounded-xl border border-neon-purple/30 bg-card/80 p-6 text-center backdrop-blur-sm"
		>
			<p class="mb-2 text-sm text-muted-foreground">Was ist eigentlich...</p>
			<p class="text-3xl font-black text-neon-yellow">{currentWord}</p>
		</div>

		<form {...submitAnswer} class="flex flex-col gap-3">
			<input {...submitAnswer.fields.code.as('hidden', code)} />
			<Input
				{...submitAnswer.fields.answer.as('text')}
				placeholder="Deine kreative Antwort..."
				class="border-neon-purple/30 bg-background/50 text-lg placeholder:text-muted-foreground/50 focus:border-neon-pink"
			/>
			<Button
				type="submit"
				class="bg-neon-pink font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
			>
				Abschicken
			</Button>
		</form>
	</div>
{/if}
