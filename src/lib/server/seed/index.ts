import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import { generateDefinitions } from './definitions';
import { delay, fetchRandomGermanWords, RATE_LIMIT_BACKOFF } from './wiktionary';

const WIKTIONARY_FETCH_SIZE = 50;
const TARGET_COUNT = parseInt(process.argv[2] || '100', 10);

function getExistingWords(): string[] {
	return db
		.select({ word: questions.word })
		.from(questions)
		.all()
		.map((q) => q.word);
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
			const batch = await generateDefinitions(newWords);
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
