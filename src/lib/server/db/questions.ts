import { notInArray, sql } from 'drizzle-orm';
import { db } from '.';
import { questions } from './schema';

export function getRandomQuestions(count: number, excludeWords: string[]) {
	return db
		.select({ word: questions.word, definition: questions.definition })
		.from(questions)
		.where(notInArray(questions.word, excludeWords))
		.orderBy(sql`RANDOM()`)
		.limit(count)
		.all();
}
