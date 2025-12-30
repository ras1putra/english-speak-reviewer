
import { describe, it, expect } from 'vitest';
import { SubmissionHeadersSchema, SubmissionSummarySchema } from '@/validators/submission';

describe('Submission Validators', () => {
    describe('SubmissionHeadersSchema', () => {
        it('should validate valid headers', () => {
            const validHeaders = {
                'x-user-id': 'valid-user-id'
            };
            const result = SubmissionHeadersSchema.safeParse(validHeaders);
            expect(result.success).toBe(true);
        });

        it('should reject missing x-user-id', () => {
            const invalidHeaders = {};
            const result = SubmissionHeadersSchema.safeParse(invalidHeaders);
            expect(result.success).toBe(false);
        });

        it('should allow empty x-user-id (route-level validation handles it)', () => {
            const headers = {
                'x-user-id': ''
            };
            const result = SubmissionHeadersSchema.safeParse(headers);
            expect(result.success).toBe(true);
        });
    });

    describe('SubmissionSummarySchema', () => {
        it('should validate a valid summary object', () => {
            const validSummary = {
                filename: 'test.wav',
                questionId: '550e8400-e29b-41d4-a716-446655440000',
                questionText: 'Test Question',
                status: 'completed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const result = SubmissionSummarySchema.safeParse(validSummary);
            expect(result.success).toBe(true);
        });

        it('should validate with nullable questionText', () => {
            const validSummary = {
                filename: 'test.wav',
                questionId: '550e8400-e29b-41d4-a716-446655440000',
                questionText: null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const result = SubmissionSummarySchema.safeParse(validSummary);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUIDs for questionId', () => {
            const invalidSummary = {
                filename: 'test.wav',
                questionId: 'not-a-uuid',
                questionText: null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const result = SubmissionSummarySchema.safeParse(invalidSummary);
            expect(result.success).toBe(false);
        });
    });
});
