
/**
 * Formats a Date object or string into a localized compact string.
 * Format: "Jan 1, 01:00 PM" (en-US).
 *
 * @param date - The input date (Date object or ISO string).
 * @returns The formatted date string.
 */
export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d);
};
