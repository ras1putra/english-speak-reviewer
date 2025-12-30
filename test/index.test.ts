
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('hono/bun', () => ({
    serveStatic: vi.fn(() => (c: any, next: any) => next()),
    upgradeWebSocket: vi.fn((handler) => handler),
    websocket: {}
}));

const { mockJobStatusHub } = vi.hoisted(() => {
    return {
        mockJobStatusHub: {
            addSubscriber: vi.fn(),
            removeSocket: vi.fn(),
        }
    };
});

vi.mock('@/services/minio', () => ({
    initBucket: vi.fn(),
}));
import { initBucket } from '@/services/minio';

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
    contextStorage: {
        run: vi.fn((store, callback) => callback()),
    }
}));
import { logger } from '@/utils/logger';

// Mock renderPage to test error handling
vi.mock('@/pages/render', () => ({
    renderPage: vi.fn((content) => content)
}));
import { renderPage } from '@/pages/render';

// Mock routes
vi.mock('@/routes/submissions', () => ({
    default: new Hono().get('/', c => c.text('Mock Submissions'))
}));
vi.mock('@/routes/question', () => ({
    default: new Hono().get('/random', c => c.text('Mock Question'))
}));
import { Hono } from 'hono';

vi.mock('@/realtime/jobStatus', () => ({
    jobStatusHub: mockJobStatusHub,
}));

// Mock real Bun.serve
const mockServe = vi.fn();
global.Bun = {
    serve: mockServe,
} as any;

import { app, start, createStatusSocketHandler, rewritePublicAssetPath, logUnhandledError } from '@/index';

describe('App Entry Point', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockJobStatusHub.addSubscriber.mockReset();
        mockJobStatusHub.removeSocket.mockReset();
    });

    describe('Public helpers', () => {
        it('rewrites public asset paths', () => {
            expect(rewritePublicAssetPath('/public/assets/file.png')).toBe('/assets/file.png');
            expect(rewritePublicAssetPath('/anything-else')).toBe('/anything-else');
        });

        it('logs non-error throwables with helper', () => {
            logUnhandledError('fail');
            expect(logger.error).toHaveBeenCalledWith('Unhandled application error', { error: 'fail' });
        });
    });

    describe('Routes', () => {
        it('GET / should render Home', async () => {
            const res = await app.request('/');
            expect(res.status).toBe(200);
            expect(await res.text()).toContain('English');
        });

        it('GET /health should return json', async () => {
            const res = await app.request('/health');
            expect(res.status).toBe(200);
        });

        it('GET /review and /history render pages', async () => {
            const reviewRes = await app.request('/review');
            expect(reviewRes.status).toBe(200);
            const historyRes = await app.request('/history');
            expect(historyRes.status).toBe(200);
        });

        it('returns 404 for unknown routes', async () => {
            const res = await app.request('/missing');
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: 'Not Found' });
        });

        it('Should handle Errors', async () => {
            // Mock renderPage to throw, which is called by / route
            (renderPage as any).mockImplementationOnce(() => {
                throw new Error('Render Fail');
            });
            const res = await app.request('/');
            expect(res.status).toBe(500);
            expect(logger.error).toHaveBeenCalled();
        });

    });

    describe('Server Start', () => {
        it('should init bucket and start server', async () => {
            (initBucket as any).mockResolvedValue(undefined);
            await start();
            expect(initBucket).toHaveBeenCalled();
            expect(mockServe).toHaveBeenCalled();
        });

        it('exits process when bucket init fails', async () => {
            (initBucket as any).mockRejectedValueOnce(new Error('boom'));
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

            await start();

            expect(logger.error).toHaveBeenCalledWith('Failed to initialize MinIO bucket', expect.any(Object));
            expect(exitSpy).toHaveBeenCalledWith(1);
            exitSpy.mockRestore();
        });
    });

    describe('Status Socket Handler', () => {
        const createContext = (query: Record<string, string | undefined>) => ({
            req: {
                query: (key: string) => query[key] ?? undefined,
            },
        }) as any;

        const buildDeps = () => ({
            jobStatusHub: {
                addSubscriber: vi.fn(),
                removeSocket: vi.fn(),
            } as any,
            logger: {
                info: vi.fn(),
                error: vi.fn(),
            } as any,
            getCookie: vi.fn().mockReturnValue(''),
        });

        it('closes connection when user id missing', () => {
            const deps = buildDeps();
            const handler = createStatusSocketHandler(deps);
            const lifecycle = handler(createContext({ taskId: 'task-1', userId: undefined }));
            const ws = { close: vi.fn() };
            lifecycle.onOpen?.({} as any, ws as any);

            expect(ws.close).toHaveBeenCalledWith(1008, 'Missing job credentials');
            expect(deps.jobStatusHub.addSubscriber).not.toHaveBeenCalled();
        });

        it('logs error when websocket object is invalid', () => {
            const deps = buildDeps();
            const handler = createStatusSocketHandler(deps);
            const lifecycle = handler(createContext({ taskId: 'task-1', userId: 'user-123' }));
            const invalidWs = {};
            lifecycle.onOpen?.({} as any, invalidWs as any);
            expect(deps.logger.error).toHaveBeenCalledWith('WebSocket object invalid or missing send method', { ws: invalidWs });
            expect(deps.jobStatusHub.addSubscriber).not.toHaveBeenCalled();
        });

        it('subscribes socket, responds to ping, and removes on close', () => {
            const deps = buildDeps();
            deps.getCookie.mockReturnValue('cookie-user');
            const handler = createStatusSocketHandler(deps);
            const lifecycle = handler(createContext({ taskId: undefined, userId: undefined }));
            const ws = { send: vi.fn(), close: vi.fn() };

            lifecycle.onOpen?.({} as any, ws as any);

            expect(deps.jobStatusHub.addSubscriber).toHaveBeenCalledWith('all', 'cookie-user', ws);
            expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"status":"connected"'));

            lifecycle.onMessage?.({ data: 'ping' } as any, ws as any);
            expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ status: 'pong' }));

            lifecycle.onClose?.({} as any, ws as any);
            expect(deps.jobStatusHub.removeSocket).toHaveBeenCalledWith(ws);
        });
    });
});
