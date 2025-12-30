
/* eslint-disable max-lines-per-function */

import { html } from 'hono/html'

import { LoginPrompt } from './components/loginPrompt';
import { PageLayout } from './components/pageLayout';

const reviewPageStyles = `
    @keyframes progress { from { width: 0%; } to { width: 100%; } }
    @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
    @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes pop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .animate-progress { animation: progress linear forwards; }
    .animate-pulse-red { animation: pulse-red 2s infinite; }
    .animate-fade-in { animation: fade-in 0.3s ease-out; }
    .animate-pop { animation: pop 0.2s ease-out; }
    .animate-spin-slow { animation: spin-slow 10s linear infinite; }
`;

/**
 * Properties for the ReviewPage component.
 */
interface ReviewPageProps {
    userId?: string;
}

/**
 * Renders the Review Page (Recording Studio).
 *
 * This is the core interactive page where users:
 * 1. Select a recording duration (15s/30s).
 * 2. Receive a random question/prompt.
 * 3. Record their audio response via the browser microphone.
 * 4. Submit the audio for AI analysis.
 *
 * It uses a complex client-side state machine (handled via vanilla JS/HTMX) to manage
 * transitions between idle, countdown, recording, uploading, and processing states.
 *
 * @param props - Component properties.
 * @param props.userId - The ID of the currently authenticated user (optional).
 * @returns The rendered HTML string for the review studio interface.
 */
