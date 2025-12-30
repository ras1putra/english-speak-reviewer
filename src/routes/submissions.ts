
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { and, desc, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../db';
import { questions, submissions } from '../db/schemas';
import { SubmissionDetail } from '../pages/components/submissionDetail';
import { SubmissionListItem } from '../pages/components/submissionListItem';
import { addAudioJob } from '../queue';
import { getFile, MINIO_BUCKET, minioClient, uploadFile } from '../services/minio';
import { logger } from '../utils/logger';
import { SubmissionBodySchema, SubmissionDetailSchema, SubmissionErrorSchema, SubmissionHeadersSchema, SubmissionResponseSchema, SubmissionSummarySchema } from '../validators/submission';

/**
 * Hono router for handling audio submissions.
 *
 * This router manages the full lifecycle of a submission:
 * 1. `POST /`: Accepts audio file uploads, validates them, saves to MinIO, and queues for processing.
 * 2. `GET /`: Lists past submissions for a user (supporting pagination and HTMX infinite scroll).
 * 3. `GET /:filename`: Retrieves detailed status and results for a specific submission.
 * 4. `GET /:filename/audio`: Streams the raw audio file from MinIO.
 */
const submissionRoute = new OpenAPIHono();
const uploadHeaderValidationSchema = z.object({
    'x-user-id': z.string().trim().min(1),
});

submissionRoute.openapi(
    createRoute({
        method: 'get',
        path: '/',
        request: {
            headers: SubmissionHeadersSchema,
            query: z.object({
                page: z.string().optional().openapi({ description: 'Page number', default: '1' }),
            }),
        },
        responses: {
            200: {
                description: 'List submissions for the authenticated user',
                content: {
                    'application/json': {
                        schema: z.array(SubmissionSummarySchema),
                    },
                    'text/html': {
                        schema: z.string(),
                    },
                },
            },
            400: {
                description: 'Missing user headers',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
            500: {
                description: 'Internal Server Error',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
        },
    }),
    // eslint-disable-next-line max-lines-per-function
    async (c) => {
        try {
            const userId = c.req.header('x-user-id')?.trim();

            if (!userId) {
                return c.json({ error: 'Missing user ID' }, 400);
            }

            const pageParam = c.req.query('page') || '1';
            const page = parseInt(pageParam, 10);
            const limit = 5;
            const offset = (page - 1) * limit;

            logger.info('Fetching submissions list', { page, limit, offset });

            const rows = await db
                .select({
                    filename: submissions.filename,
                    status: submissions.status,
                    createdAt: submissions.createdAt,
                    updatedAt: submissions.updatedAt,
                    questionId: submissions.questionId,
                    questionText: questions.text,
                })
                .from(submissions)
                .leftJoin(questions, eq(questions.id, submissions.questionId))
                .where(eq(submissions.userId, userId))
                .orderBy(desc(submissions.createdAt))
                .limit(limit + 1) // Fetch one extra to check for next page
                .offset(offset);

            const hasNextPage = rows.length > limit;
            const data = rows.slice(0, limit);

            // HTMX Response
            if (c.req.header('hx-request')) {
                const listHtml = data.map(row => SubmissionListItem({
                    filename: row.filename,
                    createdAt: row.createdAt,
                    status: row.status,
                    questionText: row.questionText ?? null,
                })).join('');

                let nextTrigger = '';

                if (hasNextPage) {
                    // Manual "Load More" button
                    nextTrigger = `
                        <button hx-get="/api/submissions?page=${page + 1}"
                                hx-trigger="click"
                                hx-swap="outerHTML"
                                class="w-full py-2 border-2 border-black bg-neutral-100 font-bold uppercase hover:bg-neutral-200 transition-colors cursor-pointer text-xs">
                             Load More Tapes
                        </button>
                    `;
                }

                // If it's the first page/request and no data, show empty state
                if (page === 1 && data.length === 0) {
                    return c.html(`
                        <div class="h-full flex flex-col items-center justify-center text-center p-4">
                            <div class="mb-2"><i data-lucide="cassette-tape" class="w-12 h-12"></i></div>
                            <p class="font-black uppercase text-lg">No Tapes Found</p>
                            <p class="text-sm font-bold text-black/60 mb-4">You haven't recorded anything yet.</p>
                            <a href="/review" class="border-2 border-black bg-green-400 px-4 py-2 font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:shadow-none transition-all">
                                Go to Studio
                            </a>
                        </div>
                     `);
                }

                return c.html(listHtml + nextTrigger);
            }

            // JSON Response
            const payload = data.map((row) => ({
                filename: row.filename,
                status: row.status,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                questionId: row.questionId,
                questionText: row.questionText ?? null,
            }));

            return c.json(payload);
        } catch (error) {
            logger.error('Failed to list submissions', { error });

            return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
);

submissionRoute.openapi(
    createRoute({
        method: 'get',
        path: '/:filename',
        request: {
            headers: SubmissionHeadersSchema,
            params: z.object({
                filename: z.string().openapi({
                    description: 'Submission filename (job identifier)',
                }),
            }),
        },
        responses: {
            200: {
                description: 'Detailed submission payload',
                content: {
                    'application/json': {
                        schema: SubmissionDetailSchema,
                    },
                    'text/html': {
                        schema: z.string(),
                    },
                },
            },
            400: {
                description: 'Missing user headers',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
            404: {
                description: 'Not found',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
            500: {
                description: 'Internal Server Error',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
        },
    }),
    // eslint-disable-next-line complexity
    async (c) => {
        try {
            const userId = c.req.header('x-user-id')?.trim();

            if (!userId) {
                return c.json({ error: 'Missing user ID' }, 400);
            }

            const { filename } = c.req.valid('param');

            logger.info('Fetching submission detail', { filename });

            const [record] = await db
                .select({
                    filename: submissions.filename,
                    status: submissions.status,
                    createdAt: submissions.createdAt,
                    updatedAt: submissions.updatedAt,
                    questionId: submissions.questionId,
                    questionText: questions.text,
                    result: submissions.result,
                    errorMessage: submissions.errorMessage,
                })
                .from(submissions)
                .leftJoin(questions, eq(questions.id, submissions.questionId))
                .where(and(eq(submissions.userId, userId), eq(submissions.filename, filename)))
                .limit(1);

            if (!record) {
                return c.json({ error: 'Submission not found' }, 404);
            }

            if (c.req.header('hx-request')) {
                // Debug log
                logger.info('Rendering submission detail', {
                    filename: record.filename,
                    hasResult: Boolean(record.result),
                    resultType: typeof record.result
                });

                try {
                    return c.html(SubmissionDetail({
                        filename: record.filename,
                        status: record.status,
                        createdAt: record.createdAt,
                        questionText: record.questionText ?? null,
                        result: record.result ?? null,
                        errorMessage: record.errorMessage ?? null,
                    }));
                } catch (renderError: unknown) {
                    const err = renderError as Error;

                    logger.error('Failed to render submission detail', {
                        message: err.message,
                        stack: err.stack
                    });
                    throw renderError;
                }
            }

            return c.json({
                filename: record.filename,
                status: record.status,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                questionId: record.questionId,
                questionText: record.questionText ?? null,
                result: record.result ?? null,
                errorMessage: record.errorMessage ?? null,
            });
        } catch (error) {
            logger.error('Failed to fetch submission detail', { error });

            return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
);

submissionRoute.openapi(
    createRoute({
        method: 'get',
        path: '/:filename/audio',
        request: {
            headers: SubmissionHeadersSchema,
            params: z.object({
                filename: z.string().openapi({
                    description: 'Submission filename (job identifier)',
                }),
            }),
        },
        responses: {
            200: {
                description: 'Audio file for the submission',
                content: {
                    'audio/*': {
                        schema: z.any().openapi({ format: 'binary' }),
                    },
                },
            },
            400: {
                description: 'Missing user headers',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
            404: {
                description: 'Not found',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
            500: {
                description: 'Internal Server Error',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema,
                    },
                },
            },
        },
    }),

    async (c) => {
        try {
            const userId = c.req.header('x-user-id')?.trim();

            if (!userId) {
                return c.json({ error: 'Missing user ID' }, 400);
            }

            const { filename } = c.req.valid('param');

            logger.info('Fetching submission audio', { filename });

            const [record] = await db
                .select({
                    filename: submissions.filename,
                    userId: submissions.userId,
                })
                .from(submissions)
                .where(and(eq(submissions.userId, userId), eq(submissions.filename, filename)))
                .limit(1);

            if (!record) {
                return c.json({ error: 'Submission not found' }, 404);
            }

            const buffer = await getFile(filename);
            const extension = filename.split('.').pop()?.toLowerCase();
            const mime = extension === 'wav'
                ? 'audio/wav'
                : extension === 'mp3'
                    ? 'audio/mpeg'
                    : extension === 'webm'
                        ? 'audio/webm'
                        : 'application/octet-stream';

            c.header('Content-Type', mime);
            c.header('Content-Disposition', `attachment; filename="${filename}"`);

            return c.body(buffer as unknown as ArrayBuffer);
        } catch (error) {
            logger.error('Failed to fetch submission audio', { error });

            return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
);

submissionRoute.openapi(
    createRoute({
        method: 'post',
        path: '/',
        request: {
            headers: SubmissionHeadersSchema,
            body: {
                content: {
                    'multipart/form-data': {
                        schema: SubmissionBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: 'Submission accepted successfully',
                content: {
                    'application/json': {
                        schema: SubmissionResponseSchema,
                    },
                },
            },
            400: {
                description: 'Bad Request',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema
                    }
                }
            },
            500: {
                description: 'Internal Server Error',
                content: {
                    'application/json': {
                        schema: SubmissionErrorSchema
                    }
                }
            },
        },
    }),
    // eslint-disable-next-line max-lines-per-function, complexity -- Handles upload validation and dispatch.
    async (c) => {
        let filename: string | null = null;

        try {
            const body = await c.req.parseBody();
            const userIdResult = uploadHeaderValidationSchema.safeParse({
                'x-user-id': c.req.header('x-user-id') ?? '',
            });

            if (!userIdResult.success) {
                return c.json({ error: 'Missing or invalid user ID' }, 400);
            }
            const payloadResult = SubmissionBodySchema.safeParse(body);

            if (!payloadResult.success) {
                const hasIssue = (field: string): boolean => payloadResult.error.issues.some((issue) => issue.path[0] === field);

                if (hasIssue('file')) {
                    return c.json({ error: 'No file uploaded or invalid file type' }, 400);
                }
                if (hasIssue('questionId')) {
                    return c.json({ error: 'Missing or invalid question ID' }, 400);
                }

                return c.json({ error: 'Invalid submission payload' }, 400);
            }
            const { file, questionId } = payloadResult.data;
            const userId = userIdResult.data['x-user-id'];

            const buffer = Buffer.from(await file.arrayBuffer());

            logger.info('Processing new submission upload', {
                fileSize: buffer.length,
                mimeType: file.type,
                questionId
            });

            const type = await fileTypeFromBuffer(buffer);

            const isAudio = type?.mime.startsWith('audio/');
            const isWebm = type?.mime === 'video/webm';

            if (!isAudio && !isWebm) {
                logger.warn("Invalid file signature detected", { detected: type?.mime });

                return c.json({ error: 'Invalid file type. Only audio or microphone WebM files are allowed.' }, 400);
            }

            const extension = isWebm ? 'webm' : type?.ext || 'audio';

            filename = `${uuidv4()}.${extension}`;

            await uploadFile(filename, buffer, {
                'Content-Type': file.type
            });

            // Save submission to DB
            await db.insert(submissions).values({
                filename,
                userId,
                questionId,
                status: 'pending',
            });

            logger.info('Submission saved to database', { filename });

            const job = await addAudioJob(filename, filename, userId, questionId);

            logger.info('Job added to processing queue', { jobId: job.id, filename });

            return c.json({
                filename,
                jobId: job.id!,
                message: 'Submission accepted successfully'
            }, 200);

        } catch (error) {
            logger.error('Submission failed', { error });
            if (filename) {
                try {
                    await minioClient.removeObject(MINIO_BUCKET, filename);
                    logger.info('Cleaned up failed upload', { filename });
                } catch (cleanupError) {
                    logger.error('Failed to clean up upload', { filename, error: cleanupError });
                }
            }

            return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
);

export default submissionRoute;
