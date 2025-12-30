
import { html } from 'hono/html';

import { Navbar } from './navbar';

/**
 * Allowed route paths for active state highlighting.
 */
type ActivePath = '/' | '/review' | '/history';

/**
 * Properties for the PageLayout component.
 */
interface PageLayoutProps {
    children: unknown;
    userId?: string;
    activePath: ActivePath;
    containerClass?: string;
    customStyles?: string;
}

/**
 * A shared layout HOC (Higher-Order Component) that wraps page content.
 *
 * It provides:
 * - A consistent styled container.
 * - The top navigation bar (`Navbar`).
 * - Global CSS styles and background patterns.
 * - Base HTML structure (implicit in Hono's `html` template usage).
 *
 * @param props - Component properties.
 * @param props.children - The main content to render inside the layout.
 * @param props.userId - The authenticated user ID, passed down to the Navbar.
 * @param props.activePath - The current route path, used for highlighting navigation links.
 * @param props.containerClass - Optional CSS classes for the main content container.
 * @param props.customStyles - Optional CSS string to inject into the page head.
 * @returns The rendered HTML string with the layout applied.
 */
export const PageLayout = ({
    children,
    userId,
    activePath,
    containerClass = 'relative mx-auto max-w-5xl px-4 py-12',
    customStyles = '',
}: PageLayoutProps): ReturnType<typeof html> => {
    const baseStyles = `
        .bg-pattern {
            background-color: #bbf7d0;
            background-image:
                linear-gradient(to right, rgba(0, 0, 0, 0.15) 2px, transparent 2px),
                linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 2px, transparent 2px);
            background-size: 24px 24px;
        }
    `;

    const mergedStyles = [baseStyles.trim(), customStyles.trim()].filter(Boolean).join('\n');

    return html`
        <style>
            ${mergedStyles}
        </style>
        <div class="min-h-screen bg-pattern font-mono text-black relative">
            ${Navbar({ userId, activePath })}
            <div class="${containerClass}">
                ${children}
            </div>
        </div>
    `;
};
