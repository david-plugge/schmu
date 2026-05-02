import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import { generateDefinitions } from './definitions';

const BATCH_SIZE = 20;

async function reseed() {
	const existing = db.select({ word: questions.word }).from(questions).all();
	const words = existing.map((r) => r.word);
	console.log(`Loaded ${words.length} words from DB`);
	if (words.length === 0) {
		console.log('Nothing to do.');
		return;
	}

	console.log('Truncating questions table...');
	db.delete(questions).run();

	let kept = 0;
	for (let i = 0; i < words.length; i += BATCH_SIZE) {
		const batch = words.slice(i, i + BATCH_SIZE);
		console.log(
			`\nBatch ${i / BATCH_SIZE + 1} (${batch.length} words, ${i + batch.length}/${words.length})...`
		);

		try {
			const results = await generateDefinitions(batch);
			console.log(`  LLM accepted ${results.length}/${batch.length}`);

			for (const q of results) {
				try {
					db.insert(questions)
						.values({
							word: q.word,
							definition: q.definition,
							category: q.category,
							difficulty: q.difficulty
						})
						.run();
					kept++;
				} catch {
					// duplicate, skip
				}
			}
		} catch (err) {
			console.error('  Batch failed:', err);
		}
	}

	console.log(`\nDone. Kept ${kept}/${words.length} words.`);
}

reseed();
