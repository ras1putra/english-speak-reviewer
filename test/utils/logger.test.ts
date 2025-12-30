
import { describe, it, expect } from 'vitest';
import { contextStorage, formatLogMessage } from '@/utils/logger';

describe('Logger Utilities', () => {
    describe('contextStorage', () => {
        it('should store and retrieve values within a run context', () => {
            const store = new Map<string, string>();
            store.set('requestId', '123');
            store.set('userId', 'user-456');

            contextStorage.run(store, () => {
                const currentStore = contextStorage.getStore();
                expect(currentStore).toBeDefined();
                expect(currentStore?.get('requestId')).toBe('123');
                expect(currentStore?.get('userId')).toBe('user-456');
            });
        });

        it('should return undefined outside of a run context', () => {
            const currentStore = contextStorage.getStore();
            expect(currentStore).toBeUndefined();
        });
    });

    describe('formatLogMessage', () => {
        it('should format a basic log message', () => {
            const info = {
                level: 'info',
                message: 'Test message',
                timestamp: '2024-01-01 12:00:00'
            };
            const result = formatLogMessage(info);

            expect(result).toContain('[2024-01-01 12:00:00]');
            expect(result).toContain('INFO');
            expect(result).toContain('Test message');
            expect(result).toContain('Mem:');
        });

        it('should include request and user ID from context', () => {
            const store = new Map<string, string>();
            store.set('requestId', 'req-123');
            store.set('userId', 'user-abc-longstring');

            contextStorage.run(store, () => {
                const info = {
                    level: 'debug',
                    message: 'Contextual message',
                    timestamp: '2024-01-01 12:00:00'
                };
                const result = formatLogMessage(info);

                expect(result).toContain('[Req:req-123]');
                expect(result).toContain('[User:user-abc...]');
                expect(result).toContain('Contextual message');
            });
        });

        it('should include metadata', () => {
            const info = {
                level: 'warn',
                message: 'Warning',
                timestamp: '2024-01-01 12:00:00',
                extra: 'data',
                code: 500
            };
            const result = formatLogMessage(info);

            expect(result).toContain('{"extra":"data","code":500}');
        });
        it('should handle missing metadata', () => {
            const info = {
                level: 'debug',
                message: 'No meta',
                timestamp: '2024-01-01 12:00:00'
            };
            const result = formatLogMessage(info);
            expect(result).not.toContain('{'); // No JSON object at end
        });

        it('should handle missing user in context', () => {
            const store = new Map<string, string>();
            store.set('requestId', 'req-123');
            // No user

            contextStorage.run(store, () => {
                const info = { level: 'info', message: 'msg', timestamp: 'ts' };
                const result = formatLogMessage(info);
                expect(result).toContain('[Req:req-123]');
                expect(result).not.toContain('[User:');
            });
        });
        it('should handle missing user in context', () => {
            const store = new Map<string, string>();
            store.set('requestId', 'req-123');
            // No user

            contextStorage.run(store, () => {
                const info = { level: 'info', message: 'msg', timestamp: 'ts' };
                const result = formatLogMessage(info);
                expect(result).toContain('[Req:req-123]');
                expect(result).not.toContain('[User:');
            });
        });

        it('should handle context with no request ID', () => {
            const store = new Map<string, string>();
            store.set('userId', 'u1');
            contextStorage.run(store, () => {
                const info = { level: 'info', message: 'msg', timestamp: 'ts' };
                const result = formatLogMessage(info);
                expect(result).not.toContain('[Req:');
                expect(result).toContain('[User:u1...]');
            });
        });

        it('should handle completely empty context', () => {
            const store = new Map<string, string>();
            contextStorage.run(store, () => {
                const info = { level: 'info', message: 'msg', timestamp: 'ts' };
                const result = formatLogMessage(info);
                expect(result).not.toContain('[Req:');
                expect(result).not.toContain('[User:');
            });
        });
    });
});
