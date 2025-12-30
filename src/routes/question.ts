
import { createRoute,OpenAPIHono } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';

import { db } from '../db';
import { questions } from '../db/schemas';
import { QuestionPrompt } from '../pages/components/questionPrompt';
import { logger } from '../utils/logger';
import { QuestionRequestHeadersSchema,QuestionSchema } from '../validators/question';

/**
 * Route handler for fetching interview questions.
 *
 * Provides a random question/prompt for the user to answer.
 * Supports both JSON API responses and HTMX HTML fragment rendering.
 */
const questionRoute = new OpenAPIHono();

questionRoute.openapi(
    createRoute({
        method: 'get',
        path: '/random',
        request: {
            headers: QuestionRequestHeadersSchema,
        },
        responses: {
            200: {
                description: 'Random question fetched successfully',
                content: {
                    'application/json': {
                        schema: QuestionSchema,
                    },
                },
            },
            404: {
                description: 'No questions found',
            },
            500: {
                description: 'Internal Server Error',
            },
        },
    }),
    async (c) => {
        try {
            const userId = c.req.header('x-user-id')?.trim();

            if (!userId) {
                logger.warn("Missing user id when requesting question");

                return c.json({ error: 'Missing user ID' }, 400);
            }

            logger.info('Fetching random question');

            const [randomQuestion] = await db
                .select()
                .from(questions)
                .orderBy(sql`RANDOM()`)
                .limit(1);

            if (!randomQuestion) {
                return c.json({ error: 'No questions found' }, 404);
            }

            logger.info("Question fetched successfully", { id: randomQuestion.id });
            if (c.req.header('hx-request')) {
                return c.html(QuestionPrompt({ question: randomQuestion }));
            }

            return c.json(randomQuestion, 200);
        } catch (error) {
            logger.error("Failed to fetch random question", { error });

            return c.json({ error: 'Internal Server Error' }, 500);
        }
    }
);

export default questionRoute;
