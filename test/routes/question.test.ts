
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
        }
    };
});

vi.mock('@/db', () => ({
    db: mockDb
}));

vi.mock('@/db/schemas', () => ({
    questions: 'questions_table'
}));

import questionRoute from '@/routes/question';

describe('Question Route', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = new Hono();
        app.route('/', questionRoute);
    });

    it('should return 400 if user id header is missing', async () => {
        const res = await app.request('/random', {
            method: 'GET',
        });
        expect(res.status).toBe(400);
    });

    it('should return 400 if user id header is blank', async () => {
        const res = await app.request('/random', {
            method: 'GET',
            headers: { 'x-user-id': '   ' }
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'Missing user ID' });
    });

    it('should return 404 if no questions found', async () => {
        mockDb.limit.mockResolvedValue([]); // No results

        const res = await app.request('/random', {
            method: 'GET',
            headers: { 'x-user-id': 'user-123' }
        });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'No questions found' });
    });

    it('should return 200 and a question object', async () => {
        const mockQuestion = { id: 'q1', text: 'Test Question' };
        mockDb.limit.mockResolvedValue([mockQuestion]);

        const res = await app.request('/random', {
            method: 'GET',
            headers: { 'x-user-id': 'user-123' }
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(mockQuestion);
    });

    it('should return HTML fragment if hx-request header is present', async () => {
        const mockQuestion = { id: 'q1', text: 'Test Question' };
        mockDb.limit.mockResolvedValue([mockQuestion]);

        const res = await app.request('/random', {
            method: 'GET',
            headers: {
                'x-user-id': 'user-123',
                'hx-request': 'true'
            }
        });

        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('Test Question');
    });

    it('should handle db errors gracefully', async () => {
        mockDb.limit.mockRejectedValue(new Error('DB Error'));

        const res = await app.request('/random', {
            method: 'GET',
            headers: { 'x-user-id': 'user-123' }
        });

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });
});
