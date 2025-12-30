
import { html } from 'hono/html';

/**
 * Properties for the LoginPrompt component.
 */
export interface LoginPromptProps {
  /** Optional error message to display if validation failed. */
  error?: string;
}

/**
 * Renders a modal prompt to capture the user's email address.
 *
 * This simple authentication mechanism stores the email in LocalStorage
 * to track the user's history and submissions across sessions.
 *
 * @param props - Component properties.
 * @param props.error - An optional error message to show initially.
 * @returns The rendered HTML string for the login modal.
 */
export const LoginPrompt = ({ error }: LoginPromptProps = {}): ReturnType<typeof html> => html`
    <div id="login-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-pop">
      <div class="w-full max-w-md border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div class="mb-8 text-center">
            <div class="mx-auto mb-4 flex h-20 w-20 items-center justify-center border-4 border-black bg-pink-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-bounce">
            <svg class="h-10 w-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 class="text-4xl font-black uppercase tracking-tighter">Please Enter Email</h2>
          <p class="mt-2 font-bold text-black text-sm uppercase tracking-widest border-b-2 border-black inline-block">We use it to track progress</p>
        </div>
        
        <div id="login-form" class="space-y-6" role="form" aria-label="Email collection form">
          <div>
            <label for="email" class="mb-2 block font-black uppercase text-sm">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="YOUR@EMAIL.COM"
              class="w-full border-4 border-black bg-yellow-100 px-4 py-4 font-bold text-black placeholder:text-black/40 focus:bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              required
            />
            <p id="login-error" class="mt-2 flex items-center gap-1 text-sm font-bold text-red-600 bg-red-100 border-2 border-red-600 p-2 ${error ? '' : 'hidden'}">
              <i data-lucide="alert-triangle" class="w-4 h-4"></i>
              <span id="login-error-text">${error || ''}</span>
            </p>
          </div>
          
          <button
            id="login-submit"
            type="button"
            class="group w-full cursor-pointer border-4 border-black bg-cyan-400 py-4 font-black uppercase tracking-widest text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed animate-shake"
          >
            <span class="group-[.htmx-request]:hidden flex items-center justify-center gap-2">
                Save Email
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </span>
            <span class="hidden group-[.htmx-request]:flex items-center justify-center gap-2">
                Processing...
            </span>
          </button>
        </div>
        
        <p class="mt-6 text-center text-xs font-bold uppercase tracking-widest text-black/60">
          This email is stored locally. No marketing, just practice tracking.
        </p>
      </div>
    </div>
`;
