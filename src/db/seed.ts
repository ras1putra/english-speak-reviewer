
import { logger } from '../utils/logger';
import { db } from './index';
import { questions } from './schemas';

/**
 * Seeds the database with initial interview questions.
 *
 * This script inserts a predefined list of 80+ interview prompts
 * into the `questions` table to populate the application with content.
 * It is intended to be run once via `bun run db:seed`.
 */
const initialQuestions = [
    { text: "Tell me about yourself." },
    { text: "What is your greatest strength?" },
    { text: "Why do you want this job?" },
    { text: "What is your favorite meal?" },
    { text: "Describe a time you solved a difficult problem." },
    { text: "How do you handle stress at work?" },
    { text: "What is your biggest weakness and how are you addressing it?" },
    { text: "Explain a complex topic you recently learned." },
    { text: "What motivates you to get out of bed every morning?" },
    { text: "Who has influenced your career the most and why?" },
    { text: "Tell me about a project you are proud of." },
    { text: "How would your friends describe you?" },
    { text: "If you could travel anywhere right now, where would you go?" },
    { text: "What books or podcasts are you currently enjoying?" },
    { text: "Describe your ideal weekend." },
    { text: "What would you change about your last job?" },
    { text: "How do you prioritize your tasks when everything feels urgent?" },
    { text: "What skills would you like to learn next?" },
    { text: "What is one habit that improves your productivity?" },
    { text: "Tell me about a time you worked on a team." },
    { text: "What does success mean to you?" },
    { text: "How do you stay organized each day?" },
    { text: "What is a challenge you overcame recently?" },
    { text: "Describe a memorable customer or client interaction." },
    { text: "How do you keep yourself accountable?" },
    { text: "What is one thing most people do not know about you?" },
    { text: "How do you respond when plans suddenly change?" },
    { text: "What are you most excited about right now?" },
    { text: "If you could master one new language instantly, which would it be?" },
    { text: "What advice would you give to your younger self?" },
    { text: "Walk me through your resume." },
    { text: "What accomplishment are you most proud of this year?" },
    { text: "How do you approach learning a new skill quickly?" },
    { text: "Tell me about a time you disagreed with a teammate." },
    { text: "How do you handle feedback you disagree with?" },
    { text: "Describe your morning routine on a workday." },
    { text: "What is your creative outlet outside of work?" },
    { text: "How do you prepare for an important presentation?" },
    { text: "What was the last risk you took at work?" },
    { text: "How do you recharge after a stressful week?" },
    { text: "If you had a day with no obligations, how would you spend it?" },
    { text: "What is your favorite productivity tool and why?" },
    { text: "Tell me about a mentor who shaped your growth." },
    { text: "How do you decide when to ask for help?" },
    { text: "What excites you about technology today?" },
    { text: "Describe a situation where you led without authority." },
    { text: "What is a misconception people have about your profession?" },
    { text: "How do you track progress toward long-term goals?" },
    { text: "What is the best advice you have received recently?" },
    { text: "Describe a time you had to learn from failure." },
    { text: "What do you do to stay healthy while working remotely?" },
    { text: "If you could take a class on anything, what would it be?" },
    { text: "How do you unwind at the end of the day?" },
    { text: "Tell me about your first job." },
    { text: "What is something you taught yourself recently?" },
    { text: "How do you evaluate whether an opportunity is right for you?" },
    { text: "What inspires you to be creative?" },
    { text: "Describe a time you improved a process." },
    { text: "If you had to give a TED talk tomorrow, what topic would you choose?" },
    { text: "What is one tradition you hope to keep forever?" },
    { text: "How do you celebrate wins with your team?" },
    { text: "What is your favorite way to collaborate with others?" },
    { text: "Describe a passion project you are working on." },
    { text: "What skill would surprise people who know you?" },
    { text: "How do you handle competing deadlines?" },
    { text: "Tell me about a book that changed how you think." },
    { text: "What is your approach to mentoring others?" },
    { text: "How do you stay curious?" },
    { text: "What is one goal you are currently chasing?" },
    { text: "If you could live in any city for a year, where would it be?" },
    { text: "What kind of feedback helps you grow the most?" },
    { text: "What was the last podcast episode that stuck with you?" },
    { text: "How do you prepare for difficult conversations?" },
    { text: "What is a habit you are trying to build?" },
    { text: "Tell me about someone you admire." },
    { text: "How do you keep your creativity flowing when you feel blocked?" },
    { text: "What is one lesson you learned the hard way?" },
    { text: "Describe a time you delivered results with limited resources." },
    { text: "What would you do if you had an extra hour every day?" },
    { text: "How do you balance ambition with well-being?" },
];

const seed = async (): Promise<void> => {
    logger.info("Seeding database...");

    try {
        // Clear existing questions
        // await db.delete(questions); 

        await db.insert(questions).values(initialQuestions);

        logger.info("Database seeded successfully!");
        process.exit(0);
    } catch (error) {
        logger.error("Error seeding database:", error);
        process.exit(1);
    }
};

seed();
