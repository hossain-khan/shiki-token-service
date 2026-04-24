import type { Context } from "hono";

/**
 * Returns a 400 Bad Request JSON response.
 * @param message - Human-readable error message.
 * @param details - Optional extra detail (e.g. Zod parse error text).
 */
export function badRequest(c: Context, message: string, details?: string) {
  return c.json({ error: message, ...(details && { details }) }, 400);
}

/**
 * Returns a 400 Bad Request JSON response for an unrecognised language.
 * The response `details` field enumerates all supported language identifiers.
 */
export function unsupportedLanguage(c: Context, language: string, supported: string[]) {
  return c.json(
    {
      error: `Unsupported language: ${language}`,
      details: `Supported languages: ${supported.join(", ")}`,
    },
    400
  );
}

/**
 * Returns a 400 Bad Request JSON response for an unrecognised theme.
 * The response `details` field enumerates all supported theme names.
 */
export function unsupportedTheme(c: Context, theme: string, supported: string[]) {
  return c.json(
    {
      error: `Unsupported theme: ${theme}`,
      details: `Supported themes: ${supported.join(", ")}`,
    },
    400
  );
}

/** Returns a 500 Internal Server Error JSON response. */
export function internalError(c: Context, message: string) {
  return c.json({ error: message }, 500);
}
