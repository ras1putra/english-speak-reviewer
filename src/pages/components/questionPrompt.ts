
import { html } from 'hono/html';

import type { Question } from '../../db/schemas/question';

/**
 * Properties for the QuestionPrompt component.
 */
interface QuestionPromptProps {
    /** The question/prompt object to display */
    question: Question;
}

/**
 * Renders the active question prompt with a countdown timer.
 *
 * This component is swapped into the UI via HTMX when the user starts a session.
 * It displays the prompt text and the "Get Ready" countdown visuals.
 *
 * @param props - Component properties.
 * @param props.question - The question entity to fetch.
 * @returns The rendered HTML string.
 */
export const QuestionPrompt = ({ question }: QuestionPromptProps): ReturnType<typeof html> => html`
  <section class="w-full max-w-xl mx-auto text-center space-y-6" data-question-id="${question.id}">
    <div class="inline-flex items-center gap-2 border-4 border-black bg-yellow-300 px-4 py-2 font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <i data-lucide="mic" class="w-4 h-4"></i>
        Question Prompt
    </div>
    <article class="border-4 border-black bg-white px-6 py-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
        <p class="text-2xl font-black leading-snug">${question.text}</p>
        <div class="flex flex-col items-center gap-2">
            <span id="prompt-countdown" class="text-6xl md:text-7xl font-black text-black leading-none" style="-webkit-text-stroke: 3px black; text-shadow: 4px 4px 0 #f0abfc;">
                3
            </span>
            <span class="font-black text-base md:text-lg uppercase bg-yellow-300 border-4 border-black px-4 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] tracking-[0.4em]">
                Get Ready
            </span>
        </div>
    </article>
    <p class="text-sm font-bold text-black/70">
        Tip: Speak directly into your mic, stay steady, and avoid filler words like "um" or "uh".
    </p>
  </section>
`;
