
import { describe, it, expect } from 'vitest';
import { SubmissionDetail } from '@/pages/components/submissionDetail';

const baseProps = {
    filename: 'sample.wav',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    questionText: 'Tell me about yourself',
    errorMessage: null,
};

describe('SubmissionDetail component', () => {
    it('renders completed submission with analytics and AI feedback', () => {
        const html = SubmissionDetail({
            ...baseProps,
            status: 'completed',
            result: {
                pronunciation: {
                    overall_score: 89.6,
                    details: [
                        { is_mispronounced: true, word: 'vocabulary', start: 0, end: 1 },
                        { is_mispronounced: false, word: 'strong', start: 1, end: 2 },
                    ],
                },
                fluency: {
                    wpm: 123.4,
                    fillers: 2,
                    pauses: 4,
                },
                raw_transcript: 'vocabulary strong',
                ai_feedback: {
                    summary: 'Great pacing overall.',
                    strengths: ['Confident tone'],
                    improvements: ['Minimize fillers'],
                    grammar: ['Watch subject-verb agreement'],
                    overall_score_comment: 'Keep practicing daily.',
                },
            },
            errorMessage: null,
        });

        expect(html).toContain('Pronunciation');
        expect(html).toContain('AI Feedback');
        expect(html).toContain('Needs Improvement');
        expect(html).toContain('Download Audio');
        expect(html).toContain('data-filename="sample.wav"');
        expect(html).toContain('Confident tone');
        expect(html).toContain('Minimize fillers');
        expect(html).toContain('Watch subject-verb agreement');
        expect(html).toContain('Keep practicing daily.');
    });

    it('shows failure details when processing fails', () => {
        const html = SubmissionDetail({
            ...baseProps,
            status: 'failed',
            result: null,
            errorMessage: 'Something went wrong',
        });

        expect(html).toContain('Processing failed: Something went wrong');
    });

    it('shows pending message when still processing', () => {
        const html = SubmissionDetail({
            ...baseProps,
            status: 'processing',
            result: null,
            errorMessage: null,
        });
        expect(html).toContain('Processing still in progress...');
    });

    it('falls back to transcript text when no detailed words exist', () => {
        const transcript = 'Plain transcript output';
        const html = SubmissionDetail({
            ...baseProps,
            status: 'completed',
            result: {
                pronunciation: { overall_score: 80, details: [] },
                fluency: { wpm: 100, fillers: 0, pauses: 0 },
                transcript,
            },
            errorMessage: null,
        });
        expect(html).toContain(transcript);
    });
});
