import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output } from 'ai';
import * as z from 'zod';
import { questions } from '../src/lib/server/db/schema';

const BATCH_SIZE = 10;
const WIKTIONARY_FETCH_SIZE = 50;
const TARGET_COUNT = parseInt(process.argv[2] || '100', 10);

const BASE_URL = 'https://de.wiktionary.org/w/api.php';
const HEADERS = {
	'User-Agent': 'SchmuGame/1.0 (party game; fetching random German words)',
	Accept: 'application/json'
};

const sqlite = new Database('data/schmu.db');
sqlite.pragma('journal_mode = WAL');
const db = drizzle(sqlite);

const deepseek = createDeepSeek({
	apiKey: process.env.DEEPSEEK_API_KEY
});

function getExistingWords(): string[] {
	return db
		.select({ word: questions.word })
		.from(questions)
		.all()
		.map((q) => q.word);
}

const WORD_RE = /^[A-ZÄÖÜ][a-zäöüß]+$/;
const MIN_LENGTH = 4;
const OBSCURE_CATEGORIES = [
	'Kategorie:Fremdwort',
	'Kategorie:veralteter Wortschatz (Deutsch)'
];
const INFLECTED_CATEGORIES = ['Deklinierte Form (Deutsch)', 'Konjugierte Form (Deutsch)'];

const RATE_LIMIT_BACKOFF = 5000;

function delay(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

function shuffle<T>(arr: T[]): void {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

async function wiktionaryFetch(params: URLSearchParams): Promise<any | null> {
	const res = await fetch(`${BASE_URL}?${params}`, { headers: HEADERS });

	if (res.status === 429) {
		const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
		const backoff = retryAfter * 1000 || RATE_LIMIT_BACKOFF;
		console.log(`  Rate limited, waiting ${backoff / 1000}s...`);
		await delay(backoff);
		const retry = await fetch(`${BASE_URL}?${params}`, { headers: HEADERS });
		if (!retry.ok) return null;
		return retry.json();
	}

	if (!res.ok) return null;

	// Wiktionary sometimes returns HTML error text instead of JSON
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		console.log(`  Rate limited (non-JSON response), waiting ${RATE_LIMIT_BACKOFF / 1000}s...`);
		await delay(RATE_LIMIT_BACKOFF);
		return null;
	}
}

async function fetchRandomGermanWords(count: number): Promise<string[]> {
	const [randomWords, obscureWords] = await Promise.all([
		fetchRandomBaseWords(Math.ceil(count * 0.6)),
		fetchFromObscureCategories(Math.ceil(count * 0.6))
	]);
	const all = [...new Set([...obscureWords, ...randomWords])];
	return all.slice(0, count);
}

async function fetchRandomBaseWords(count: number): Promise<string[]> {
	const words: string[] = [];
	const maxAttempts = 5;

	for (let attempt = 0; attempt < maxAttempts && words.length < count; attempt++) {
		if (attempt > 0) await delay(1000);

		const data = await wiktionaryFetch(
			new URLSearchParams({
				action: 'query',
				list: 'random',
				rnnamespace: '0',
				rnlimit: '50',
				rnfilterredir: 'nonredirects',
				format: 'json'
			})
		);
		if (!data) continue;

		const candidates = (data.query.random as { title: string }[])
			.map((p) => p.title)
			.filter((t) => WORD_RE.test(t) && t.length >= MIN_LENGTH);

		await delay(1000);
		const baseWords = await filterBaseFormWords(candidates);
		words.push(...baseWords);
	}

	return [...new Set(words)].slice(0, count);
}

async function fetchFromObscureCategories(count: number): Promise<string[]> {
	const words: string[] = [];
	const perCategory = Math.ceil(count / OBSCURE_CATEGORIES.length);
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

	for (const category of OBSCURE_CATEGORIES) {
		if (words.length >= count) break;

		try {
			const startLetter = letters[Math.floor(Math.random() * letters.length)];
			await delay(1000);

			const data = await wiktionaryFetch(
				new URLSearchParams({
					action: 'query',
					list: 'categorymembers',
					cmtitle: category,
					cmnamespace: '0',
					cmlimit: String(perCategory * 3),
					cmstartsortkeyprefix: startLetter,
					format: 'json'
				})
			);
			if (!data) continue;

			const members = (data.query.categorymembers as { title: string }[])
				.map((m) => m.title)
				.filter((t) => WORD_RE.test(t) && t.length >= MIN_LENGTH);

			shuffle(members);
			words.push(...members.slice(0, perCategory));
		} catch {
			// skip failed category
		}
	}

	return words;
}

async function filterBaseFormWords(titles: string[]): Promise<string[]> {
	if (titles.length === 0) return [];

	const data = await wiktionaryFetch(
		new URLSearchParams({
			action: 'query',
			titles: titles.join('|'),
			prop: 'categories',
			cllimit: 'max',
			format: 'json'
		})
	);
	if (!data) return [];

	const result: string[] = [];
	for (const page of Object.values(data.query.pages) as any[]) {
		const cats: string[] = (page.categories || []).map((c: any) => c.title);
		const isGerman = cats.some((c) => c.includes('(Deutsch)'));
		const isInflected = cats.some((c) => INFLECTED_CATEGORIES.some((inf) => c.includes(inf)));
		if (isGerman && !isInflected) result.push(page.title);
	}

	return result;
}

async function generateDefinitions(words: string[], desiredCount: number) {
	const { output } = await generateText({
		model: deepseek('deepseek-chat'),
		temperature: 0.8,
		prompt: `
			Du bist ein Quiz-Content-Generator für ein Bluff-Spiel, bei dem Spieler die Bedeutung
			seltener Wörter erraten müssen.

			AUFGABE:
			Aus der folgenden Liste, wähle die ${desiredCount} UNBEKANNTESTEN Wörter und schreibe
			jeweils eine kurze, korrekte Definition.

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

async function seed() {
	const startCount = await db.$count(questions);
	console.log(`Database has ${startCount} questions. Target: ${TARGET_COUNT}`);

	let toGenerate = TARGET_COUNT - startCount;
	if (toGenerate <= 0) {
		console.log('Already have enough questions.');
		return;
	}

	const existingWords = getExistingWords();

	while (toGenerate > 0) {
		const batchSize = Math.min(BATCH_SIZE, toGenerate);
		console.log(`\nFetching words from Wiktionary... (${toGenerate} remaining)`);

		try {
			const words = await fetchRandomGermanWords(WIKTIONARY_FETCH_SIZE);
			const newWords = words.filter((w) => !existingWords.includes(w));

			if (newWords.length === 0) {
				console.log('  No new words found, waiting before retry...');
				await delay(RATE_LIMIT_BACKOFF);
				continue;
			}

			console.log(`  Got ${newWords.length} new words, generating definitions...`);
			const batch = await generateDefinitions(newWords, batchSize);
			let inserted = 0;

			for (const q of batch) {
				try {
					db.insert(questions).values({ word: q.word, definition: q.definition }).run();
					existingWords.push(q.word);
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
	console.log(`\nDone! Database now has ${total} questions.`);
}

seed();
