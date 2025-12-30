
import { z } from '@hono/zod-openapi';

/**
 * Zod schema for a Question object.
 * Represents a single interview prompt available to users.
 */
export const QuestionSchema = z.object({
    id: z.uuid(),
    text: z.string(),
    createdAt: z.union([z.string(), z.date()]).openapi({
        type: 'string',
        format: 'date-time',
    }),
    updatedAt: z.union([z.string(), z.date()]).openapi({
        type: 'string',
        format: 'date-time',
    }),
});

/**
 * Zod schema for validation of request headers in Question-related endpoints.
 * Requires the `x-user-id` header for user identification.
 */
export const QuestionRequestHeadersSchema = z.object({
    'x-user-id': z.string().openapi({
        description: 'Hashed user identifier issued from the login modal',
        example: '$2a$10$T9l6uJ7Vwh41Lw5rZ6aXEu4m4z6E7',
    }),
});

/**
 * Schema for a summary item in the submissions list.
 */
export const SubmissionSummarySchema = z.object({
    filename: z.string(),
    questionId: z.string().uuid(),
    questionText: z.string().nullable(),
    status: z.string(),
    createdAt: z.union([z.string(), z.date()]).openapi({
        type: 'string',
        format: 'date-time',
    }),
    updatedAt: z.union([z.string(), z.date()]).openapi({
        type: 'string',
        format: 'date-time',
    }),
});

/**
 * Validation schema for headers required in Submission endpoints.
 * Enforces presence of `x-user-id`.
 */
export const SubmissionHeadersSchema = z.object({
    'x-user-id': z.string().openapi({
        description: 'Hashed user identifier issued from the login modal',
        example: '$2a$10$T9l6uJ7Vwh41Lw5rZ6aXEu4m4z6E7',
    }),
});
