
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { questions } from './question';

/**
 * Drizzle schema for the `submissions` table.
 *
 * Stores the metadata for each audio coding challenge attempt.
 * - `filename`: The unique identifier (UUID based) for the audio file and job.
 * - `result`: Stores the JSON output from the AI worker (scores, transcript, feedback).
 * - `status`: Tracks the processing state (pending, uploaded, processing, completed, failed).
 */
export const submissions = pgTable('submissions', {
    filename: text('filename').primaryKey(),
    userId: text('user_id').notNull(),
    questionId: uuid('question_id').notNull().references(
        /* v8 ignore next */
        () => questions.id
    ),
    status: text('status').notNull().default('pending'),
    result: jsonb('result'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Type representing a row selected from the `submissions` table.
 */
export type Submission = typeof submissions.$inferSelect;

/**
 * Type representing the data required to insert a new row into the `submissions` table.
 */
export type NewSubmission = typeof submissions.$inferInsert;
