
import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic, upgradeWebSocket, websocket } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { type WSContext } from 'hono/ws';
import { v4 as uuidv4 } from 'uuid';

import { createRateLimiter } from './middleware/rateLimit';
import { jobStatusHub } from './realtime/jobStatus';
import { registerPageRoutes } from './routes/pages';
import questionRoute from './routes/question';
import submissionRoute from './routes/submissions';
import { initBucket } from './services/minio';
import { contextStorage, logger } from './utils/logger';

/**
 * Bun + Hono Entrypoint for the Audio Practice Application.
 *
 * This file configures the Hono web server, setting up:
 * - Request-scoped logging via AsyncLocalStorage.
 * - Static file serving for styles and public assets.
 * - Global error handling.
 * - UI Page routing (Home, Review, History).
 * - API routing (Submissions, Questions).
 * - WebSocket endpoints for real-time job status updates.
 * - OpenAPI documentation via Scalar.
 *
 * It initializes external services (MinIO) before starting the server.
 */
export const app = new OpenAPIHono();

/**
 * Splits a comma-separated origin list into trimmed entries, ignoring blanks.
 * @param raw Raw `ALLOWED_ORIGINS` environment variable value.
 * @returns List of sanitized origins.
 */
const parseAllowedOrigins = (raw?: string): string[] => raw?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];

/**
 * Parses numeric env strings and guarantees a positive integer fallback.
 * @param value Raw env string to parse.
 * @param fallback Default value when parsing fails.
 */
const toPositiveInt = (value: string | undefined, fallback: number): number => {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(Math.floor(parsed), 1);
};
const defaultAllowedOrigins = [
    'http://localhost:8888',
    'http://127.0.0.1:8888'
];
const envAllowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const allowedOrigins = envAllowedOrigins.length ? envAllowedOrigins : defaultAllowedOrigins;
const allowedOriginSet = new Set(allowedOrigins);
const rateLimitWindowMs = toPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
const rateLimitMaxRequests = toPositiveInt(process.env.RATE_LIMIT_MAX, 120);
/** Hard cap for incoming payload size (10 MB). */
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Global rate limiter throttling abusive clients while exposing limits in headers.
 */
const requestRateLimiter = createRateLimiter({
    windowMs: rateLimitWindowMs,
    max: rateLimitMaxRequests,
});

/**
 * Checks whether an origin matches the configured allowlist.
 */
const isOriginAllowed = (origin?: string | null): boolean => {
    if (!origin) {
        return true;
    }

    return allowedOriginSet.has(origin);
};

/**
 * Middleware that rejects requests from disallowed origins early.
 */
const enforceAllowedOrigins: MiddlewareHandler = async (c, next) => {
    const origin = c.req.header('origin');

    if (origin && !isOriginAllowed(origin)) {
        logger.warn('Blocked request from disallowed origin', { origin, path: c.req.path });

        return c.json({ error: 'Origin not allowed' }, 403);
    }
    await next();
};

app.use('*', enforceAllowedOrigins);
app.use('*', cors({
    origin: (origin) => {
        if (!origin) {
            return allowedOrigins[0];
        }

        return isOriginAllowed(origin) ? origin : '';
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 60 * 60 * 24,
}));
app.use('*', secureHeaders({
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xFrameOptions: 'DENY',
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'https://unpkg.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
    },
    permissionsPolicy: {
        accelerometer: false,
        ambientLightSensor: false,
        autoplay: ['self'],
        camera: false,
        displayCapture: false,
        encryptedMedia: false,
        fullscreen: ['self'],
        geolocation: false,
        gyroscope: false,
        magnetometer: false,
        microphone: ['self'],
        midi: false,
        payment: false,
        pictureInPicture: ['self'],
        usb: false,
    },
}));
app.use('*', bodyLimit({ maxSize: MAX_PAYLOAD_BYTES }));
app.use('*', requestRateLimiter);

