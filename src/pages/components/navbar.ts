
import { html } from 'hono/html';

/**
 * Properties for the Navbar component.
 */
interface NavbarProps {
    userId?: string;
    activePath?: '/' | '/review' | '/history';
}

/**
 * The main application navigation bar.
 *
 * Displays the branding and navigation links. It adapts its state based on:
 * - `userId`: Shows/hides authentication-related elements (if any).
 * - `activePath`: Highlights the current active navigation link.
 *
 * @param props - Component properties.
 * @param props.userId - The authenticated user ID.
 * @param props.activePath - The currently active route path.
 * @returns The rendered HTML string for the navigation bar.
 */
export const Navbar = ({ userId, activePath }: NavbarProps): ReturnType<typeof html> => {
    const linkClass = (path: string, colorClass: string): string => {
        const isActive = activePath === path;
        const base = "font-black uppercase tracking-wider px-4 py-2 border-2 border-black transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2";
        const activeState = isActive
            ? `bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1 pointer-events-none`
            : `bg-white hover:${colorClass}`;

        return `${base} ${activeState}`;
    };

    const hiddenClass = userId ? '' : 'hidden';
    const ariaHidden = userId ? '' : 'aria-hidden="true"';

    return html`
    <nav data-navbar ${ariaHidden} class="sticky top-0 z-50 border-b-4 border-black bg-white px-4 py-3 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] ${hiddenClass}">
        <div class="mx-auto max-w-7xl flex flex-wrap justify-between items-center gap-4">
            <!-- Brand / Home Link -->
            <a href="/" class="flex items-center gap-2 group">
                 <div class="w-10 h-10 bg-yellow-400 border-2 border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-12 transition-transform">
                    E
                 </div>
                 <span class="font-black uppercase text-lg tracking-tighter">English Reviewer</span>
            </a>

            <!-- Navigation Links -->
             <div class="flex items-center gap-3 text-sm md:text-base">
                <a href="/" class="${linkClass('/', 'bg-yellow-200')}">
                    <i data-lucide="home" class="w-4 h-4"></i> <span class="hidden md:inline">Home</span>
                </a>
                
                <a href="/review" class="${linkClass('/review', 'bg-red-200')}">
                    <i data-lucide="mic" class="w-4 h-4"></i> <span class="hidden md:inline">Studio</span>
                </a>

                <a href="/history" class="${linkClass('/history', 'bg-cyan-200')}">
                    <i data-lucide="cassette-tape" class="w-4 h-4"></i> <span class="hidden md:inline">Archives</span>
                </a>
            </div>
        </div>
    </nav>
    `;
};
