import 'dotenv/config';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output } from 'ai';
import * as z from 'zod';
import { questions } from '../src/lib/server/db/schema';

const BATCH_SIZE = 10;
const TARGET_COUNT = parseInt(process.argv[2] || '100', 10);

const sqlite = new Database('data/schmu.db');
sqlite.pragma('journal_mode = WAL');
const db = drizzle(sqlite);

const deepseek = createDeepSeek({
	apiKey: process.env.DEEPSEEK_API_KEY
});

function sampleExistingWords(count: number): string[] {
	return db
		.select({ word: questions.word })
		.from(questions)
		.orderBy(sql`RANDOM()`)
		.limit(count)
		.all()
		.map((q) => q.word);
}

async function generateBatch(desiredCount: number) {
	const sample = sampleExistingWords(50);
	const blacklist =
		sample.length > 0 ? `\n3. **Verbot**: Nutze keines dieser Wörter: ${sample.join(', ')}.` : '';

	const { output } = await generateText({
		model: deepseek('deepseek-chat'),
		temperature: 0.8,
		prompt: `
			Du bist ein Quiz-Content-Generator für ein Bluff-Spiel.

			AUFGABE:
			Erstelle exakt ${desiredCount} Spielrunden mit seltenen Fremdwörten.

			REGELN FÜR DIE LISTE
			1. **Abwechslung**: Wähle Wörter aus VÖLLIG unterschiedlichen Kategorien (nicht 5x Medizin hintereinander).
      		2. **Schwierigkeit**: Mischung aus "nie gehört" und "klingt lustig".${blacklist}
			3. **Echt**: Die Begriffe müssen existieren und stehen bestenfalls im Duden

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

	return output.rounds;
}

async function seed() {
	const startCount = await db.$count(questions);
	console.log(`Database has ${startCount} questions. Target: ${TARGET_COUNT}`);

	let toGenerate = TARGET_COUNT - startCount;
	if (toGenerate <= 0) {
		console.log('Already have enough questions.');
		return;
	}

	while (toGenerate > 0) {
		const batchSize = Math.min(BATCH_SIZE, toGenerate);
		console.log(`Generating batch of ${batchSize}... (${toGenerate} remaining)`);

		try {
			const batch = await generateBatch(batchSize);
			let inserted = 0;

			for (const q of batch) {
				try {
					db.insert(questions).values({ word: q.word, definition: q.definition }).run();
					inserted++;
				} catch {
					// duplicate word (UNIQUE constraint), skip
				}
			}

			toGenerate -= inserted;
			console.log(`  Inserted ${inserted} questions`);
		} catch (err) {
			console.error('Batch failed, retrying...', err);
		}
	}

	const total = await db.$count(questions);
	console.log(`Done! Database now has ${total} questions.`);
}

seed();
