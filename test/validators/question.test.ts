
import { describe, it, expect } from 'vitest';
import { QuestionSchema, QuestionRequestHeadersSchema } from '@/validators/question';

describe('Question Validators', () => {
    describe('QuestionSchema', () => {
        it('should validate a valid question object', () => {
            const validQuestion = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                text: 'Tell me about yourself.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const result = QuestionSchema.safeParse(validQuestion);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID', () => {
            const invalidQuestion = {
                id: 'invalid-id',
                text: 'Tell me about yourself.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const result = QuestionSchema.safeParse(invalidQuestion);
            expect(result.success).toBe(false);
        });
    });

    describe('QuestionRequestHeadersSchema', () => {
        it('should validate valid headers', () => {
            const validHeaders = {
                'x-user-id': 'some-user-hash'
            };
            const result = QuestionRequestHeadersSchema.safeParse(validHeaders);
            expect(result.success).toBe(true);
        });

        it('should reject missing user id', () => {
            const result = QuestionRequestHeadersSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});
