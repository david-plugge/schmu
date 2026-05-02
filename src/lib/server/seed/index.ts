import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import { generateDefinitions } from './definitions';
import { LLM_BATCH_SIZE, getSeenWords, insertRejections, insertResults } from './helpers';
import { WordBuffer } from './word-buffer';

const TARGET_COUNT = parseInt(process.argv[2] || '100', 10);

async function seed() {
	const startCount = await db.$count(questions);
	console.log(`Database has ${startCount} questions. Target: ${TARGET_COUNT}`);

	let toGenerate = TARGET_COUNT - startCount;
	if (toGenerate <= 0) {
		console.log('Already have enough questions.');
		return;
	}

	const buffer = new WordBuffer(getSeenWords());
	buffer.start();

	try {
		while (toGenerate > 0) {
			const batch = await buffer.take(LLM_BATCH_SIZE);
			if (batch.length === 0) break;

			console.log(
				`\nGenerating definitions for ${batch.length} words... (${toGenerate} remaining)`
			);
			try {
				const results = await generateDefinitions(batch);
				const acceptedSet = new Set(results.map((r) => r.word));
				const rejected = batch.filter((w) => !acceptedSet.has(w));
				console.log(`  LLM accepted ${results.length}/${batch.length}`);
				const inserted = insertResults(results);
				insertRejections(rejected);
				toGenerate -= inserted;
				console.log(`  Inserted ${inserted}, rejected ${rejected.length}`);
			} catch (err) {
				console.error('  LLM batch failed, retrying...', err);
			}
		}
	} finally {
		buffer.stop();
	}

	const total = await db.$count(questions);
	console.log(`\nDone! Database now has ${total} questions.`);
}

seed();