// Middleware to inject request context (requestId, userId) into logger
const attachRequestContext: MiddlewareHandler = async (c, next) => {
    const requestId = uuidv4();
    const userId = getCookie(c, 'english-speak-reviewer-id') || 'guest';
    const store = new Map<string, string>();

    store.set('requestId', requestId);
    store.set('userId', userId);

    await contextStorage.run(store, async () => {
        await next();
    });
};

app.use('*', attachRequestContext);

export const rewritePublicAssetPath = (path: string): string => path.replace(/^\/public/, '');

app.use('/styles.css', serveStatic({ path: './public/styles.css' }));
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));
app.use('/public/*', serveStatic({
    root: './public',
    rewriteRequestPath: rewritePublicAssetPath,
}));

export const logUnhandledError = (err: unknown): void => {
    if (err instanceof Error) {
        logger.error('Unhandled application error', {
            message: err.message,
            stack: err.stack,
        });
    } else {
        logger.error('Unhandled application error', { error: err });
    }
};

app.onError((err, c) => {
    logUnhandledError(err);

    return c.json({ error: 'Internal Server Error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));
registerPageRoutes(app);
app.route('/api/submissions', submissionRoute);
app.route('/api/questions', questionRoute);

/**
 * Dependencies passed to the WebSocket status hub so it can be mocked in tests.
 */
type StatusSocketDeps = {
    jobStatusHub: typeof jobStatusHub;
    logger: typeof logger;
    getCookie: typeof getCookie;
};

/**
 * Handler type for the WebSocket status route.
 */
type StatusSocketHandler = (c: Context) => {
    onOpen: (evt: unknown, ws: WSContext) => void;
    onMessage?: (event: { data?: unknown }, ws: WSContext) => void;
    onClose?: (event: unknown, ws: WSContext) => void;
};

export const createStatusSocketHandler = (deps: StatusSocketDeps = { jobStatusHub, logger, getCookie }): StatusSocketHandler => (c: Context) => {
    const taskId = c.req.query('taskId') || 'all';
    const cookieUser = deps.getCookie(c, 'english-speak-reviewer-id');
    const queryUser = c.req.query('userId');
    const userId = queryUser || cookieUser || '';

    if (!userId) {
        return {
            onOpen(_evt: unknown, ws: WSContext) {
                ws.close(1008, 'Missing job credentials');
            },
        };
    }

    return {
        onOpen(evt: unknown, ws: WSContext) {
            deps.logger.info('onOpen called', { evtType: typeof evt, wsType: typeof ws });

            if (!ws || typeof ws.send !== 'function') {
                deps.logger.error('WebSocket object invalid or missing send method', { ws });

                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deps.jobStatusHub.addSubscriber(taskId, userId, ws as any);
            ws.send(JSON.stringify({
                taskId,
                status: 'connected',
            }));
        },
        onMessage(event: { data?: unknown }, ws: WSContext) {
            if (typeof event.data === 'string' && event.data === 'ping') {
                ws.send(JSON.stringify({ status: 'pong' }));
            }
        },
        onClose(_event: unknown, ws: WSContext) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            deps.jobStatusHub.removeSocket(ws as any);
        },
    };
};

const statusSocket = upgradeWebSocket(createStatusSocketHandler());

app.get('/ws/status', statusSocket);

app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
        title: 'English Speak Reviewer API',
        version: '0.1.0',
    },
});

app.get('/docs', Scalar({
    url: '/openapi.json',
    pageTitle: 'English Speak Reviewer API Docs',
    theme: 'moon',
    darkMode: true,
}));

export const start = async (): Promise<void> => {
    try {
        await initBucket();
        logger.info('MinIO bucket ensured');
    } catch (error) {
        logger.error('Failed to initialize MinIO bucket', { error });
        process.exit(1);
    }

    const port = 8000;

    Bun.serve({
        port,
        fetch: app.fetch,
        websocket,
    });

    logger.info(`HTTP server listening`, { port });
};

/* v8 ignore start */
if (import.meta.main) {
    start().catch((error) => {
        logger.error('Failed to start server', { error });
        process.exit(1);
    });
}
/* v8 ignore stop */
