
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
const { mockDb } = vi.hoisted(() => {
    const queryBuilder: any = {};
    // Make queryBuilder chainable
    queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
    queryBuilder.from = vi.fn().mockReturnValue(queryBuilder);
    queryBuilder.leftJoin = vi.fn().mockReturnValue(queryBuilder);
    queryBuilder.where = vi.fn().mockReturnValue(queryBuilder);
    queryBuilder.orderBy = vi.fn().mockReturnValue(queryBuilder);

    // limit returns queryBuilder but also needs to be thenable if awaited directly (for Detail/Audio)
    queryBuilder.limit = vi.fn().mockReturnValue(queryBuilder);

    // offset always ends the chain in our use case (List), so it returns a Promise
    queryBuilder.offset = vi.fn().mockResolvedValue([]);

    // insert returns queryBuilder
    queryBuilder.insert = vi.fn().mockReturnValue(queryBuilder);
    queryBuilder.values = vi.fn().mockResolvedValue(undefined);

    queryBuilder.execute = vi.fn().mockResolvedValue([]);
    queryBuilder.then = (resolve: any, reject: any) => {
        return queryBuilder.execute().then(resolve, reject);
    };

    return { mockDb: queryBuilder };
});

vi.mock('@/db', () => ({
    db: mockDb
}));

vi.mock('@/db/schemas', () => ({
    submissions: 'submissions',
    questions: 'questions'
}));

// Mock MinIO
vi.mock('@/services/minio', () => ({
    uploadFile: vi.fn(),
    getFile: vi.fn(),
    minioClient: {
        removeObject: vi.fn()
    },
    MINIO_BUCKET: 'test-bucket'
}));
import { uploadFile, getFile, minioClient } from '@/services/minio';

// Mock Queue
vi.mock('@/queue', () => ({
    addAudioJob: vi.fn()
}));
import { addAudioJob } from '@/queue';

// Mock File Type
vi.mock('file-type', () => ({
    fileTypeFromBuffer: vi.fn()
}));
import { fileTypeFromBuffer } from 'file-type';

vi.mock('@/pages/components/submissionDetail', () => ({
    SubmissionDetail: vi.fn(() => '<div>detail</div>')
}));
import { SubmissionDetail } from '@/pages/components/submissionDetail';

import submissionRoute from '@/routes/submissions';

