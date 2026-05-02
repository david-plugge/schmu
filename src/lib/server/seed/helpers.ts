import { SqliteError } from 'better-sqlite3';
import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import type { generateDefinitions } from './definitions';

export const LLM_BATCH_SIZE = 20;

export type GeneratedQuestion = Awaited<ReturnType<typeof generateDefinitions>>[number];

export function getExistingWords(): string[] {
	return db
		.select({ word: questions.word })
		.from(questions)
		.all()
		.map((q) => q.word);
}

export function insertResults(results: GeneratedQuestion[]): number {
	let inserted = 0;
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
			inserted++;
		} catch (err) {
			if (err instanceof SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') continue;
			throw err;
		}
	}
	return inserted;
}
