import en from "~/locales/en.json";
import fr from "~/locales/fr.json";
import es from "~/locales/es.json";
import de from "~/locales/de.json";

type Translations = typeof en;

const locales: Record<string, Translations> = { en, fr, es, de };

function resolveLocale(locale?: string | null): string {
  if (!locale) return "en";
  const primary = locale.split("-")[0].toLowerCase();
  return locales[primary] ? primary : "en";
}

/**
 * Returns translations from a Shopify session locale first,
 * falling back to the Accept-Language header, then English.
 *
 * Usage in a loader:
 *   const { session } = await authenticate.admin(request);
 *   const t = getTranslations(request, (session as any).locale);
 *   return json({ t });
 */
export function getTranslations(request: Request, sessionLocale?: string | null): Translations {
  // 1. Prefer Shopify session locale (merchant's admin language)
  if (sessionLocale) {
    const resolved = resolveLocale(sessionLocale);
    if (locales[resolved]) return locales[resolved];
  }

  // 2. Fall back to browser Accept-Language header
  const header = request.headers.get("Accept-Language") ?? "en";
  const browserLocale = header.split(",")[0].split("-")[0].toLowerCase();
  return locales[browserLocale] ?? en;
}