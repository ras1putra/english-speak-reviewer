
import type { OpenAPIHono } from '@hono/zod-openapi';
import { type Context } from 'hono';
import { getCookie } from 'hono/cookie';

import HistoryPage from '../pages/history';
import HomePage from '../pages/home';
import { renderPage } from '../pages/render';
import ReviewPage from '../pages/review';

/**
 * Typed handler for serving UI pages.
 */
type PageHandler = (c: Context) => Response | Promise<Response>;

/**
 * Functional component type for top-level pages.
 */
type PageComponent = (params: { userId?: string }) => ReturnType<typeof HomePage>;

const createPageHandler = (component: PageComponent): PageHandler => (c) => {
    const userId = getCookie(c, 'english-speak-reviewer-id');
    const html = renderPage(component({ userId }));

    return c.html(html);
};

const handleHealth: PageHandler = (c) => c.json({
    name: 'English Speak Reviewer API',
    status: 'ok',
});

export const registerPageRoutes = (app: OpenAPIHono): void => {
    app.get('/', createPageHandler(HomePage));
    app.get('/review', createPageHandler(ReviewPage));
    app.get('/history', createPageHandler(HistoryPage));
    app.get('/health', handleHealth);
};
