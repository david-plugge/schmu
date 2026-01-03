import { generateText, Output } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { env } from '$env/dynamic/private';
import * as z from 'zod';

const deepseek = createDeepSeek({
	apiKey: env.DEEPSEEK_API_KEY
});

export async function generateQuestionBatch(desiredCount: number, excludeWords: string[]) {
	const blacklistString = excludeWords.slice(-50).join(', ');

	const { output } = await generateText({
		model: deepseek('deepseek-chat'),
		temperature: 0.8,
		prompt: `
			Du bist ein Quiz-Content-Generator für ein Bluff-Spiel.

			AUFGABE:
			Erstelle exakt ${desiredCount} Spielrunden mit seltenen Fremdwörten.

			REGELN FÜR DIE LISTE
			1. **Abwechslung**: Wähle Wörter aus VÖLLIG unterschiedlichen Kategorien (nicht 5x Medizin hintereinander).
      		2. **Schwierigkeit**: Mischung aus "nie gehört" und "klingt lustig".
      		3. **Verbot**: Nutze keines dieser Wörter: ${blacklistString}.
			4. **Echt**: Die Begriffe müssen existieren und stehen bestenfalls im Duden

			FORMAT:
			Definitionen müssen kurz, trocken, ohne Fachbegriffe und für jeden verständlich sein.
			Beispiele für den Stil:
			- "Ein veraltetes medizinisches Instrument zur Aderlassung."
			- "Der Fachbegriff für die Angst vor der Zahl 13."
			- "Ein Zierrat an mittelalterlichen Helmen."
			WICHTIG: Das Wort selbst darf in der Definition NICHT vorkommen!
        `,
		output: Output.object({
			schema: z.object({
				rounds: z.array(
					z.object({
						word: z.string().describe('Das unbekannte Fremdwort'),
						definition: z
							.string()
							.describe(
								'Eine sehr kurze, simple Erklärung (max. 50 zeichen). Ohne das Wort zu wiederholen.'
							)
					})
				)
			})
		})
	});

	console.log(output);

	return output.rounds;
}
