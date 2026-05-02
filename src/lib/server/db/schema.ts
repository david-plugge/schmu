import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CategorySlug } from '$lib/categories';
import type { DifficultySlug } from '$lib/difficulties';

export const questions = sqliteTable('questions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	word: text('word').notNull().unique(),
	definition: text('definition').notNull(),
	category: text('category').$type<CategorySlug>().notNull().default('sonstiges'),
	difficulty: text('difficulty').$type<DifficultySlug>().notNull().default('mittel'),
	votes: integer('votes').notNull().default(0),
	timesPlayed: integer('times_played').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const rejectedWords = sqliteTable('rejected_words', {
	word: text('word').primaryKey(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
