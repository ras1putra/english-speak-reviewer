
import { describe, it, expect } from 'vitest';
import { renderPage } from '@/pages/render';
import { html } from 'hono/html';

describe('renderPage', () => {
    it('should render a complete HTML document with defaults', () => {
        const content = html`<h1>Hello World</h1>`;
        const result = renderPage(content).toString();

        expect(result).toContain('<!DOCTYPE html>');
        expect(result).toContain('<title>English Speak Reviewer</title>');
        expect(result).toContain('<h1>Hello World</h1>');
        expect(result).toContain('src="/public/app.js"');
    });

    it('should allow custom title', () => {
        const content = html`<p>Test</p>`;
        const result = renderPage(content, { title: 'Custom Title' }).toString();
        expect(result).toContain('<title>Custom Title</title>');
    });
});
