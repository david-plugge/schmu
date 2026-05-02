import { dev } from '$app/environment';
import { query } from '$app/server';
import { db } from '$lib/server/db';
import { questions } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, gt, lt, or, sql, type SQL } from 'drizzle-orm';
import z from 'zod';

const PAGE_SIZE = 50;

const cursorSchema = z.object({ votes: z.number(), word: z.string() });

function searchFilter(search: string): SQL | undefined {
	const trimmed = search.trim().toLowerCase();
	if (!trimmed) return undefined;
	const pattern = `%${trimmed}%`;
	return or(
		sql`LOWER(${questions.word}) LIKE ${pattern}`,
		sql`LOWER(${questions.definition}) LIKE ${pattern}`
	);
}

export const getWords = query(
	z.object({
		cursor: cursorSchema.nullable(),
		search: z.string()
	}),
	({ cursor, search }) => {
		if (!dev) error(404);

		const cursorFilter = cursor
			? or(
					lt(questions.votes, cursor.votes),
					and(eq(questions.votes, cursor.votes), gt(questions.word, cursor.word))
				)
			: undefined;

		const where = and(searchFilter(search), cursorFilter);

		const rows = db
			.select({
				id: questions.id,
				word: questions.word,
				definition: questions.definition,
				votes: questions.votes
			})
			.from(questions)
			.where(where)
			.orderBy(desc(questions.votes), asc(questions.word))
			.limit(PAGE_SIZE + 1)
			.all();

		const hasMore = rows.length > PAGE_SIZE;
		const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
		const last = items.at(-1);
		const nextCursor = hasMore && last ? { votes: last.votes, word: last.word } : null;

		return { items, nextCursor };
	}
);

export const getWordsCount = query(z.object({ search: z.string() }), ({ search }) => {
	if (!dev) error(404);

	return db.$count(questions, searchFilter(search));
});
