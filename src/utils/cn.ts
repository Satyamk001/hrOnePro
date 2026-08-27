/**
 * Concatenates class name strings, filtering out falsy values.
 * Lightweight replacement for meet-ui's @/lib/utils dependency.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
