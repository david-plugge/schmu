import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output } from 'ai';
import * as z from 'zod';
import { DEEPSEEK_API_KEY } from '$env/static/private';

const deepseek = createDeepSeek({ apiKey: DEEPSEEK_API_KEY });

export async function generateDefinitions(words: string[]) {
	const { output } = await generateText({
		model: deepseek('deepseek-chat'),
		temperature: 0.3,
		prompt: `
			Du bist ein Quiz-Content-Generator für ein Bluff-Spiel, bei dem Spieler die Bedeutung
			seltener Wörter erraten müssen.

			AUFGABE:
			Aus der folgenden Liste, wähle ALLE Wörter aus, die wirklich unbekannt sind, und
			schreibe jeweils eine kurze, korrekte Definition. Qualität vor Quantität: wenn nur
			wenige (oder gar keine) Wörter den Kriterien entsprechen, gib auch nur diese (oder
			ein leeres Array) zurück. NIEMALS schwächere Wörter aufnehmen, nur um auf eine
			bestimmte Anzahl zu kommen.

			WORTLISTE:
			${words.join(', ')}

			STRENGE AUSWAHLREGELN:
			1. NUR Wörter nehmen, die ein durchschnittlicher Deutscher NICHT kennt.
			2. KEINE zusammengesetzten Alltagswörter (z.B. "Kieferntisch", "Düsenjäger", "Bananenschale").
			3. KEINE bekannten Organisationen, Städte oder Alltagsbegriffe.
			4. KEINE Eigennamen oder Ortsnamen.
			5. Bevorzuge: Fremdwörter, Fachbegriffe, veraltete Wörter, kuriose Begriffe.
			6. Im Zweifel: Lieber weglassen als ein zu bekanntes Wort nehmen.

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
						word: z.string().describe('Das ausgewählte Fremdwort aus der Liste'),
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

	return output.rounds;
}
