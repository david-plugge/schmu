import { and, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from './db';
import { questions } from './db/schema';
import { CATEGORY_SLUGS, type CategorySlug } from '$lib/categories';
import type { Question } from '$lib/phase-machine';

export interface QuestionCatalogue {
	pickNext(categories: CategorySlug[]): Question | null;
	recordPlay(questionId: number): void;
	recordVote(questionId: number, delta: number): void;
}

export function createDbCatalogue(): QuestionCatalogue {
	const usedWords: string[] = [];

	return {
		pickNext(categories) {
			const conditions: SQL[] = [];
			if (usedWords.length > 0) {
				conditions.push(notInArray(questions.word, usedWords));
			}
			if (categories.length > 0 && categories.length < CATEGORY_SLUGS.length) {
				conditions.push(inArray(questions.category, categories));
			}

			const [q] = db
				.select({
					id: questions.id,
					word: questions.word,
					definition: questions.definition
				})
				.from(questions)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(questions.timesPlayed, sql`RANDOM()`)
				.limit(1)
				.all();

			if (!q) return null;
			usedWords.push(q.word);
			return q;
		},
		recordPlay(questionId) {
			db.update(questions)
				.set({ timesPlayed: sql`${questions.timesPlayed} + 1` })
				.where(eq(questions.id, questionId))
				.run();
		},
		recordVote(questionId, delta) {
			db.update(questions)
				.set({ votes: sql`${questions.votes} + ${delta}` })
				.where(eq(questions.id, questionId))
				.run();
		}
	};
}
