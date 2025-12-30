
import { formatDate } from '../../utils/date';

/**
 * Properties for the SubmissionListItem component.
 */
interface SubmissionItemProps {
    filename: string;
    createdAt: Date;
    status: string;
    questionText: string | null;
}

/**
 * Renders a list item summary for a submission in the sidebar.
 *
 * This component handles the HTMX interactions to load the detailed view
 * when clicked (`hx-get`, `hx-target`).
 *
 * @param item - The submission summary data.
 * @returns The rendered HTML string for the list item.
 */
export const SubmissionListItem = (item: SubmissionItemProps): string => {
    const isCompleted = item.status === 'completed';
    const isFailed = item.status === 'failed';
    const statusColor = isCompleted ? 'bg-green-400' : isFailed ? 'bg-red-400' : 'bg-yellow-300';

    return `
        <div hx-get="/api/submissions/${item.filename}"
             hx-target="#detail-view"
             hx-swap="innerHTML"
             class="group cursor-pointer border-2 border-black p-3 hover:bg-neutral-50 transition-all active:translate-y-1 active:border-b-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden"
        >
             
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-black uppercase text-black/50">${formatDate(new Date(item.createdAt))}</span>
                <div class="w-2 h-2 rounded-full ${statusColor}"></div>
            </div>
            
            <h3 class="font-bold text-sm leading-tight mb-2 line-clamp-2">${item.questionText || 'Unknown Prompt'}</h3>
            
            <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase px-1 bg-black text-white">${item.status}</span>
                ${isCompleted ? '<span class="text-xs font-bold text-black/40">View Report →</span>' : ''}
            </div>
            
            <!-- Hover Effect Line -->
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-black transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
        </div>
    `;
};
