
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock postgres before import
vi.mock('postgres', () => {
    return {
        default: vi.fn(() => ({
            // Mock client properties if needed
        }))
    };
});

describe('DB Connection', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should initialize db client with connection string', async () => {
        process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

        // Import module dynamically to trigger initialization
        const { db } = await import('@/db/index');
        const postgres = (await import('postgres')).default;

        expect(db).toBeDefined();
        expect(postgres).toHaveBeenCalledWith('postgres://user:pass@localhost:5432/db');
    });

    it('should throw if DATABASE_URL is missing', async () => {
        delete process.env.DATABASE_URL;

        await expect(import('@/db/index')).rejects.toThrow('DATABASE_URL is not configured');
    });
});