describe('Submission Route', () => {
    let app: Hono;
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
        vi.clearAllMocks();
        app = new Hono();
        app.route('/', submissionRoute);
        // Default execution result
        mockDb.execute.mockResolvedValue([]);
        mockDb.offset.mockResolvedValue([]);
        vi.mocked(SubmissionDetail).mockImplementation(() => '<div>detail</div>');
    });

    describe('GET / (List Submissions)', () => {
        it('should return 400 if user id is missing', async () => {
            const res = await app.request('/');
            expect(res.status).toBe(400);
        });

        it('should return 200 and list of submissions', async () => {
            const mockData = [{ filename: 'f1', status: 'completed', questionText: null, createdAt: '2021-01-01' }];
            mockDb.offset.mockResolvedValueOnce(mockData);

            const res = await app.request('/', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(mockData);
        });

        it('should return HTMX list fragment', async () => {
            const mockData = [{ filename: 'f1', status: 'completed', questionText: 'Q1', createdAt: '2021-01-01' }];
            mockDb.offset.mockResolvedValueOnce(mockData);

            const res = await app.request('/', {
                headers: { 'x-user-id': 'u1', 'hx-request': 'true' }
            });
            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('Q1');
        });

        it('should return HTMX empty state if no data on page 1', async () => {
            mockDb.offset.mockResolvedValueOnce([]);

            const res = await app.request('/', {
                headers: { 'x-user-id': 'u1', 'hx-request': 'true' }
            });
            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('No Tapes Found');
        });

        it('should include load more trigger when next page exists', async () => {
            const manyRows = Array.from({ length: 6 }, (_, idx) => ({
                filename: `f${idx}`,
                status: 'completed',
                questionText: `Q${idx}`,
                createdAt: '2021-01-01'
            }));
            mockDb.offset.mockResolvedValueOnce(manyRows);

            const res = await app.request('/', {
                headers: { 'x-user-id': 'u1', 'hx-request': 'true' }
            });
            const html = await res.text();
            expect(html).toContain('Load More Tapes');
        });

        it('should return 400 if header is blank spaces', async () => {
            const res = await app.request('/', {
                headers: { 'x-user-id': '   ' }
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: 'Missing user ID' });
        });

        it('should log error and return 500 on db failure', async () => {
            mockDb.offset.mockRejectedValue(new Error('DB Fail'));
            const res = await app.request('/', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(500);
        });
    });

    describe('GET /:filename (Detail)', () => {
        it('should return 400 if user id missing', async () => {
            const res = await app.request('/sub-123');
            expect(res.status).toBe(400);
        });

        it('should return 404 if not found', async () => {
            mockDb.execute.mockResolvedValueOnce([]); // No record found by limit(1)
            const res = await app.request('/sub-123', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(404);
        });

        it('should return 200 with detail JSON', async () => {
            const mockRecord = {
                filename: 'sub-123',
                status: 'completed',
                errorMessage: null,
                questionText: null,
                result: null,
                createdAt: '2021-01-01',
                updatedAt: '2021-01-01',
                questionId: 'q1'
            };
            mockDb.execute.mockResolvedValueOnce([mockRecord]);

            const res = await app.request('/sub-123', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(mockRecord);
        });

        it('should return HTMX detail fragment', async () => {
            const mockRecord = {
                filename: 'sub-123',
                status: 'completed',
                questionText: 'Q1',
                errorMessage: null,
                result: null,
                createdAt: '2021-01-01'
            };
            mockDb.execute.mockResolvedValueOnce([mockRecord]);

            const res = await app.request('/sub-123', {
                headers: { 'x-user-id': 'u1', 'hx-request': 'true' }
            });
            expect(res.status).toBe(200);
            expect(await res.text()).toBe('<div>detail</div>');
            expect(SubmissionDetail).toHaveBeenCalledWith(expect.objectContaining({ filename: 'sub-123' }));
        });

        it('should return 400 if user id header is blank', async () => {
            const res = await app.request('/sub-123', { headers: { 'x-user-id': '   ' } });
            expect(res.status).toBe(400);
        });

        it('should return 500 if db query fails', async () => {
            mockDb.execute.mockRejectedValueOnce(new Error('fail'));
            const res = await app.request('/sub-err', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ error: 'Internal Server Error' });
        });

        it('should log render errors for HTMX detail', async () => {
            const mockRecord = {
                filename: 'sub-123',
                status: 'completed',
                questionText: 'Q1',
                errorMessage: null,
                result: null,
                createdAt: '2021-01-01'
            };
            mockDb.execute.mockResolvedValueOnce([mockRecord]);
            vi.mocked(SubmissionDetail).mockImplementationOnce(() => {
                throw new Error('render fail');
            });

            const res = await app.request('/sub-123', {
                headers: { 'x-user-id': 'u1', 'hx-request': 'true' }
            });
            expect(res.status).toBe(500);
        });
    });

    describe('GET /:filename/audio', () => {
        it('should return audio file', async () => {
            mockDb.execute.mockResolvedValueOnce([{ filename: 'test.wav' }]);
            (getFile as any).mockResolvedValue(Buffer.from('audio data'));

            const res = await app.request('/test.wav/audio', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toContain('audio/wav');
        });

        it('should return 404 if not found in db', async () => {
            mockDb.execute.mockResolvedValueOnce([]);
            const res = await app.request('/test.wav/audio', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(404);
        });

        it('should return 400 if header whitespace', async () => {
            const res = await app.request('/test.wav/audio', { headers: { 'x-user-id': '   ' } });
            expect(res.status).toBe(400);
        });

        it('should return 500 if storage fails', async () => {
            mockDb.execute.mockResolvedValueOnce([{ filename: 'test.wav' }]);
            (getFile as any).mockRejectedValueOnce(new Error('minio'));

            const res = await app.request('/test.wav/audio', { headers: { 'x-user-id': 'u1' } });
            expect(res.status).toBe(500);
        });
    });

    describe('POST / (Upload)', () => {
        it('should return 400 if no file', async () => {
            const body = new FormData();
            body.append('questionId', validUUID);
            const res = await app.request('/', {
                method: 'POST',
                body: body,
                headers: { 'x-user-id': 'u1' }
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 if user id header is missing', async () => {
            const body = new FormData();
            body.append('file', new Blob(['audio'], { type: 'audio/wav' }), 'test.wav');
            body.append('questionId', validUUID);

            const res = await app.request('/', {
                method: 'POST',
                body
            });

            expect(res.status).toBe(400);
            expect(await res.json()).toMatchObject({
                success: false,
                error: {
                    name: 'ZodError'
                }
            });
        });

        it('should return 400 if question id is invalid', async () => {
            const body = new FormData();
            body.append('file', new Blob(['audio'], { type: 'audio/wav' }), 'test.wav');
            body.append('questionId', 'not-a-uuid');

            const res = await app.request('/', {
                method: 'POST',
                body,
                headers: { 'x-user-id': 'u1' }
            });

            expect(res.status).toBe(400);
            expect(await res.json()).toMatchObject({
                success: false,
                error: {
                    name: 'ZodError'
                }
            });
        });

        it('should return 400 if invalid file type', async () => {
            const body = new FormData();
            body.append('file', new Blob(['fake'], { type: 'text/plain' }), 'test.txt');
            body.append('questionId', validUUID);

            (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'text/plain' });

            const res = await app.request('/', {
                method: 'POST',
                body: body,
                headers: { 'x-user-id': 'u1' }
            });
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: 'Invalid file type. Only audio or microphone WebM files are allowed.' });
        });

        it('should return 200 on success', async () => {
            const body = new FormData();
            body.append('file', new Blob(['audio'], { type: 'audio/wav' }), 'test.wav');
            body.append('questionId', validUUID);

            (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'audio/wav', ext: 'wav' });
            (addAudioJob as any).mockResolvedValue({ id: 'job-123' });

            const res = await app.request('/', {
                method: 'POST',
                body: body,
                headers: { 'x-user-id': 'u1' }
            });

            expect(res.status).toBe(200);
            expect(uploadFile).toHaveBeenCalled();
            expect(mockDb.insert).toHaveBeenCalled();
            expect(addAudioJob).toHaveBeenCalled();
        });

        it('should cleanup file if db insert fails', async () => {
            const body = new FormData();
            body.append('file', new Blob(['audio'], { type: 'audio/wav' }), 'test.wav');
            body.append('questionId', validUUID);

            (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'audio/wav', ext: 'wav' });

            // Upload succeeds
            (uploadFile as any).mockResolvedValue('uuid.wav');

            // DB fails
            mockDb.values.mockRejectedValueOnce(new Error('DB Fail'));

            const res = await app.request('/', {
                method: 'POST',
                body: body,
                headers: { 'x-user-id': 'u1' }
            });

            expect(res.status).toBe(500);
            expect(minioClient.removeObject).toHaveBeenCalled();
        });

        it('should handle cleanup failure gracefully', async () => {
            const body = new FormData();
            body.append('file', new Blob(['audio'], { type: 'audio/wav' }), 'test.wav');
            body.append('questionId', validUUID);

            (fileTypeFromBuffer as any).mockResolvedValue({ mime: 'audio/wav', ext: 'wav' });
            (uploadFile as any).mockResolvedValue('uuid.wav');

            // DB fails
            mockDb.values.mockRejectedValueOnce(new Error('DB Fail'));

            // Cleanup ALSO fails
            (minioClient.removeObject as any).mockRejectedValueOnce(new Error('Cleanup Fail'));

            const res = await app.request('/', {
                method: 'POST',
                body: body,
                headers: { 'x-user-id': 'u1' }
            });

            expect(res.status).toBe(500);
            // Verify it didn't crash
        });
    });
});
