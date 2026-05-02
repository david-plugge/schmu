import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output } from 'ai';
import * as z from 'zod';
import { DEEPSEEK_API_KEY } from '$env/static/private';
import { CATEGORIES, CATEGORY_SLUGS } from '$lib/categories';
import { DIFFICULTIES, DIFFICULTY_SLUGS } from '$lib/difficulties';
import dedent from 'dedent';

const deepseek = createDeepSeek({ apiKey: DEEPSEEK_API_KEY });

const categoryList = CATEGORY_SLUGS.map((slug) => `- ${slug}: ${CATEGORIES[slug]}`).join('\n');
const difficultyList = DIFFICULTY_SLUGS.map((slug) => `- ${slug}: ${DIFFICULTIES[slug]}`).join(
	'\n'
);

const systemPrompt = dedent`
	Du bist ein Quiz-Content-Generator für ein Bluff-Spiel, bei dem Spieler die Bedeutung
	seltener Wörter erraten müssen.

	AUFGABE:
	Aus der gegebenen Wortliste, wähle ALLE Wörter aus, die wirklich unbekannt sind, und
	schreibe jeweils eine kurze, korrekte Definition sowie eine passende Kategorie.
	Qualität vor Quantität: wenn nur wenige (oder gar keine) Wörter den Kriterien
	entsprechen, gib auch nur diese (oder ein leeres Array) zurück. NIEMALS schwächere
	Wörter aufnehmen, nur um auf eine bestimmte Anzahl zu kommen.

	STRENGE AUSWAHLREGELN:
	1. NUR Wörter nehmen, die ein durchschnittlicher Deutscher NICHT kennt.
	2. TRANSPARENZ-TEST: Frage dich bei JEDEM Wort: "Kann ein Deutscher die Bedeutung
	   aus den Wortbestandteilen oder dem Kontext erschließen?" Wenn ja → ABLEHNEN.
	   Das gilt insbesondere für transparente Komposita (Wort1 + Wort2 = klare Bedeutung).
	3. KEINE zusammengesetzten Wörter aus geläufigen Bestandteilen (z.B. "Hauptsprache",
	   "Ehbett", "Kieferntisch", "Düsenjäger", "Bananenschale", "Familienhund").
	4. KEINE Eigennamen, Ortsnamen, Stadtteile, Personennamen, Markennamen
	   (z.B. "Grafenberg" = Düsseldorfer Stadtteil → ablehnen, auch wenn obskur klingend).
	5. KEINE bekannten Organisationen, Städte oder Alltagsbegriffe.
	6. Bevorzuge: Fremdwörter mit nicht-deutschem Stamm, archaische Fachbegriffe,
	   völlig opake Wörter, kuriose Begriffe deren Bedeutung NICHT aus Bestandteilen
	   ableitbar ist.
	7. Im Zweifel: IMMER weglassen. Lieber leeres Array als ein zu transparentes Wort.

	BEISPIELE FÜR ABLEHNUNGEN (zur Kalibrierung):
	- "Hauptsprache" → ABLEHNEN: transparentes Kompositum, Bedeutung offensichtlich
	- "Ehbett" → ABLEHNEN: transparentes Kompositum (Ehe + Bett)
	- "Grafenberg" → ABLEHNEN: Ortsname (Stadtteil)
	- "Familienhund" → ABLEHNEN: zusammengesetztes Alltagswort
	- "Hochzeitstag" → ABLEHNEN: transparentes Kompositum
	BEISPIELE FÜR ANNAHMEN:
	- "Triskaidekaphobie" → ANNEHMEN: opakes Fremdwort
	- "Karfunkel" → ANNEHMEN: archaischer Begriff, Bedeutung nicht ableitbar
	- "Flageolett" → ANNEHMEN: Fachbegriff, Bedeutung nicht ableitbar

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

	SCHWIERIGKEIT:
	Schätze, wie schwer das Wort für Spieler zu erraten ist (nutze den Slug):
	${difficultyList}
	- leicht: Bedeutung lässt sich aus Wortbestandteilen oder Kontext halbwegs ableiten;
	  jemand mit guter Allgemeinbildung könnte einen plausiblen Tipp abgeben.
	- mittel: völlig unbekannt, aber die Definition fühlt sich nach dem Auflösen logisch
	  oder nachvollziehbar an.
	- schwer: hochgradig obskur, archaisch oder völlig willkürlich klingend; selbst nach
	  der Auflösung überraschend.
	Im Zweifel: "mittel".
`;

export async function generateDefinitions(words: string[]) {
	const { output } = await generateText({
		model: deepseek('deepseek-chat'),
		temperature: 0.3,
		system: systemPrompt,
		prompt: `WORTLISTE:\n${words.join(', ')}`,
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
						category: z.enum(CATEGORY_SLUGS).describe('Slug der am besten passenden Kategorie'),
						difficulty: z.enum(DIFFICULTY_SLUGS).describe('Slug der geschätzten Rate-Schwierigkeit')
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
