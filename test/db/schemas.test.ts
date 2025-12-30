
import { describe, it, expect } from 'vitest';
import * as schemas from '@/db/schemas';

describe('Database schema exports', () => {
    it('re-exports submission and question schemas', () => {
        expect(schemas).toHaveProperty('questions');
        expect(schemas).toHaveProperty('submissions');
        expect(schemas).toHaveProperty('schemaRegistry');
        expect(schemas.schemaRegistry.questions).toBe(schemas.questions);
        expect(schemas.schemaRegistry.submissions).toBe(schemas.submissions);
    });
});
