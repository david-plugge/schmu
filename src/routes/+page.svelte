<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { createGame, getUser, joinGame, login, logout } from './setup.remote';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';

	const user = $derived(await getUser());
</script>

<div class="grid h-screen place-items-center p-2">
	{#if !user}
		<Card.Root class="-my-4 w-full max-w-sm">
			<Card.Content>
				<form {...login}>
					<Field.Group>
						<Field.Field>
							<Field.Label>Benutzername</Field.Label>
							<Input autocomplete="username" {...login.fields.username.as('text')} />
							<Field.Error errors={login.fields.username.issues()} />
						</Field.Field>

						<Button type="submit">Speichern</Button>
					</Field.Group>
				</form>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root class="-my-4 w-full max-w-sm">
			<Card.Content>
				<div class="flex flex-col gap-4">
					<form {...createGame}>
						<Field.Group>
							<Button type="submit">Spiel erstellen</Button>
						</Field.Group>
					</form>

					<Separator />

					<form {...joinGame}>
						<Field.Group>
							<Input autocomplete="off" placeholder="CODE" {...joinGame.fields.code.as('text')} />
							<Field.Error errors={joinGame.fields.code.issues()} />

							<Button type="submit">Beitreten</Button>
						</Field.Group>
					</form>

					<Separator />

					<form {...logout}>
						<div class="mb-2 text-center text-lg font-semibold">{user.username}</div>

						<Field.Group>
							<Button type="submit" variant="secondary">Abmelden</Button>
						</Field.Group>
					</form>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
