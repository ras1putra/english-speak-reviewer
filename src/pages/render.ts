
import { html } from 'hono/html'

/**
 * Configuration options for rendering the page.
 */
interface RenderOptions {
    title?: string;
}

/**
 * Renders the full HTML document structure.
 *
 * This function wraps the page content in a standard HTML5 template, including:
 * - Meta tags for SEO (Open Graph, Twitter Cards).
 * - Stylesheets and scripts (HTMX, Lucide Icons, Application logic).
 * - `hx-boost` enabled on the body for SPA-like navigation.
 *
 * @param children - The page content to render inside the body.
 * @param options - Configuration options for the rendered page.
 * @param options.title - The title tag value.
 * @returns The complete HTML string.
 */
export const renderPage = (children: unknown, options?: RenderOptions): ReturnType<typeof html> => {
    const { title = 'English Speak Reviewer' } = options ?? {};

    return html`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="Practice interview answers aloud and get instant AI scoring on pronunciation, pacing, filler words, pauses, and delivery confidence." />
    <meta name="keywords" content="english speaking practice, interview preparation, pronunciation scoring, pacing feedback, filler words detection, AI speech feedback" />
    <meta name="author" content="English Speak Reviewer" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://english-speak-reviewer.app/" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://english-speak-reviewer.app/" />
    <meta property="og:title" content="English Speak Reviewer" />
    <meta property="og:description" content="Record answers, get instant scoring on pronunciation, pause length, speech rate, and filler words before your next interview." />
    <meta property="og:site_name" content="English Speak Reviewer" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="English Speak Reviewer" />
    <meta name="twitter:description" content="Microphone-first practice that grades pronunciation, pacing, filler words, pauses, and confidence with AI feedback." />
    <meta name="theme-color" content="#0f172a" />
    <link rel="stylesheet" href="/styles.css">
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script src="https://unpkg.com/htmx.org/dist/ext/json-enc.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js" defer></script>
    <script src="/public/app.js" defer></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            lucide.createIcons();
        });
        document.addEventListener('htmx:afterSwap', () => {
            lucide.createIcons();
        });
    </script>
</head>
<body hx-boost="true">
    ${children}
</body>
</html>`;
};
