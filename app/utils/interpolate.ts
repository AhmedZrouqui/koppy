/**
 * Simple string interpolation helper — client-safe, no server imports.
 * Usage: interpolate("Found {count} products", { count: 42 }) → "Found 42 products"
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}
