
import { pgTable, text, timestamp,uuid } from 'drizzle-orm/pg-core';

/**
 * Drizzle schema for the `questions` table.
 *
 * Contains the library of interview prompts/questions served to users.
 */
export const questions = pgTable('questions', {
    id: uuid('id').defaultRandom().primaryKey(),
    text: text('text').notNull(),
    category: text('category'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Type representing a row selected from the `questions` table.
 */
export type Question = typeof questions.$inferSelect;

/**
 * Type representing the data required to insert a new row into the `questions` table.
 */
export type NewQuestion = typeof questions.$inferInsert;
