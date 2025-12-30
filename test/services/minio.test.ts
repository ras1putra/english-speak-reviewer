
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as Minio from 'minio';
const loggerMock = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
}));
vi.mock('@/utils/logger', () => ({
    logger: loggerMock,
}));
import { initBucket, uploadFile, getFile, MINIO_BUCKET, setMinioClientForTesting } from '@/services/minio';

// Create a mock MinIO Client instance
const mockMinioClient = {
    bucketExists: vi.fn(),
    makeBucket: vi.fn(),
    putObject: vi.fn(),
    getObject: vi.fn(),
    removeObject: vi.fn(),
};

describe('MinIO Service', () => {
    beforeEach(() => {
        // Inject the mock client before each test
        setMinioClientForTesting(mockMinioClient as unknown as Minio.Client);

        mockMinioClient.bucketExists.mockClear();
        mockMinioClient.makeBucket.mockClear();
        mockMinioClient.putObject.mockClear();
        mockMinioClient.getObject.mockClear();
        loggerMock.info.mockClear();
        loggerMock.error.mockClear();
    });

    describe('initBucket', () => {
        it('should create bucket if it does not exist', async () => {
            mockMinioClient.bucketExists.mockResolvedValue(false);
            mockMinioClient.makeBucket.mockResolvedValue(undefined);

            await initBucket();

            expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(MINIO_BUCKET);
            expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(MINIO_BUCKET);
            expect(loggerMock.info).toHaveBeenCalledWith(`Bucket '${MINIO_BUCKET}' created successfully.`);
        });

        it('should not create bucket if it exists', async () => {
            mockMinioClient.bucketExists.mockResolvedValue(true);

            await initBucket();

            expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(MINIO_BUCKET);
            expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
            expect(loggerMock.info).not.toHaveBeenCalledWith(expect.stringContaining('created successfully.'));
        });

        it('should log error if bucket check fails', async () => {
            const error = new Error('Connection failed');
            mockMinioClient.bucketExists.mockRejectedValue(error);

            await initBucket();

            expect(mockMinioClient.bucketExists).toHaveBeenCalled();
            expect(loggerMock.error).toHaveBeenCalledWith('Error ensuring bucket exists', { error });
        });
    });

    describe('uploadFile', () => {
        it('should upload file successfully', async () => {
            mockMinioClient.putObject.mockResolvedValue({ etag: 'test-etag' });

            const buffer = Buffer.from('test data');
            const result = await uploadFile('test.wav', buffer);

            expect(result).toBe('test.wav');
            expect(mockMinioClient.putObject).toHaveBeenCalled();
        });

        it('should throw error on upload failure', async () => {
            mockMinioClient.putObject.mockRejectedValue(new Error('Upload failed'));
            const buffer = Buffer.from('test data');

            await expect(uploadFile('test.wav', buffer)).rejects.toThrow('Upload failed');
        });
    });

    describe('getFile', () => {
        it('should retrieve and concatenate file stream', async () => {
            const mockStream = new EventEmitter();
            mockMinioClient.getObject.mockResolvedValue(mockStream);

            // Start the file retrieval
            const filePromise = getFile('test.wav');

            setTimeout(() => {
                mockStream.emit('data', Buffer.from('Hello '));
                mockStream.emit('data', Buffer.from('World'));
                mockStream.emit('end');
            }, 0);

            const result = await filePromise;
            expect(result.toString()).toBe('Hello World');
        });

        it('should handle stream errors', async () => {
            const mockStream = new EventEmitter();
            mockMinioClient.getObject.mockResolvedValue(mockStream);

            const filePromise = getFile('test.wav');

            setTimeout(() => {
                mockStream.emit('error', new Error('Stream failed'));
            }, 0);

            await expect(filePromise).rejects.toThrow('Stream failed');
        });

        it('should throw error if getObject fails', async () => {
            mockMinioClient.getObject.mockRejectedValue(new Error('File not found'));

            await expect(getFile('test.wav')).rejects.toThrow('File not found');
        });
    });
});
