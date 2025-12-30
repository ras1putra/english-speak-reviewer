
import { describe, it, expect } from 'vitest';
import { SubmissionListItem } from '@/pages/components/submissionListItem';

const baseItem = {
    filename: 'abc.wav',
    createdAt: new Date('2024-02-02T00:00:00Z'),
    questionText: 'Prompt',
};

describe('SubmissionListItem component', () => {
    it('renders completed submissions with call-to-action', () => {
        const html = SubmissionListItem({
            ...baseItem,
            status: 'completed',
        });
        expect(html).toContain('View Report');
        expect(html).toContain('bg-green-400');
        expect(html).toContain('hx-get="/api/submissions/abc.wav"');
    });

    it('highlights failed submissions', () => {
        const html = SubmissionListItem({
            ...baseItem,
            status: 'failed',
        });
        expect(html).toContain('bg-red-400');
        expect(html).not.toContain('View Report');
    });

    it('defaults to pending styling for other statuses', () => {
        const html = SubmissionListItem({
            ...baseItem,
            status: 'processing',
        });
        expect(html).toContain('bg-yellow-300');
    });
});
