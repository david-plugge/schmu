import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const questions = sqliteTable('questions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	word: text('word').notNull().unique(),
	definition: text('definition').notNull(),
	votes: integer('votes').notNull().default(0)
});
