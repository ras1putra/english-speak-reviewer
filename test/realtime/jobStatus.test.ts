
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEmitter, triggerMessage, triggerError } = vi.hoisted(() => {
    let messageHandler: Function | null = null;
    let errorHandler: Function | null = null;
    const emitter: any = {
        subscribe: vi.fn(),
        on: vi.fn((event, cb) => {
            if (event === 'message') messageHandler = cb;
            if (event === 'error') errorHandler = cb;
        }),
        removeAllListeners: vi.fn(() => { messageHandler = null; }),
        disconnect: vi.fn()
    };
    return {
        mockEmitter: emitter,
        triggerMessage: (channel: string, msg: string) => {
            if (messageHandler) messageHandler(channel, msg);
        },
        triggerError: (err: Error) => {
            if (errorHandler) errorHandler(err);
        }
    };
});

vi.mock('@/services/redis', () => ({
    createRedisConnection: () => mockEmitter
}));

// Mock Logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));
import { logger } from '@/utils/logger';

import { JobStatusHub } from '@/realtime/jobStatus';

describe('JobStatusHub', () => {
    let hub: JobStatusHub;

    beforeEach(() => {
        vi.clearAllMocks();
        mockEmitter.removeAllListeners();
        (mockEmitter as any).subscribe.mockClear();
        // Re-instantiate
        hub = new JobStatusHub();
    });

    it('should subscribe to redis channel on init', () => {
        expect((mockEmitter as any).subscribe).toHaveBeenCalledWith('job_status', expect.any(Function));
    });

    it('logs redis subscriber errors', () => {
        const error = new Error('redis fail');
        triggerError(error);
        expect(logger.error).toHaveBeenCalledWith('Redis subscriber error', { error });
    });

    it('should log error if subscription fails', () => {
        const callback = (mockEmitter as any).subscribe.mock.calls[0][1];
        callback(new Error('Sub fail'));
        expect(logger.error).toHaveBeenCalledWith('Failed to subscribe to job status channel', expect.any(Object));
    });

    it('logs info when subscription succeeds', () => {
        const callback = (mockEmitter as any).subscribe.mock.calls[0][1];
        callback(null);
        expect(logger.info).toHaveBeenCalledWith('Subscribed to job status channel', { channel: 'job_status' });
    });

    it('should warn on invalid json payload', () => {
        triggerMessage('job_status', 'invalid-json');
        expect(logger.warn).toHaveBeenCalledWith('Failed to parse job status payload', expect.any(Object));
    });

    it('should add task subscriber', () => {
        const socket = { close: vi.fn() } as any;
        hub.addSubscriber('task-1', 'user-1', socket);
    });

    it('should close socket if user id missing', () => {
        const socket = { close: vi.fn() } as any;
        hub.addSubscriber('t1', '', socket);
        expect(socket.close).toHaveBeenCalledWith(1008, 'Missing user id');
    });

    it('should broadcast message to task subscriber', () => {
        const socket = { send: vi.fn(), readyState: 1 } as any;
        hub.addSubscriber('task-1', 'user-1', socket);

        const payload = JSON.stringify({ taskId: 'task-1', userId: 'user-1', status: 'done' });
        triggerMessage('job_status', payload);

        expect(socket.send).toHaveBeenCalledWith(payload);
    });

    it('should broadcast message to user subscriber', () => {
        const socket = { send: vi.fn(), readyState: 1 } as any;
        hub.addSubscriber('all', 'user-1', socket);

        const payload = JSON.stringify({ taskId: 'task-random', userId: 'user-1', status: 'done' });
        triggerMessage('job_status', payload);

        expect(socket.send).toHaveBeenCalledWith(payload);
    });

    it('should not send if user id mismatch', () => {
        const socket = { send: vi.fn(), readyState: 1 } as any;
        hub.addSubscriber('task-1', 'user-1', socket);

        const payload = JSON.stringify({ taskId: 'task-1', userId: 'user-2' });
        triggerMessage('job_status', payload);

        expect(socket.send).not.toHaveBeenCalled();
    });

    it('should remove socket if closed/failed', () => {
        const socket = { send: vi.fn().mockImplementation(() => { throw new Error('Fail'); }), readyState: 1 } as any;
        hub.addSubscriber('task-1', 'user-1', socket);

        const payload = JSON.stringify({ taskId: 'task-1', userId: 'user-1' });
        triggerMessage('job_status', payload);

        expect(logger.warn).toHaveBeenCalledWith('Failed to send status payload', expect.any(Object));

        vi.clearAllMocks();
        triggerMessage('job_status', payload);
        expect(socket.send).not.toHaveBeenCalled();
    });

    it('should prevent duplicate delivery to same socket', () => {
        const socket = { send: vi.fn(), readyState: 1 } as any;
        hub.addSubscriber('task-1', 'user-1', socket);
        // Add same socket again (different scope?)
        // If we subscribe same socket to task AND user, it should only receive once.
        hub.addSubscriber('all', 'user-1', socket);

        const payload = JSON.stringify({ taskId: 'task-1', userId: 'user-1', status: 'done' });
        triggerMessage('job_status', payload);

        expect(socket.send).toHaveBeenCalledTimes(1);
    });

    it('should skip closed sockets', () => {
        const socket = { send: vi.fn(), readyState: 2 } as any; // Not OPEN
        hub.addSubscriber('task-1', 'user-1', socket);

        const payload = JSON.stringify({ taskId: 'task-1', userId: 'user-1' });
        triggerMessage('job_status', payload);

        expect(socket.send).not.toHaveBeenCalled();
    });

    it('removes user scoped sockets when disconnected', () => {
        const socket = { send: vi.fn(), readyState: 1 } as any;
        hub.addSubscriber('all', 'user-1', socket);
        hub.removeSocket(socket);

        expect((hub as any).userSubscribers.size).toBe(0);
    });

    it('skips sockets that lost metadata', () => {
        const socket = { send: vi.fn(), readyState: 1 } as any;
        hub.addSubscriber('task-1', 'user-1', socket);
        (hub as any).socketMeta.delete(socket);

        const payload = JSON.stringify({ taskId: 'task-1', userId: 'user-1' });
        triggerMessage('job_status', payload);

        expect(socket.send).not.toHaveBeenCalled();
    });

    it('ignores removeSocket calls for unknown sockets', () => {
        expect(() => hub.removeSocket({} as any)).not.toThrow();
    });
});
