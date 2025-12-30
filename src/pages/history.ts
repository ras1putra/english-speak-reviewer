
/* eslint-disable max-lines-per-function */

import { html } from 'hono/html';

import { LoginPrompt } from './components/loginPrompt';
import { PageLayout } from './components/pageLayout';

const historyPageStyles = `
    @keyframes slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pop { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes reel-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    
    .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
    .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
    .animate-pop { animation: pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .reel-spinning { animation: reel-spin 1.5s linear infinite; }
    .lcd-active { animation: pulse-glow 2s ease-in-out infinite; }

    .custom-scroll::-webkit-scrollbar {
        width: 8px;
    }
    .custom-scroll::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-left: 2px solid #000;
    }
    .custom-scroll::-webkit-scrollbar-thumb {
        background: #000; 
    }
    .custom-scroll::-webkit-scrollbar-thumb:hover {
        background: #333; 
    }
`;

/**
 * Properties for the HistoryPage component.
 */
interface HistoryPageProps {
    userId?: string;
}

/**
 * Renders the History page (Archives).
 *
 * This page displays a list of past audio submissions and a detailed view for the selected submission.
 * It features:
 * - A responsive split-pane layout (list on left, details on right).
 * - Real-time updates via WebSockets to reflect processing status.
 * - An interactive audio player with "karaoke-style" word highlighting.
 *
 * @param props - Component properties.
 * @param props.userId - The ID of the currently authenticated user (optional).
 * @returns The rendered HTML string for the history page.
 */
