
/* eslint-disable max-lines-per-function, complexity */

import { formatDate } from '../../utils/date';

/**
 *
 */
interface SubmissionDetailProps {
    filename: string;
    createdAt: Date;
    status: string;
    questionText: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
    errorMessage: string | null;
}

/**
 * Renders the detailed view of a specific submission.
 *
 * This component displays:
 * - Specific scores for pronunciation, WPM, fillers, etc.
 * - AI-generated feedback (strengths, improvements, grammar).
 * - Interactive transcript with karaoke-style highlighting (if integrated with player).
 * - Audio playback controls.
 *
 * It handles both completed and processing/failed states.
 *
 * @param data - The submission data to render.
 * @returns The rendered HTML string for the submission details.
 */
export const SubmissionDetail = (data: SubmissionDetailProps): string => {

    const statusColor = data.status === 'completed' ? 'bg-green-200' :
        data.status === 'failed' ? 'bg-red-200' : 'bg-yellow-200';

    const get = (path: string, fallback: unknown = '-'): unknown => {
        const source = data.result ?? {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value = path.split('.').reduce((acc, part) => acc && (acc as any)[part], source);

        return value ?? fallback;
    };

    let content = '';

    if (data.status === 'completed' && data.result) {
        const pScore = Math.round(Number(get('pronunciation.overall_score', 0)));
        const wpm = Math.round(Number(get('fluency.wpm', 0)));
        const fillers = get('fluency.fillers', 0);
        const pauses = get('fluency.pauses', 0);
        const transcript = data.result.raw_transcript || data.result.transcript || 'No transcript generated.';

        const badWords = (get('pronunciation.details', []) as { is_mispronounced: boolean; word: string }[])
            .filter((w) => w.is_mispronounced)
            .map((w) => w.word);

        const aiFeedback = data.result.ai_feedback || null;
        const aiSummary = aiFeedback?.summary || 'AI feedback not available for this submission.';
        const aiStrengths = Array.isArray(aiFeedback?.strengths) ? aiFeedback.strengths : [];
        const aiImprovements = Array.isArray(aiFeedback?.improvements) ? aiFeedback.improvements : [];
        const aiGrammar = Array.isArray(aiFeedback?.grammar) ? aiFeedback.grammar : [];
        const aiClosing = aiFeedback?.overall_score_comment || '';

        content = `
            <!-- Scores -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="border-4 border-black bg-purple-50 p-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-purple-200 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                    <p class="relative font-black uppercase text-[10px] md:text-xs text-black/60 mb-1">Pronunciation</p>
                    <div class="relative flex items-baseline gap-1">
                        <span class="text-3xl md:text-5xl font-black tracking-tighter" id="score-pronunciation">${pScore}</span>
                        <span class="text-lg md:text-xl font-bold text-black/40">/100</span>
                    </div>
                </div>
                
                <div class="border-4 border-black bg-blue-50 p-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                     <div class="absolute -right-4 -top-4 w-24 h-24 bg-blue-200 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                    <p class="relative font-black uppercase text-[10px] md:text-xs text-black/60 mb-1">Speaking Rate</p>
                    <div class="relative flex items-baseline gap-1">
                        <span class="text-3xl md:text-5xl font-black tracking-tighter" id="score-wpm">${wpm}</span>
                        <span class="text-lg md:text-xl font-bold text-black/40">WPM</span>
                    </div>
                </div>

                <div class="border-4 border-black bg-pink-50 p-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                     <div class="absolute -right-4 -top-4 w-24 h-24 bg-pink-200 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                    <p class="relative font-black uppercase text-[10px] md:text-xs text-black/60 mb-1">Fillers</p>
                    <div class="relative flex items-baseline gap-1">
                        <span class="text-3xl md:text-5xl font-black tracking-tighter" id="score-fillers">${fillers}</span>
                        <span class="text-lg md:text-xl font-bold text-black/40">Count</span>
                    </div>
                </div>

                <div class="border-4 border-black bg-green-50 p-4 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                     <div class="absolute -right-4 -top-4 w-24 h-24 bg-green-200 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                    <p class="relative font-black uppercase text-[10px] md:text-xs text-black/60 mb-1">Pausess</p>
                    <div class="relative flex items-baseline gap-1">
                        <span class="text-3xl md:text-5xl font-black tracking-tighter" id="score-fillers">${pauses}</span>
                        <span class="text-lg md:text-xl font-bold text-black/40">Count</span>
                    </div>
                </div>
            </div>

            ${aiFeedback ? `
            <!-- AI Feedback -->
            <div class="border-4 border-black bg-yellow-50 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <h3 class="font-black uppercase text-base md:text-lg mb-4 flex items-center gap-2">
                    <i data-lucide="stars" class="w-5 h-5"></i> AI Feedback
                </h3>
                <p class="text-sm md:text-lg leading-relaxed">${aiSummary}</p>

                ${aiStrengths.length ? `
                <div>
                    <p class="text-xs md:text-sm font-bold uppercase text-green-700 mb-2">Strengths</p>
                    <ul class="list-disc pl-6 space-y-1 text-sm md:text-base">
                        ${aiStrengths.map((item: string) => `<li>${item}</li>`).join('')}
                    </ul>
                </div>` : ''}

                ${aiImprovements.length ? `
                <div>
                    <p class="text-xs md:text-sm font-bold uppercase text-orange-600 mb-2">Improvements</p>
                    <ul class="list-disc pl-6 space-y-1 text-sm md:text-base">
                        ${aiImprovements.map((item: string) => `<li>${item}</li>`).join('')}
                    </ul>
                </div>` : ''}

                ${aiGrammar.length ? `
                <div>
                    <p class="text-xs md:text-sm font-bold uppercase text-blue-700 mb-2">Grammar Notes</p>
                    <ul class="list-disc pl-6 space-y-1 text-sm md:text-base">
                        ${aiGrammar.map((item: string) => `<li>${item}</li>`).join('')}
                    </ul>
                </div>` : ''}

                ${aiClosing ? `<p class="font-semibold text-black">${aiClosing}</p>` : ''}
            </div>
            ` : ''}

            <!-- Transcript -->
            <div class="border-4 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 class="font-black uppercase text-base md:text-lg mb-4 flex items-center gap-2">
                    <i data-lucide="file-text" class="w-5 h-5"></i> Transcript Analysis
                </h3>
                <div id="detail-transcript" class="font-mono text-sm md:text-lg leading-relaxed whitespace-pre-wrap">${(() => {
                const details = get('pronunciation.details', []) as { is_mispronounced: boolean; word: string; start: number; end: number }[];

                if (details && details.length > 0) {
                    return details.map((w) => {
                        const isMis = w.is_mispronounced;
                        const classes = `transcript-word transition-all duration-100 relative px-0.5 cursor-pointer hover:bg-neutral-200 ${isMis ? 'text-red-500 decoration-red-500 underline decoration-2 underline-offset-2' : ''}`;

                        return `<span class="${classes}" data-start="${w.start}" data-end="${w.end}">${w.word}</span>`;
                    }).join(' ');
                }

                return transcript;
            })()}
                </div>
                
                ${badWords.length > 0 ? `
                <div id="mispronounced-section" class="mt-6">
                     <p class="text-sm font-bold text-red-600 uppercase mb-2">Needs Improvement:</p>
                     <div id="detail-mispronounced-list" class="flex flex-wrap gap-2">
                        ${badWords.map((w: string) => `<span class="px-2 py-1 bg-red-100 border border-red-400 text-red-700 text-xs font-bold uppercase">${w}</span>`).join('')}
                     </div>
                </div>
                ` : ''}
            </div>
            
            <!-- Audio Player -->
            <div class="border-4 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" id="audio-player-container" data-filename="${data.filename}">
              <h3 class="font-black uppercase text-base md:text-lg mb-4 flex items-center gap-2">
                <i data-lucide="volume-2" class="w-6 h-6"></i> Audio Player
              </h3>

              <!-- Progress Bar -->
              <div class="mb-4">
                <div class="flex items-center justify-between text-xs font-bold mb-2">
                  <span id="time-current">0:00</span>
                  <span id="time-total">0:00</span>
                </div>
                <div id="progress-container" class="h-3 bg-neutral-200 border-2 border-black overflow-hidden cursor-pointer">
                  <div id="progress-bar" class="h-full bg-black transition-all duration-100" style="width: 0%"></div>
                </div>
              </div>

              <!-- Controls -->
              <div class="flex flex-wrap items-center gap-3">
                <button id="btn-play" class="w-12 h-12 border-2 border-black bg-green-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:shadow-none active:translate-y-1 active:shadow-none transition-all flex items-center justify-center text-xl">
                  <i data-lucide="play" class="w-6 h-6 fill-black"></i>
                </button>
                <button id="btn-pause" class="w-12 h-12 border-2 border-black bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:shadow-none active:translate-y-1 active:shadow-none transition-all flex items-center justify-center text-xl">
                  <i data-lucide="pause" class="w-6 h-6 fill-black"></i>
                </button>
                <button id="btn-stop" class="w-12 h-12 border-2 border-black bg-red-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:shadow-none active:translate-y-1 active:shadow-none transition-all flex items-center justify-center text-xl">
                  <i data-lucide="square" class="w-5 h-5 fill-black"></i>
                </button>
                
                <div class="flex-1 flex items-center gap-2 ml-4">
                  <span class="text-xs font-bold uppercase">Vol</span>
                  <input type="range" id="volume-slider" min="0" max="100" value="80" 
                         class="flex-1 h-2 appearance-none bg-neutral-200 border-2 border-black cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black 
                                [&::-webkit-slider-thumb]:cursor-pointer 
                                [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 
                                [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-black 
                                [&::-moz-range-thumb]:cursor-pointer">
                  <span id="volume-display" class="text-xs font-bold w-8">80%</span>
                </div>
              </div>

              <!-- Hidden audio element -->
              <audio id="detail-audio" class="hidden"></audio>
            </div>
        `;
    } else {
        content = `
            <div class="border-4 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 class="font-black uppercase text-lg mb-4">Status Update</h3>
                 <div id="detail-transcript" class="font-mono text-lg leading-relaxed whitespace-pre-wrap">
                    ${data.status === 'failed' ? `Processing failed: ${data.errorMessage || 'Unknown error'}` : 'Processing still in progress...'}
                 </div>
            </div>
        `;
    }

    return `
        <div class="space-y-8 animate-fade-in" data-submission-root data-filename="${data.filename}" data-status="${data.status}">
            <!-- Header -->
            <div class="flex flex-col md:flex-row justify-between md:items-start gap-4 border-b-4 border-black pb-6">
                <div class="space-y-2">
                    <div class="inline-block px-2 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest mb-1">
                        ${formatDate(data.createdAt)}
                    </div>
                    <h2 class="text-xl md:text-3xl font-black uppercase leading-none">
                        ${data.questionText || 'Unknown Prompt'}
                    </h2>
                </div>
                <div class="flex flex-col items-end gap-2 shrink-0">
                     <span class="px-3 py-1 border-2 font-black uppercase text-xs ${statusColor}">
                        ${data.status}
                     </span>
                     ${data.status === 'completed' ? `
                     <a href="/api/submissions/${data.filename}/audio" download="${data.filename}" class="flex items-center gap-2 border-2 border-black bg-cyan-200 px-4 py-2 font-bold uppercase text-sm hover:bg-cyan-300 transition-colors cursor-pointer animate-pop">
                        <i data-lucide="download" class="w-4 h-4"></i> Download Audio
                     </a>
                     ` : ''}
                </div>
            </div>

            ${content}
        </div>
    `;
};
