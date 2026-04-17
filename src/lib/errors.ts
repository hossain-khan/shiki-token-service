import type { Context } from "hono";

export function badRequest(c: Context, message: string, details?: string) {
  return c.json({ error: message, ...(details && { details }) }, 400);
}

export function unsupportedLanguage(c: Context, language: string, supported: string[]) {
  return c.json({
    error: `Unsupported language: ${language}`,
    details: `Supported languages: ${supported.join(", ")}`,
  }, 400);
}

export function unsupportedTheme(c: Context, theme: string, supported: string[]) {
  return c.json({
    error: `Unsupported theme: ${theme}`,
    details: `Supported themes: ${supported.join(", ")}`,
  }, 400);
}

export function internalError(c: Context, message: string) {
  return c.json({ error: message }, 500);
}
