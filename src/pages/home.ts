
import { html } from 'hono/html'

import { LoginPrompt } from './components/loginPrompt';
import { PageLayout } from './components/pageLayout';

const homePageStyles = `
    @keyframes shake {
        0%, 100% { transform: rotate(-1deg); }
        50% { transform: rotate(1deg); }
    }
    
    @keyframes pop-in {
        0% { opacity: 0; transform: scale(0.5) translateY(20px); }
        70% { transform: scale(1.05); }
        100% { opacity: 1; transform: scale(1); }
    }
    @keyframes pop-in-stagger {
        0% { opacity: 0; transform: translateY(50px) rotate(5deg); }
        100% { opacity: 1; transform: translateY(0) rotate(0); }
    }

    .animate-shake:hover {
        animation: shake 0.2s ease-in-out infinite;
    }
    
    .animate-pop {
        animation: pop-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    
    .stagger-1 { animation-delay: 0.1s; }
    .stagger-2 { animation-delay: 0.2s; }
    .stagger-3 { animation-delay: 0.3s; }
`;

const MicPreview = (): ReturnType<typeof html> => html`
  <section class="border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-pop stagger-1" style="animation-fill-mode: backwards;">
    <div class="flex flex-col lg:flex-row items-center gap-12">
      
      <!-- Cassette Tape Visual -->
      <div class="relative w-full max-w-sm lg:w-1/2 hover:rotate-1 transition-transform">
        <div class="aspect-[3/2] w-full rounded-xl border-4 border-black bg-orange-400 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
             <div class="h-full w-full border-4 border-black bg-white flex flex-col items-center justify-center relative overflow-hidden">
                <div class="absolute top-2 left-2 text-xs font-black uppercase">Side A</div>
                <div class="absolute top-2 right-2 text-xs font-black uppercase">60 Min</div>
                
                <div class="flex gap-4 items-center">
                    <div class="h-16 w-16 mobile-wheel rounded-full border-4 border-black bg-neutral-200 flex items-center justify-center">
                        <div class="h-4 w-4 bg-black animate-spin" style="animation-duration: 3s;"></div>
                    </div>
                    <div class="h-12 w-24 border-b-4 border-black"></div>
                     <div class="h-16 w-16 mobile-wheel rounded-full border-4 border-black bg-neutral-200 flex items-center justify-center">
                        <div class="h-4 w-4 bg-black animate-spin" style="animation-duration: 3s;"></div>
                    </div>
                </div>
                
                <div class="absolute bottom-4 w-3/4 h-8 bg-black/10 rounded-full"></div>
             </div>
        </div>
        <div class="absolute -top-4 -right-4 rotate-12 bg-yellow-300 border-2 border-black px-4 py-1 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            REC ●
        </div>
      </div>

      <div class="flex-1 space-y-6 text-center lg:text-left">
        <div class="inline-block border-2 border-black bg-green-400 px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-bounce">
            Mic Check 1, 2
        </div>
        <h2 class="text-4xl lg:text-5xl font-black uppercase leading-none tracking-tighter">
          Speak Up.<br>
          <span class="text-white text-stroke-3 bg-black px-2">Get Good.</span>
        </h2>
        <p class="text-lg font-bold border-l-4 border-black pl-4">
          Don't just read. <span class="bg-yellow-300 px-1">Perform.</span> Tap the mic, answer the prompt, and let our AI analyze your pronunciation, pacing, and filler words.
        </p>
        
        <div class="flex flex-wrap gap-4 justify-center lg:justify-start">
            <div class="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform animate-shake">
                <i data-lucide="zap" class="w-4 h-4"></i> Instant WPM Score
            </div>
            <div class="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform animate-shake">
                <i data-lucide="bar-chart-2" class="w-4 h-4"></i> Pronunciation Analysis
            </div>
        </div>
      </div>
    </div>
  </section>
`;

const FeatureHighlights = (): ReturnType<typeof html> => html`
  <section class="grid gap-8 md:grid-cols-3">
    ${[
    {
      title: 'Random Prompts',
      description: 'We give you a topic. You get 30s. No scripts. Just practice.',
      icon: 'dice-5',
      color: 'bg-pink-400',
      rotate: '-rotate-2'
    },
    {
      title: 'Auto Record',
      description: 'Hands free. The mic captures your 15s or 30s answer automatically.',
      icon: 'mic',
      color: 'bg-cyan-400',
      rotate: 'rotate-1'
    },
    {
      title: 'Deep Analytics',
      description: 'We track filler words, pause duration, and speaking pace.',
      icon: 'trending-up',
      color: 'bg-lime-400',
      rotate: '-rotate-1'
    }
  ].map((feature, idx) => html`
      <div class="group relative ${feature.rotate} hover:rotate-0 transition-transform duration-300 animate-pop stagger-${idx + 1}" style="animation-fill-mode: backwards;">
        <div class="h-full border-4 border-black ${feature.color} p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div class="mb-4 text-4xl border-4 border-black inline-block bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:animate-bounce">
                <i data-lucide="${feature.icon}" class="w-8 h-8"></i>
            </div>
            <h3 class="mb-2 text-2xl font-black uppercase text-black italic">${feature.title}</h3>
            <p class="font-bold text-black/80 leading-tight">${feature.description}</p>
        </div>
      </div>
    `)}
  </section>
`;

/**
 * Properties for the HomePage component.
 */
interface HomePageProps {
  userId?: string;
}

/**
 * Renders the Home page (Landing page).
 *
 * This component displays the hero section, mic preview visual, and key feature highlights.
 * It serves as the entry point for users, encouraging them to start practicing.
 *
 * @param props - Component properties.
 * @param props.userId - The ID of the currently authenticated user (optional), used for conditional rendering of the login prompt.
 * @returns The rendered HTML string for the home page.
 */
export default function HomePage({ userId }: HomePageProps): ReturnType<typeof html> {
  return PageLayout({
    userId,
    activePath: '/',
    containerClass: 'relative mx-auto max-w-5xl px-4 py-12',
    customStyles: homePageStyles,
    children: html`
      ${!userId ? LoginPrompt({}) : ''}
      <div class="flex flex-col gap-16">

        <header class="text-center space-y-8 pt-8 animate-pop">
          <div class="inline-block border-4 border-black bg-white px-6 py-2 text-sm font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-2 hover:rotate-0 transition-transform">
            Practice • Analyze • Repeat
          </div>
          
          <h1 class="text-5xl md:text-8xl font-black uppercase leading-none tracking-tighter hover:scale-105 transition-transform duration-300">
            English<br>
            <span class="text-transparent" style="-webkit-text-stroke: 3px black;">Reviewer</span>
          </h1>
          
          <p class="mx-auto max-w-2xl text-xl font-bold bg-white inline-block border-2 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            The non-boring way to master your interview speaking skills.
          </p>
          
          <div class="flex justify-center pt-8">
            <a
              href="/review"
              class="inline-flex items-center gap-3 border-4 border-black bg-purple-500 px-8 py-4 text-xl font-black uppercase text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-600 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none animate-shake"
            >
              Start Practicing
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </header>
        
        ${MicPreview()}
        ${FeatureHighlights()}

        <section class="border-4 border-black bg-white p-8 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-pop stagger-3" style="animation-fill-mode: backwards;">
          <h3 class="text-3xl font-black uppercase mb-4">How it works</h3>
          <p class="font-bold max-w-2xl mx-auto">
            We record you. AI listens. You get a score. It's that simple. 
            No fluff, just data to help you sound smarter.
          </p>
        </section>
      </div>
    `
  });
}
