/**
 * Extracts email addresses from an uploaded CSV or text file.
 *
 * Deliberately format-agnostic rather than a real CSV parser: lead exports
 * arrive with different column orders, with or without headers, quoted or
 * bare, sometimes as a plain newline-separated list. Scanning for anything
 * that looks like an address handles all of those without asking the user to
 * name a column.
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export function extractEmails(content) {
    const matches = content.match(EMAIL_REGEX) ?? [];
    const seen = new Set();
    for (const match of matches)
        seen.add(match.trim().toLowerCase());
    return {
        emails: [...seen],
        totalFound: matches.length,
        duplicates: matches.length - seen.size,
    };
}
export async function parseLeadFile(file) {
    const text = await file.text();
    return extractEmails(text);
}
export const ACCEPTED_LEAD_TYPES = '.csv,.txt,text/csv,text/plain';
