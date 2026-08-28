/** Joins class names, dropping falsy values. Keeps conditional styling terse. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
