import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import { generateDefinitions } from './definitions';
import { LLM_BATCH_SIZE, getExistingWords, insertResults } from './helpers';
import { delay, fetchRandomGermanWords, RATE_LIMIT_BACKOFF } from './wiktionary';

const WIKTIONARY_FETCH_SIZE = 50;
const TARGET_COUNT = parseInt(process.argv[2] || '100', 10);

async function* wordSource(seedSeen: Iterable<string>): AsyncGenerator<string> {
	const seen = new Set(seedSeen);
	while (true) {
		try {
			const words = await fetchRandomGermanWords(WIKTIONARY_FETCH_SIZE);
			const fresh = words.filter((w) => !seen.has(w));
			if (fresh.length === 0) {
				console.log('  No new words from Wiktionary, backing off...');
				await delay(RATE_LIMIT_BACKOFF);
				continue;
			}
			for (const w of fresh) {
				seen.add(w);
				yield w;
			}
		} catch (err) {
			console.error('  Wiktionary fetch failed, retrying...', err);
			await delay(RATE_LIMIT_BACKOFF);
		}
	}
}

async function take<T>(n: number, source: AsyncGenerator<T>): Promise<T[]> {
	const out: T[] = [];
	for (let i = 0; i < n; i++) {
		const { value, done } = await source.next();
		if (done) break;
		out.push(value);
	}
	return out;
}

async function seed() {
	const startCount = await db.$count(questions);
	console.log(`Database has ${startCount} questions. Target: ${TARGET_COUNT}`);

	let toGenerate = TARGET_COUNT - startCount;
	if (toGenerate <= 0) {
		console.log('Already have enough questions.');
		return;
	}

	const source = wordSource(getExistingWords());

	while (toGenerate > 0) {
		const batch = await take(LLM_BATCH_SIZE, source);
		if (batch.length === 0) break;

		console.log(`\nGenerating definitions for ${batch.length} words... (${toGenerate} remaining)`);
		try {
			const results = await generateDefinitions(batch);
			console.log(`  LLM accepted ${results.length}/${batch.length}`);
			const inserted = insertResults(results);
			toGenerate -= inserted;
			console.log(`  Inserted ${inserted}`);
		} catch (err) {
			console.error('  LLM batch failed, retrying...', err);
		}
	}

	const total = await db.$count(questions);
	console.log(`\nDone! Database now has ${total} questions.`);
}

seed();