export default function ReviewPage({ userId }: ReviewPageProps): ReturnType<typeof html> {
    return PageLayout({
        userId,
        activePath: '/review',
        containerClass: 'relative mx-auto max-w-4xl px-4 py-8',
        customStyles: reviewPageStyles,
        children: html`
      ${!userId ? LoginPrompt({}) : ''}

      <div id="review-container" class="space-y-8" hx-ext="json-enc">
        <!-- Header -->
        <header class="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center">
             <div class="flex items-center gap-4">
               <span class="font-black uppercase tracking-widest text-xl">Recording Studio</span>
            </div>
             <div id="on-air-sign" class="border-4 border-black px-4 py-1 font-black bg-neutral-200 text-neutral-400 transition-colors uppercase tracking-widest">
                On Air
            </div>
        </header>

        <!-- Main Studio Dashboard -->
        <main class="relative border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[500px] flex flex-col">
            
            <!-- Top Control Strip (Static) -->
            <div class="mb-8 flex justify-between items-start border-b-4 border-black pb-6 gap-4 overflow-visible">
                <div class="flex gap-4">
                    <div class="flex flex-col items-center">
                        <div class="w-12 h-12 rounded-full border-4 border-black bg-neutral-200 relative transform rotate-45">
                            <div class="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-black"></div>
                        </div>
                        <span class="text-xs font-bold mt-1 uppercase">Gain</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-12 h-12 rounded-full border-4 border-black bg-neutral-200 relative transform -rotate-12">
                            <div class="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-black"></div>
                        </div>
                        <span class="text-xs font-bold mt-1 uppercase">Freq</span>
                    </div>
                </div>
                <div class="hidden sm:block rotate-3 border-2 border-black bg-yellow-300 px-2 py-1 text-sm font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative z-10">
                    Do Not Touch
                </div>
            </div>

            <!-- Central Screen Area (HTMX Target) -->
            <div id="central-screen" class="flex-1 flex flex-col items-center justify-center relative">
                
                <!-- Initial State: Start Controls -->
                <div id="controls-area" class="space-y-8 w-full max-w-md mx-auto relative z-10 transition-all">
                    <div class="space-y-3 text-center">
                        <div>
                            <p class="font-black uppercase text-sm tracking-widest">Answer Duration</p>
                            <p class="text-xs font-bold text-black/60">We record for the time you choose</p>
                        </div>
                        <div class="flex justify-center gap-6">
                            <label class="cursor-pointer group">
                                <input type="radio" name="duration" value="15" class="peer sr-only" checked onchange="window.setDuration && window.setDuration(15)">
                                <div class="border-4 border-black bg-white px-4 py-2 font-black text-lg transition-all peer-checked:bg-pink-400 peer-checked:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] peer-checked:-translate-y-1 group-hover:-rotate-2">
                                    15 sec · quick reps
                                </div>
                            </label>
                            <label class="cursor-pointer group">
                                <input type="radio" name="duration" value="30" class="peer sr-only" onchange="window.setDuration && window.setDuration(30)">
                                <div class="border-4 border-black bg-white px-4 py-2 font-black text-lg transition-all peer-checked:bg-pink-400 peer-checked:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] peer-checked:-translate-y-1 group-hover:rotate-2">
                                    30 sec · full answer
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- The Start Button acting as HTMX Trigger -->
                    <div class="relative group flex justify-center py-4">
                         <button id="start-btn" 
                                 hx-get="/api/questions/random" 
                                 hx-target="#central-screen" 
                                 hx-swap="innerHTML"
                                 hx-trigger="confirmed"
                                 onclick="window.checkPermissionAndTrigger && window.checkPermissionAndTrigger(this)"
                                 class="relative z-10 w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-black bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none cursor-pointer">
                            <div class="uppercase font-black text-white text-xl md:text-2xl tracking-widest pointer-events-none">Rec</div>
                         </button>
                         <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-56 md:h-56 bg-neutral-200 rounded-full border-4 border-black -z-10 flex items-center justify-center">
                            <div class="w-full h-full rounded-full border-2 border-dashed border-black/30 animate-spin-slow"></div>
                         </div>
                    </div>
                    <p class="font-bold text-black/60 uppercase tracking-widest text-center">Press to Record</p>
                </div>

            </div>
            
             <!-- Bottom Stickers -->
            <div class="mt-8 flex justify-between items-end border-t-4 border-black pt-6 overflow-visible">
                <div class="rotate-2 border-2 border-black bg-cyan-400 px-3 py-1 text-sm font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative z-10">
                    Stereo
                </div>
                 <div class="-rotate-1 border-2 border-black bg-lime-400 px-3 py-1 text-sm font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative z-10">
                    QC Passed
                </div>
            </div>
        </main>



      <!-- Persistent Overlays (Hidden) -->
      
      <!-- Controls Template for Restoration -->
      <div id="controls-template" class="hidden">
            <div class="space-y-8 w-full max-w-md mx-auto relative z-10 transition-all">
                    <div class="space-y-3 text-center">
                        <div>
                            <p class="font-black uppercase text-sm tracking-widest">Answer Duration</p>
                            <p class="text-xs font-bold text-black/60">We record for the time you choose</p>
                        </div>
                        <div class="flex justify-center gap-6">
                            <label class="cursor-pointer group">
                                <input type="radio" name="duration" value="15" class="peer sr-only" checked onchange="window.setDuration && window.setDuration(15)">
                                <div class="border-4 border-black bg-white px-4 py-2 font-black text-lg transition-all peer-checked:bg-pink-400 peer-checked:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] peer-checked:-translate-y-1 group-hover:-rotate-2">
                                    15 sec · quick reps
                                </div>
                            </label>
                            <label class="cursor-pointer group">
                                <input type="radio" name="duration" value="30" class="peer sr-only" onchange="window.setDuration && window.setDuration(30)">
                                <div class="border-4 border-black bg-white px-4 py-2 font-black text-lg transition-all peer-checked:bg-pink-400 peer-checked:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] peer-checked:-translate-y-1 group-hover:rotate-2">
                                    30 sec · full answer
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="relative group flex justify-center py-4">
                         <button id="start-btn" 
                                 hx-get="/api/questions/random" 
                                 hx-target="#central-screen" 
                                 hx-swap="innerHTML"
                                 hx-trigger="confirmed"
                                 onclick="window.checkPermissionAndTrigger && window.checkPermissionAndTrigger(this)"
                                 class="relative z-10 w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-black bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-none cursor-pointer">
                            <div class="uppercase font-black text-white text-xl md:text-2xl tracking-widest pointer-events-none">Rec</div>
                         </button>
                         <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-56 md:h-56 bg-neutral-200 rounded-full border-4 border-black -z-10 flex items-center justify-center">
                            <div class="w-full h-full rounded-full border-2 border-dashed border-black/30 animate-spin-slow"></div>
                         </div>
                    </div>
                    <p class="font-bold text-black/60 uppercase tracking-widest text-center">Press to Record</p>
                </div>
      </div>
      
      <!-- Recording State Overlay -->
      <div id="recording-ui-template" class="hidden">
           <div class="w-full max-w-lg mx-auto space-y-4 animate-fade-in">
                 <div class="bg-black/5 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                     <div class="flex justify-between items-center mb-2 font-black uppercase text-sm">
                         <div class="flex items-center gap-2 text-red-600 animate-pulse">
                             <div class="w-3 h-3 bg-red-600 rounded-full"></div>
                             Recording
                         </div>
                         <span>Input A</span>
                     </div>
                     <div class="h-8 w-full border-4 border-black bg-white relative overflow-hidden">
                         <div id="progress-bar" class="h-full bg-red-500 w-0 border-r-4 border-black animate-progress"></div>
                         <div class="absolute inset-0 flex justify-between px-2">
                            <div class="h-full w-0.5 bg-black/10"></div>
                            <div class="h-full w-0.5 bg-black/10"></div>
                            <div class="h-full w-0.5 bg-black/10"></div>
                         </div>
                     </div>
                 </div>
            </div>
      </div>
      
       <!-- Uploading State Template -->
      <div id="uploading-ui-template" class="hidden">
           <div class="w-full flex flex-col items-center justify-center gap-6 text-center animate-fade-in min-h-[250px]">
       <div class="relative h-24 w-24 flex items-center justify-center">
             <div class="absolute inset-0 border-8 border-black border-t-transparent rounded-full animate-spin"></div>
             <div class="relative font-black text-3xl"><i data-lucide="zap" class="w-12 h-12"></i></div>
         </div>
         <p class="font-black text-2xl bg-white border-4 border-black px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
             PROCESSING DATA...
         </p>
     </div>

      <!-- Live Status Template -->
      <div id="job-status-template" class="hidden">
            <div class="w-full max-w-lg mx-auto space-y-6 animate-fade-in">
                <div class="border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
                    <p class="text-2xl font-black uppercase">Live Processing</p>
                    <div data-job-status class="border-4 border-dashed border-black px-4 py-3 font-bold bg-neutral-100 text-center uppercase tracking-wide">
                        Connecting to worker...
                    </div>
                    <ul data-job-log class="text-left space-y-2 font-bold text-sm max-h-48 overflow-y-auto pr-2"></ul>
                    <p class="text-xs text-black/60 font-bold text-center uppercase tracking-widest">
                        Keep this tab open to follow along in real-time
                    </p>
                </div>
            </div>
      </div>
      </div>

      <!-- Permission Modal -->
      <div id="permission-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="w-full max-w-sm border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center animate-pop">
                <h3 class="text-2xl font-black uppercase mb-2">Mic Check!</h3>
                <p class="font-bold text-black/80 mb-6">We need access to your microphone.</p>
                <div class="flex flex-col gap-3">
                    <button id="allow-mic-btn" class="cursor-pointer w-full border-4 border-black bg-green-400 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-500 active:translate-y-1 active:shadow-none transition-all">
                        Allow Access
                    </button>
                    <button onclick="document.getElementById('permission-modal').classList.add('hidden')" class="cursor-pointer w-full border-4 border-black bg-white py-3 font-black uppercase hover:bg-gray-100 active:translate-y-1 transition-all">
                        Cancel
                    </button>
                </div>
            </div>
      </div>

      <script>
        (function() {
            // Core Logic
            window.selectedDuration = 15;
            window.setDuration = (val) => { window.selectedDuration = val; };
            
            window.mediaRecorder = null;
            window.audioChunks = [];
            window.userId = "${userId || 'guest'}";
            window.currentQuestionId = null;
            window.jobStatusSocket = null;
            window.jobStatusTaskId = null;

            try {
                const storedId = localStorage.getItem('english-speak-reviewer-id');
                if (storedId) {
                    window.userId = storedId;
                }
            } catch (error) {
                console.error('Unable to hydrate user id from storage', error);
            }

            function escapeHtml(unsafe) {
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            const closeJobStatusSocket = () => {
                if (window.jobStatusSocket) {
                    try {
                        window.jobStatusSocket.close();
                    } catch (socketError) {
                        console.warn('Failed to close status socket', socketError);
                    }
                }
                window.jobStatusSocket = null;
                window.jobStatusTaskId = null;
            };

            const restoreControls = () => {
                closeJobStatusSocket();
                window.currentQuestionId = null;
                const centralScreen = document.getElementById('central-screen');
                const controls = document.getElementById('controls-template');
                if (centralScreen && controls) {
                    centralScreen.innerHTML = controls.innerHTML;
                    
                    // Re-initialize htmx on the new button
                    if (typeof htmx !== 'undefined') {
                        const newBtn = centralScreen.querySelector('#start-btn');
                        if (newBtn) {
                            htmx.process(newBtn);
                        }
                    }
                } else {
                    window.location.reload();
                }
            };
            window.restoreControls = restoreControls;

            const showSubmissionFeedback = ({ title, detail, variant = 'success' }) => {
                closeJobStatusSocket();
                const centralScreen = document.getElementById('central-screen');
                if (!centralScreen) return;

                const colors = variant === 'error'
                    ? 'bg-red-100 border-red-600 text-red-700'
                    : 'bg-green-100 border-green-600 text-green-800';
                const safeTitle = escapeHtml(String(title ?? ''));
                const safeDetail = escapeHtml(String(detail ?? ''));

                centralScreen.innerHTML = [
                    '<div class="w-full max-w-lg mx-auto text-center space-y-6 animate-fade-in">',
                    '    <div class="border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">',
                    '        <p class="text-3xl font-black uppercase">' + safeTitle + '</p>',
                    '        <p class="font-bold ' + colors + ' border-4 px-4 py-3">' + safeDetail + '</p>',
                    '        <button class="inline-flex items-center gap-2 border-4 border-black bg-yellow-300 px-4 py-2 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-y-1 active:shadow-none cursor-pointer transition-all"',
                    '                onclick="window.restoreControls()">',
                    '            Record Another',
                    '        </button>',
                    '    </div>',
                    '</div>',
                ].join('\\n');
            };

            const teardownMediaRecorder = (options = {}) => {
                const { clearChunks = true } = options;
                const recorder = window.mediaRecorder;
                if (!recorder) {
                    if (clearChunks) {
                        window.audioChunks = [];
                    }
                    return;
                }

                try {
                    recorder.onstop = null;
                    recorder.ondataavailable = null;
                    if (recorder.state === 'recording') {
                        recorder.stop();
                    }
                } catch (stopError) {
                    console.warn('Failed to stop recorder cleanly', stopError);
                }

                try {
                    const stream = recorder.stream;
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                } catch (streamError) {
                    console.warn('Failed to stop microphone stream', streamError);
                }

                window.mediaRecorder = null;
                if (clearChunks) {
                    window.audioChunks = [];
                }
            };

            window.teardownMediaRecorder = teardownMediaRecorder;

            if (!window.reviewRecorderCleanupAttached) {
                const beforeUnloadCleanup = () => {
                    teardownMediaRecorder();
                };

                const beforeSwapCleanup = (event) => {
                    const swapTarget = (event.detail && event.detail.target) || event.target;
                    if (!(swapTarget instanceof HTMLElement)) {
                        return;
                    }
                    if (swapTarget.tagName !== 'BODY') {
                        return;
                    }
                    if (window.location.pathname === '/review') {
                        teardownMediaRecorder();
                    }
                };

                window.addEventListener('beforeunload', beforeUnloadCleanup);
                document.addEventListener('htmx:beforeSwap', beforeSwapCleanup);
                window.reviewRecorderCleanupAttached = true;
                window.reviewRecorderCleanupHandlers = {
                    beforeUnloadCleanup,
                    beforeSwapCleanup,
                };
            }

            // Permission Logic
            window.checkPermissionAndTrigger = async (btnElement) => {
                if (btnElement.disabled) return;
                btnElement.disabled = true;

                if (window.mediaRecorder) {
                    if (window.mediaRecorder.state !== 'inactive') {
                        console.warn('Found stale active recorder. Cleaning up...');
                        teardownMediaRecorder();
                    } else {
                        // Reuse inactive valid recorder
                        if (typeof htmx !== 'undefined') {
                            htmx.trigger(btnElement, 'confirmed');
                        }
                        return;
                    }
                }
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    window.mediaRecorder = new MediaRecorder(stream);
                    if (typeof htmx !== 'undefined') {
                        htmx.trigger(btnElement, 'confirmed');
                    }
                } catch (err) {
                    console.error('Microphone permission error:', err);
                    btnElement.disabled = false; // Re-enable if failed
                    const modal = document.getElementById('permission-modal');
                    if (modal) {
                        modal.classList.remove('hidden');
                    }
                }
            };

            const allowMicBtn = document.getElementById('allow-mic-btn');
            if (allowMicBtn) {
                allowMicBtn.addEventListener('click', async () => {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        window.mediaRecorder = new MediaRecorder(stream);
                        const modal = document.getElementById('permission-modal');
                        if (modal) {
                            modal.classList.add('hidden');
                        }
                        alert("Microphone connected! Press REC again.");
                    } catch (err) {
                        console.error('Failed to get microphone permission:', err);
                        alert("Permission denied.");
                    }
                });
            }

            const runCountdown = (promptCounter) => {
                if (!promptCounter) {
                    return Promise.resolve();
                }

                return new Promise((resolve) => {
                    let count = 3;

                    const syncDisplay = (value) => {
                        promptCounter.textContent = typeof value === 'number' ? String(value) : value;
                    };

                    syncDisplay(count);

                    const interval = setInterval(() => {
                        count -= 1;
                        if (count > 0) {
                            syncDisplay(count);
                        } else {
                            clearInterval(interval);
                            syncDisplay('GO!');
                            setTimeout(resolve, 250);
                        }
                    }, 1000);
                });
            };

            document.body.addEventListener('htmx:afterSwap', (event) => {
                const target = event.detail && event.detail.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                if (target.id !== 'central-screen') {
                    return;
                }

                const promptRoot = target.querySelector('[data-question-id]');
                if (promptRoot instanceof HTMLElement) {
                    window.currentQuestionId = promptRoot.getAttribute('data-question-id');
                } else {
                    window.currentQuestionId = null;
                }

                const promptCounter = target.querySelector('#prompt-countdown');
                if (promptCounter) {
                    runCountdown(promptCounter).then(() => {
                        startRecording();
                    });
                }
            });

            const statusMessages = {
                connected: 'Realtime channel ready',
                started: 'Starting audio analysis',
                processing: 'Analyzing speech and fluency',
                transcribed: 'Pronunciation scored',
                feedback: 'Generating AI feedback',
                completed: 'Job completed',
                error: 'Processing error',
            };

            const startJobStatusMonitor = (taskId, filename) => {
                const tapeLabel = filename || 'your tape';
                if (!taskId) {
                    showSubmissionFeedback({
                        title: 'Submission queued',
                        detail: 'We could not attach realtime updates. Check History shortly.',
                        variant: 'success',
                    });
                    return;
                }

                const centralScreen = document.getElementById('central-screen');
                const template = document.getElementById('job-status-template');
                if (!(centralScreen && template)) {
                    showSubmissionFeedback({
                        title: 'Submission queued!',
                        detail: 'Results will appear in History soon.',
                        variant: 'success',
                    });
                    return;
                }

                centralScreen.innerHTML = template.innerHTML;
                const statusLabel = centralScreen.querySelector('[data-job-status]');
                const logList = centralScreen.querySelector('[data-job-log]');
                const appendLog = (text, variant = 'info') => {
                    if (!(logList instanceof HTMLElement)) return;
                    const item = document.createElement('li');
                    item.textContent = text;
                    if (variant === 'error') {
                        item.className = 'text-red-600 border border-red-600 px-2 py-1';
                    } else {
                        item.className = 'text-black/80 border border-black px-2 py-1';
                    }
                    logList.prepend(item);
                    const maxEntries = 10;
                    while (logList.childElementCount > maxEntries) {
                        logList.removeChild(logList.lastElementChild);
                    }
                };

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = new URL('/ws/status', window.location.origin);
                wsUrl.protocol = protocol;
                wsUrl.searchParams.set('taskId', taskId);
                if (window.userId && window.userId !== 'guest') {
                    wsUrl.searchParams.set('userId', window.userId);
                }

                closeJobStatusSocket();
                const socket = new WebSocket(wsUrl.toString());
                window.jobStatusSocket = socket;
                window.jobStatusTaskId = taskId;

                socket.addEventListener('open', () => {
                    appendLog('Connected to worker queue');
                });

                socket.addEventListener('message', (event) => {
                    if (typeof event.data !== 'string') {
                        return;
                    }
                    let payload;
                    try {
                        payload = JSON.parse(event.data);
                    } catch (err) {
                        console.warn('Malformed status payload', err);
                        return;
                    }
                    if (!payload || !payload.status) {
                        return;
                    }
                    const label = statusMessages[payload.status] || payload.status;
                    if (statusLabel instanceof HTMLElement) {
                        statusLabel.textContent = label;
                    }
                    appendLog(label, payload.status === 'error' ? 'error' : 'info');

                    if (payload.status === 'completed') {
                        closeJobStatusSocket();
                        showSubmissionFeedback({
                            title: 'Processing complete!',
                            detail: 'Your tape ' + tapeLabel + ' is ready in history.',
                            variant: 'success',
                        });
                    } else if (payload.status === 'error') {
                        closeJobStatusSocket();
                        showSubmissionFeedback({
                            title: 'Processing failed',
                            detail: payload.message || 'Please try another recording.',
                            variant: 'error',
                        });
                    }
                });

                socket.addEventListener('close', () => {
                    if (window.jobStatusTaskId === taskId) {
                        window.jobStatusSocket = null;
                        window.jobStatusTaskId = null;
                    }
                });

                socket.addEventListener('error', () => {
                    closeJobStatusSocket();
                    showSubmissionFeedback({
                        title: 'Connection lost',
                        detail: 'Realtime updates unavailable. Check History for results.',
                        variant: 'error',
                    });
                });
            };
            window.startJobStatusMonitor = startJobStatusMonitor;

            async function startRecording() {
                // Swap Central Screen to Recording UI
                const centralScreen = document.getElementById('central-screen');
                const template = document.getElementById('recording-ui-template');
                if (!centralScreen || !template) {
                    console.error('Required elements not found');
                    return;
                }
                
                centralScreen.innerHTML = template.innerHTML;
                
                // Visuals
                const onAir = document.getElementById('on-air-sign');
                if (onAir) {
                    onAir.classList.add('bg-red-500', 'text-white', 'animate-pulse');
                    onAir.classList.remove('bg-neutral-200', 'text-neutral-400');
                }

                if (!window.mediaRecorder || window.mediaRecorder.state !== 'inactive') {
                    try {
                        teardownMediaRecorder({ clearChunks: false });
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        window.mediaRecorder = new MediaRecorder(stream);
                    } catch (setupError) {
                        console.error('Failed to initialize MediaRecorder', setupError);
                        showSubmissionFeedback({
                            title: 'Microphone unavailable',
                            detail: 'Please allow microphone access and press REC again.',
                            variant: 'error',
                        });
                        return;
                    }
                }

                if (!window.mediaRecorder) {
                    showSubmissionFeedback({
                        title: 'Microphone unavailable',
                        detail: 'We could not access your microphone. Please try again.',
                        variant: 'error',
                    });
                    return;
                }

                // Start Audio
                window.audioChunks = [];
                window.mediaRecorder.ondataavailable = e => window.audioChunks.push(e.data);
                window.mediaRecorder.onstop = uploadRecording;
                
                try {
                    window.mediaRecorder.start();
                } catch (err) {
                    console.error('Failed to start recording:', err);
                    showSubmissionFeedback({
                        title: 'Recording Failed',
                        detail: 'Could not start recording. Please try again.',
                        variant: 'error',
                    });
                    return;
                }

                // Animate Progress
                const bar = centralScreen.querySelector('#progress-bar');
                if (bar) {
                    bar.style.animationDuration = window.selectedDuration + 's';
                }

                setTimeout(() => {
                    if (window.mediaRecorder && window.mediaRecorder.state === 'recording') {
                        window.mediaRecorder.stop();
                    }
                }, window.selectedDuration * 1000);
            }
            window.startRecording = startRecording;

            async function uploadRecording() {
                const centralScreen = document.getElementById('central-screen');
                const template = document.getElementById('uploading-ui-template');
                if (!centralScreen || !template) {
                    console.error('Required elements not found');
                    return;
                }
                
                centralScreen.innerHTML = template.innerHTML;

                const onAir = document.getElementById('on-air-sign');
                if (onAir) {
                    onAir.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
                    onAir.classList.add('bg-neutral-200', 'text-neutral-400');
                }

                const recordedChunks = Array.isArray(window.audioChunks)
                    ? [...window.audioChunks]
                    : [];
                teardownMediaRecorder();

                const blob = new Blob(recordedChunks, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append('file', blob, 'recording.wav');

                if (!window.userId || window.userId === 'guest') {
                    showSubmissionFeedback({
                        title: 'Missing Email',
                        detail: 'Please enter your email again on the home page before recording.',
                        variant: 'error',
                    });
                    return;
                }

                if (!window.currentQuestionId) {
                    showSubmissionFeedback({
                        title: 'Missing Question',
                        detail: 'Please fetch a prompt and wait for the countdown before recording.',
                        variant: 'error',
                    });
                    return;
                }

                formData.append('questionId', window.currentQuestionId);

                try {
                    const response = await fetch('/api/submissions', {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'x-user-id': window.userId,
                        },
                    });

                    if (!response.ok) {
                        const errorPayload = await response.json().catch(() => ({}));
                        throw new Error(errorPayload.error || ('Submission failed with status ' + response.status));
                    }

                    const result = await response.json();
                    if (result && result.jobId) {
                        startJobStatusMonitor(result.jobId, result.filename);
                    } else {
                        showSubmissionFeedback({
                            title: 'Submission queued!',
                            detail: 'Realtime updates unavailable. Check your history for results soon.',
                            variant: 'success',
                        });
                    }
                } catch(error) {
                    console.error('Failed to submit recording', error);
                    showSubmissionFeedback({
                        title: 'Something went wrong',
                        detail: error instanceof Error ? error.message : 'Unknown error',
                        variant: 'error',
                    });
                }
            }
        })();
      </script>
    `
    });
}
