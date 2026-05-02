import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output } from 'ai';
import * as z from 'zod';
import { DEEPSEEK_API_KEY } from '$env/static/private';
import { CATEGORIES, CATEGORY_SLUGS } from '$lib/categories';
import dedent from 'dedent';

const deepseek = createDeepSeek({ apiKey: DEEPSEEK_API_KEY });

const categoryList = CATEGORY_SLUGS.map((slug) => `- ${slug}: ${CATEGORIES[slug]}`).join('\n');

export async function generateDefinitions(words: string[]) {
	const { output } = await generateText({
		model: deepseek('deepseek-chat'),
		temperature: 0.3,
		prompt: dedent.withOptions({ alignValues: true })`
			Du bist ein Quiz-Content-Generator für ein Bluff-Spiel, bei dem Spieler die Bedeutung
			seltener Wörter erraten müssen.

			AUFGABE:
			Aus der folgenden Liste, wähle ALLE Wörter aus, die wirklich unbekannt sind, und
			schreibe jeweils eine kurze, korrekte Definition sowie eine passende Kategorie.
			Qualität vor Quantität: wenn nur wenige (oder gar keine) Wörter den Kriterien
			entsprechen, gib auch nur diese (oder ein leeres Array) zurück. NIEMALS schwächere
			Wörter aufnehmen, nur um auf eine bestimmte Anzahl zu kommen.

			WORTLISTE:
			${words.join(', ')}

			STRENGE AUSWAHLREGELN:
			1. NUR Wörter nehmen, die ein durchschnittlicher Deutscher NICHT kennt.
			2. KEINE zusammengesetzten Alltagswörter (z.B. "Kieferntisch", "Düsenjäger", "Bananenschale").
			3. KEINE bekannten Organisationen, Städte oder Alltagsbegriffe.
			4. KEINE Eigennamen oder Ortsnamen.
			5. Bevorzuge: Fremdwörter, Fachbegriffe, veraltete Wörter, kuriose Begriffe.
			6. Im Zweifel: Lieber weglassen als ein zu bekanntes Wort nehmen.

			DEFINITIONS-FORMAT:
			Definitionen müssen kurz, trocken, ohne Fachbegriffe und für jeden verständlich sein.
			KEIN Punkt am Ende der Definition.
			Beispiele für den Stil:
			- "Ein veraltetes medizinisches Instrument zur Aderlassung"
			- "Der Fachbegriff für die Angst vor der Zahl 13"
			- "Ein Zierrat an mittelalterlichen Helmen"
			WICHTIG: Das Wort selbst darf in der Definition NICHT vorkommen!

			KATEGORIEN:
			Ordne jedem Wort GENAU EINE der folgenden Kategorien zu (nutze den Slug, nicht das Label):
			${categoryList}
			Wenn keine Kategorie wirklich passt, nutze "sonstiges". Bevorzuge eine spezifische
			Kategorie, wenn sie eindeutig zutrifft (z.B. ein anatomischer Fachbegriff -> "medizin").
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
							),
						category: z.enum(CATEGORY_SLUGS).describe('Slug der am besten passenden Kategorie')
					})
				)
			})
		})
	});

	return output.rounds.map((r) => ({
		...r,
		definition: r.definition.trim().replace(/\.+$/, '')
	}));
}
