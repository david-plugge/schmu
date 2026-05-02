import { and, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '.';
import { questions } from './schema';
import { CATEGORY_SLUGS, type CategorySlug } from '$lib/categories';

export function getRandomQuestions(
	count: number,
	excludeWords: string[],
	enabledCategories: CategorySlug[]
) {
	const conditions: SQL[] = [];
	if (excludeWords.length > 0) {
		conditions.push(notInArray(questions.word, excludeWords));
	}
	if (enabledCategories.length > 0 && enabledCategories.length < CATEGORY_SLUGS.length) {
		conditions.push(inArray(questions.category, enabledCategories));
	}

	return db
		.select({ id: questions.id, word: questions.word, definition: questions.definition })
		.from(questions)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
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
