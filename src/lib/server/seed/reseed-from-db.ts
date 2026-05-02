import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import { generateDefinitions } from './definitions';
import { LLM_BATCH_SIZE, getExistingWords, insertResults } from './helpers';

async function reseed() {
	const words = getExistingWords();
	console.log(`Loaded ${words.length} words from DB`);
	if (words.length === 0) {
		console.log('Nothing to do.');
		return;
	}

	console.log('Truncating questions table...');
	db.delete(questions).run();

	let kept = 0;
	for (let i = 0; i < words.length; i += LLM_BATCH_SIZE) {
		const batch = words.slice(i, i + LLM_BATCH_SIZE);
		console.log(
			`\nBatch ${i / LLM_BATCH_SIZE + 1} (${batch.length} words, ${i + batch.length}/${words.length})...`
		);

		try {
			const results = await generateDefinitions(batch);
			console.log(`  LLM accepted ${results.length}/${batch.length}`);
			kept += insertResults(results);
		} catch (err) {
			console.error('  Batch failed:', err);
		}
	}

	console.log(`\nDone. Kept ${kept}/${words.length} words.`);
}

reseed();
