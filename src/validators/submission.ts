
import { z } from '@hono/zod-openapi';

const TimestampSchema = z.union([z.string(), z.date()]).openapi({
    type: 'string',
    format: 'date-time',
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const fileFieldSchema = z.custom<File>(
    (value): value is File => typeof File !== 'undefined' && value instanceof File,
    'Invalid file upload'
);

/**
 * Validation schema for the file upload payload.
 * Expects a binary file (`file`) and the associated `questionId`.
 */
export const SubmissionBodySchema = z.object({
    file: fileFieldSchema.openapi({ format: 'binary' }),
    questionId: z.string().trim().refine((value) => uuidPattern.test(value), {
        message: 'Invalid UUID',
    }).openapi({
        description: 'The UUID of the prompt answered in this recording',
        example: '550e8400-e29b-41d4-a716-446655440000'
    }),
});

/**
 * Schema for a summary item in the submissions list.
 */
export const SubmissionSummarySchema = z.object({
    filename: z.string(),
    questionId: z.uuid(),
    questionText: z.string().nullable(),
    status: z.string(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

/**
 * Schema for full submission details, extending the summary
 * with processing results and error messages.
 */
export const SubmissionDetailSchema = SubmissionSummarySchema.extend({
    result: z.unknown().nullable(),
    errorMessage: z.string().nullable(),
});

/**
 * Schema for the successful response after queuing a submission job.
 */
export const SubmissionResponseSchema = z.object({
    filename: z.string().openapi({
        description: 'The unique filename of the uploaded audio',
        example: '550e8400-e29b-41d4-a716-446655440000.wav'
    }),
    jobId: z.string().openapi({
        description: 'The ID of the background processing job',
        example: '1'
    }),
    message: z.string().openapi({
        description: 'Success message',
        example: 'Submission queued successfully'
    }),
});

/**
 * Standard error response schema.
 */
export const SubmissionErrorSchema = z.object({
    error: z.string()
});
