
import { describe, it, expect } from 'vitest';
import HomePage from '@/pages/home';
import ReviewPage from '@/pages/review';
import HistoryPage from '@/pages/history';

describe('Pages Rendering', () => {
    describe('HomePage', () => {
        it('should render main title and start button', () => {
            const html = HomePage({ userId: 'user-123' }).toString();
            expect(html).toContain('English');
            expect(html).toContain('Reviewer');
            expect(html).toContain('Start Practicing');
        });

        it('should render login prompt if no user', () => {
            const html = HomePage({}).toString();
            expect(html).toContain('Please Enter Email'); // LoginPrompt content
        });

        it('should NOT render login prompt if user is present', () => {
            const html = HomePage({ userId: '123' }).toString();
            expect(html).not.toContain('Please Enter Email');
        });
    });

    describe('ReviewPage', () => {
        it('should render recording studio interface', () => {
            const html = ReviewPage({ userId: 'user-123' }).toString();
            expect(html).toContain('Recording Studio');
            expect(html).toContain('Press to Record');
        });

        it('should render login prompt if no user', () => {
            const html = ReviewPage({}).toString();
            expect(html).toContain('Please Enter Email');
        });
    });

    describe('HistoryPage', () => {
        it('should render tapes list container', () => {
            const html = HistoryPage({ userId: 'user-123' }).toString();
            expect(html).toContain('Tapes');
            // Check for initial loading state or container
            expect(html).toContain('id="history-container"');
        });

        it('should render login prompt if no user', () => {
            const html = HistoryPage({}).toString();
            expect(html).toContain('Please Enter Email');
        });
    });
});
