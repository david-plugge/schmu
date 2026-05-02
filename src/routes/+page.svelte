<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { createGame, getUser, joinGame, login, logout } from './setup.remote';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';

	const user = $derived(await getUser());
</script>

<div class="grid min-h-screen place-items-center p-4">
	<div class="flex w-full max-w-sm flex-col items-center gap-8">
		<!-- Game Title -->
		<div class="text-center">
			<h1
				class="text-5xl font-black tracking-tight"
				style="background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
			>
				SCHMU
			</h1>
			<p class="mt-1 text-sm font-medium text-neon-yellow">Wer besser spinnt, gewinnt!</p>
		</div>

		{#if !user}
			<Card.Root class="w-full border-neon-purple/30 bg-card/80 shadow-lg shadow-neon-purple/10 backdrop-blur-sm">
				<Card.Header>
					<Card.Title class="text-center text-neon-cyan">Willkommen!</Card.Title>
				</Card.Header>
				<Card.Content>
					<form {...login}>
						<Field.Group>
							<Field.Field>
								<Field.Label class="text-muted-foreground">Benutzername</Field.Label>
								<Input
									autocomplete="username"
									class="border-neon-purple/30 bg-background/50 placeholder:text-muted-foreground/50 focus:border-neon-pink"
									{...login.fields.username.as('text')}
								/>
								<Field.Error errors={login.fields.username.issues()} />
							</Field.Field>

							<Button
								type="submit"
								class="w-full bg-neon-pink font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
							>
								Los geht's!
							</Button>
						</Field.Group>
					</form>
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root class="w-full border-neon-purple/30 bg-card/80 shadow-lg shadow-neon-purple/10 backdrop-blur-sm">
				<Card.Header>
					<Card.Title class="text-center">
						<span class="text-neon-green">{user.username}</span>
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col gap-5">
						<form {...createGame}>
							<Field.Group>
								<Button
									type="submit"
									class="w-full bg-neon-pink font-bold text-white shadow-md shadow-neon-pink/25 hover:bg-neon-pink/85"
								>
									Spiel erstellen
								</Button>
							</Field.Group>
						</form>

						<div class="flex items-center gap-3">
							<Separator class="flex-1 bg-neon-purple/20" />
							<span class="text-xs font-medium text-muted-foreground">oder</span>
							<Separator class="flex-1 bg-neon-purple/20" />
						</div>

						<form {...joinGame}>
							<Field.Group>
								<Input
									autocomplete="off"
									placeholder="CODE"
									class="border-neon-purple/30 bg-background/50 text-center text-lg font-mono tracking-widest uppercase placeholder:text-muted-foreground/50 focus:border-neon-cyan"
									{...joinGame.fields.code.as('text')}
								/>
								<Field.Error errors={joinGame.fields.code.issues()} />

								<Button
									type="submit"
									class="w-full bg-neon-cyan font-bold text-background shadow-md shadow-neon-cyan/25 hover:bg-neon-cyan/85"
								>
									Beitreten
								</Button>
							</Field.Group>
						</form>

						<Separator class="bg-neon-purple/20" />

						<form {...logout}>
							<Field.Group>
								<Button
									type="submit"
									variant="ghost"
									class="w-full text-muted-foreground hover:text-neon-yellow"
								>
									Abmelden
								</Button>
							</Field.Group>
						</form>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</div>
