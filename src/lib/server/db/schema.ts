import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CategorySlug } from '$lib/categories';

export const questions = sqliteTable('questions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	word: text('word').notNull().unique(),
	definition: text('definition').notNull(),
	category: text('category').$type<CategorySlug>().notNull().default('sonstiges'),
	votes: integer('votes').notNull().default(0)
});