export default function HistoryPage({ userId }: HistoryPageProps): ReturnType<typeof html> {
    return PageLayout({
        userId,
        activePath: '/history',
        containerClass: 'mx-auto max-w-7xl px-4 py-4 lg:py-8',
        customStyles: historyPageStyles,
        children: html`
      ${!userId ? LoginPrompt({}) : ''}

      
      <div class="grid lg:grid-cols-12 gap-4 lg:gap-8 items-start">
        
        <!-- Left Panel: Session List -->
        <div class="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-8">
            <header class="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center">
                <h1 class="text-xl lg:text-3xl font-black uppercase italic">Tapes</h1>
                <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </header>
            
            <div id="history-container" class="min-h-32 max-h-[40vh] lg:max-h-[calc(100vh-10rem)] flex-1 overflow-y-auto custom-scroll border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                <div id="loading-indicator" class="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <div class="flex flex-col items-center gap-2">
                        <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                        <p class="font-bold uppercase text-xs">Loading Archive...</p>
                    </div>
                </div>
                
                <div id="history-list" class="space-y-3"
                     hx-get="/api/submissions"
                     hx-trigger="load"
                     hx-swap="innerHTML"
                >
                    <!-- HTMX will populate this -->
                </div>
                
                <div id="empty-state" class="hidden h-full flex flex-col items-center justify-center text-center p-4">
                    <div class="mb-2"><i data-lucide="cassette-tape" class="w-12 h-12"></i></div>
                    <p class="font-black uppercase text-lg">No Tapes Found</p>
                    <p class="text-sm font-bold text-black/60 mb-4">You haven't recorded anything yet.</p>
                    <a href="/review" class="border-2 border-black bg-green-400 px-4 py-2 font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:shadow-none transition-all">
                        Go to Studio
                    </a>
                </div>
            </div>
        </div>

        <!-- Right Panel: Detail View -->
        <div class="lg:col-span-8 flex flex-col">
            <div id="detail-view" class="min-h-[500px] border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 lg:p-8 relative hidden">
                <!-- Content injected here -->
            </div>
            
            <!-- Detail Empty State -->
            <div id="detail-placeholder"
                class="h-full border-4 border-black bg-neutral-100
                        shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]
                        flex items-center justify-center p-8">

                <div class="text-center opacity-40">
                    <div class="flex justify-center mb-4 text-black/20">
                        <i data-lucide="folder-open" class="w-16 h-16 lg:w-24 lg:h-24"></i>
                    </div>

                    <h2 class="text-xl lg:text-3xl font-black uppercase">Select a Tape</h2>
                    <p class="font-bold text-sm lg:text-lg">View analysis, transcript, and playback.</p>
                </div>
            </div>
        </div>
      </div>

      <script>
        (function() {
            window.userId = "${userId || 'guest'}";
            window.historyStatusSocket = null;
            const elements = {
                loading: document.getElementById('loading-indicator'),
            };


            const body = document.body;

            const detailBeforeRequestHandler = function(evt) {
                if (evt.detail.target.id === 'detail-view') {
                     const dp = document.getElementById('detail-placeholder');
                     const dv = document.getElementById('detail-view');
                     
                     dp.classList.add('hidden');
                     dv.classList.remove('hidden');
                     
                     // Show loading spinner in detail view while fetching
                     dv.innerHTML = '<div class="flex items-center justify-center h-full"><div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>';
                }
            };
            if (window.historyBeforeRequestHandler) {
                body.removeEventListener('htmx:beforeRequest', window.historyBeforeRequestHandler);
            }
            window.historyBeforeRequestHandler = detailBeforeRequestHandler;
            body.addEventListener('htmx:beforeRequest', detailBeforeRequestHandler);

            // Listen for HTMX events to hide loading state and init player
             const detailAfterSwapHandler = function(evt) {
                if (evt.detail.target.id === 'history-list') {
                     if (elements.loading) elements.loading.classList.add('hidden');
                }
                
                if (evt.detail.target.id === 'detail-view') {
                     const dp = document.getElementById('detail-placeholder');
                     const dv = document.getElementById('detail-view');
                     
                     // Ensure visibility is correct (in case it wasn't triggered by beforeRequest for some reason)
                     if(dp) dp.classList.add('hidden');
                     if(dv) dv.classList.remove('hidden');

                     // Auto-scroll on mobile
                     if (window.innerWidth < 1024) {
                        dv.scrollIntoView({ behavior: 'smooth', block: 'start' });
                     }

                     // Re-init icons
                     if (window.lucide) {
                        window.lucide.createIcons();
                     }

                     const root = evt.detail.target.querySelector('[data-submission-root]');
                     if (root) {
                        evt.detail.target.dataset.filename = root.getAttribute('data-filename') || '';
                        evt.detail.target.dataset.status = root.getAttribute('data-status') || '';
                     } else if (dv) {
                        dv.dataset.filename = '';
                        dv.dataset.status = '';
                     }

                     // Init player if present
                     const playerContainer = evt.detail.target.querySelector('#audio-player-container');
                     if(playerContainer && playerContainer.dataset.filename) {
                         initAudioPlayer(evt.detail.target, playerContainer.dataset.filename);
                     }
                }
            };
            if (window.historyAfterSwapHandler) {
                body.removeEventListener('htmx:afterSwap', window.historyAfterSwapHandler);
            }
            window.historyAfterSwapHandler = detailAfterSwapHandler;
            body.addEventListener('htmx:afterSwap', detailAfterSwapHandler);

            // Inject user ID into all HTMX requests
            const configRequestHandler = function(evt) {
                if (window.userId) {
                    evt.detail.headers['x-user-id'] = window.userId;
                }
            };
            if (window.historyConfigRequestHandler) {
                body.removeEventListener('htmx:configRequest', window.historyConfigRequestHandler);
            }
            window.historyConfigRequestHandler = configRequestHandler;
            body.addEventListener('htmx:configRequest', configRequestHandler);

            function initAudioPlayer(container, filename) {
                const player = container.querySelector('#detail-audio');
                const btnPlay = container.querySelector('#btn-play');
                const btnPause = container.querySelector('#btn-pause');
                const btnStop = container.querySelector('#btn-stop');
                const progressBar = container.querySelector('#progress-bar');
                const progressContainer = container.querySelector('#progress-container');
                const timeCurrent = container.querySelector('#time-current');
                const timeTotal = container.querySelector('#time-total');
                const volumeSlider = container.querySelector('#volume-slider');
                const volumeDisplay = container.querySelector('#volume-display');

                if (!player) return;

                const formatTime = (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return mins + ':' + secs.toString().padStart(2, '0');
                };

                // Load audio (avoid duplicate fetch)
                if (player.dataset.loadedFilename !== filename && player.dataset.loadingAudio !== 'true') {
                    player.dataset.loadingAudio = 'true';
                    loadAudioBlob(filename, player)
                        .catch(() => {}) // already logged inside loader
                        .finally(() => {
                            delete player.dataset.loadingAudio;
                        });
                }

                // Volume control
                volumeSlider.addEventListener('input', (e) => {
                    const vol = e.target.value;
                    player.volume = vol / 100;
                    volumeDisplay.textContent = vol + '%';
                });
                player.volume = 0.8;

                // Progress bar click to seek
                progressContainer.addEventListener('click', (e) => {
                    if (player.duration) {
                        const rect = progressContainer.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const percentage = clickX / rect.width;
                        player.currentTime = percentage * player.duration;
                    }
                });

                // Controls
                btnPlay.addEventListener('click', () => player.play());
                btnPause.addEventListener('click', () => player.pause());
                btnStop.addEventListener('click', () => {
                    player.pause();
                    player.currentTime = 0;
                });

                // Update progress and time (low precision is fine for UI text/bar)
                player.addEventListener('timeupdate', () => {
                    if (player.duration) {
                        const progress = (player.currentTime / player.duration) * 100;
                        progressBar.style.width = progress + '%';
                        timeCurrent.textContent = formatTime(player.currentTime);
                    }
                });

                // High precision Karaoke Logic
                let animationFrameId;

                const updateKaraoke = () => {
                    if (!player || player.paused || player.ended) return;

                    const t = player.currentTime;
                    const words = container.querySelectorAll('.transcript-word');
                    
                    // Clear active state first
                    words.forEach(w => {
                        if (w.classList.contains('bg-black')) {
                            // Remove pop effect
                            w.classList.remove('bg-black', 'text-white', 'scale-110', 'shadow-[4px_4px_0px_0px_rgba(253,224,71,1)]', 'z-10');
                            
                            // Restore mispronounced red text if it had it
                            if (w.classList.contains('decoration-red-500')) {
                                w.classList.remove('text-white'); // redundancy ensure
                                w.classList.add('text-red-500');
                            }
                        }
                    });

                    // Find current word
                    for (let i = 0; i < words.length; i++) {
                        const w = words[i];
                        const start = parseFloat(w.dataset.start);
                        const end = parseFloat(w.dataset.end);
                        
                        if (t >= start && t <= end) {
                            // Apply pop effect
                            w.classList.add('bg-black', 'text-white', 'scale-110', 'shadow-[4px_4px_0px_0px_rgba(253,224,71,1)]', 'z-10');
                            
                            if (w.classList.contains('text-red-500')) {
                                w.classList.remove('text-red-500');
                                // No need to add text-white again, it's covered by the group add above
                            }
                            break; 
                        }
                    }

                    animationFrameId = requestAnimationFrame(updateKaraoke);
                };

                player.addEventListener('play', () => {
                    cancelAnimationFrame(animationFrameId);
                    updateKaraoke();
                });

                player.addEventListener('pause', () => cancelAnimationFrame(animationFrameId));
                player.addEventListener('ended', () => cancelAnimationFrame(animationFrameId));

                
                // Allow clicking words to seek
                const transcriptContainer = container.querySelector('#detail-transcript');
                if (transcriptContainer) {
                    transcriptContainer.addEventListener('click', (e) => {
                        const target = e.target.closest('.transcript-word');
                        if (target && target.dataset.start) {
                            player.currentTime = parseFloat(target.dataset.start);
                            player.play();
                        }
                    });
                }


                player.addEventListener('loadedmetadata', () => {
                    timeTotal.textContent = formatTime(player.duration);
                });

                player.addEventListener('ended', () => {
                    progressBar.style.width = '0%';
                });
            }

            async function loadAudioBlob(filename, playerElement) {
                try {
                    const res = await fetch('/api/submissions/' + filename + '/audio', {
                        headers: { 'x-user-id': window.userId }
                    });
                    if (res.ok) {
                        const blob = await res.blob();
                        playerElement.src = URL.createObjectURL(blob);
                        playerElement.dataset.loadedFilename = filename;
                    } else {
                        delete playerElement.dataset.loadedFilename;
                    }
                } catch (e) {
                    console.error("Audio load failed", e);
                    delete playerElement.dataset.loadedFilename;
                    throw e;
                }
            }

            function refreshHistoryList() {
                if (typeof htmx === 'undefined') return;
                const list = document.getElementById('history-list');
                if (!list) return;
                htmx.ajax('GET', '/api/submissions', { target: '#history-list', swap: 'innerHTML' });
            }

            function refreshDetailIfMatches(filename) {
                if (!filename || typeof htmx === 'undefined') return;
                const detailView = document.getElementById('detail-view');
                if (!detailView || detailView.dataset.filename !== filename) {
                    return;
                }
                htmx.ajax('GET', '/api/submissions/' + filename, { target: '#detail-view', swap: 'innerHTML' });
            }

            function setupHistoryStatusSocket() {
                if (!window.userId || window.userId === 'guest') {
                    return;
                }
                if (window.historyStatusSocket) {
                    try {
                        window.historyStatusSocket.close();
                    } catch (error) {
                        console.warn('Failed to close existing status socket', error);
                    }
                }
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = new URL('/ws/status', window.location.origin);
                wsUrl.protocol = protocol;
                wsUrl.searchParams.set('taskId', 'all');
                wsUrl.searchParams.set('userId', window.userId);
                const socket = new WebSocket(wsUrl.toString());
                window.historyStatusSocket = socket;

                socket.addEventListener('message', (event) => {
                    if (typeof event.data !== 'string') return;
                    let payload;
                    try {
                        payload = JSON.parse(event.data);
                    } catch (error) {
                        console.warn('Malformed status payload on history page', error);
                        return;
                    }
                    if (!payload || !payload.status) {
                        return;
                    }
                    if (payload.status === 'completed' || payload.status === 'error') {
                        refreshHistoryList();
                        refreshDetailIfMatches(payload.fileId);
                    }
                });

                const reconnect = () => {
                    window.historyStatusSocket = null;
                    if (!document.hidden) {
                        setTimeout(() => {
                            if (!window.historyStatusSocket) {
                                setupHistoryStatusSocket();
                            }
                        }, 3000);
                    }
                };

                socket.addEventListener('close', reconnect);
                socket.addEventListener('error', () => {
                    try {
                        socket.close();
                    } catch (error) {
                        console.warn('Failed to close status socket', error);
                    }
                });
            }

            const visibilityHandler = () => {
                if (!document.hidden && !window.historyStatusSocket) {
                    setupHistoryStatusSocket();
                }
            };
            if (window.historyVisibilityHandler) {
                document.removeEventListener('visibilitychange', window.historyVisibilityHandler);
            }
            window.historyVisibilityHandler = visibilityHandler;
            document.addEventListener('visibilitychange', visibilityHandler);

            setupHistoryStatusSocket();
        })();
      </script>
    `
    });
}
