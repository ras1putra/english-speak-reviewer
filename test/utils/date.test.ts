
import { describe, it, expect } from 'vitest';
import { formatDate } from '@/utils/date';

describe('formatDate', () => {
    it('should format a valid Date object correctly', () => {
        // Jan 1, 2024, 1:00 PM
        const date = new Date('2024-01-01T13:00:00');
        const result = formatDate(date);
        expect(result).toBe('Jan 1, 01:00 PM');
    });

    it('should format a valid ISO date string correctly', () => {
        const dateString = '2024-12-25T10:30:00';
        const result = formatDate(dateString);
        expect(result).toBe('Dec 25, 10:30 AM');
    });

    it('should handle different months and times', () => {
        const date = new Date('2024-07-04T23:59:00');
        const result = formatDate(date);
        expect(result).toBe('Jul 4, 11:59 PM');
    });
});
