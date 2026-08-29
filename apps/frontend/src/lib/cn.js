/** Joins class names, dropping falsy values. Keeps conditional styling terse. */
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
