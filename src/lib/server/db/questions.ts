import { eq, notInArray, sql } from 'drizzle-orm';
import { db } from '.';
import { questions } from './schema';

export function getRandomQuestions(count: number, excludeWords: string[]) {
	return db
		.select({ id: questions.id, word: questions.word, definition: questions.definition })
		.from(questions)
		.where(excludeWords.length > 0 ? notInArray(questions.word, excludeWords) : undefined)
		.orderBy(sql`RANDOM()`)
		.limit(count)
		.all();
}

export function voteQuestion(questionId: number, delta: number) {
	db.update(questions)
		.set({ votes: sql`${questions.votes} + ${delta}` })
		.where(eq(questions.id, questionId))
		.run();
}
