import { z } from "zod";

/**
 * Request schema for `POST /highlight`.
 *
 * - `code`     — source code to tokenize; capped at 100 KB.
 * - `language` — Shiki language identifier (e.g. `"kotlin"`); defaults to `"text"`
 *                (plain text, no grammar applied).
 * - `theme`    — color theme name (e.g. `"github-dark"`); defaults to `"github-dark"`.
 * - `debug`    — when `true`, appends a `_debug` object to the response with
 *                timing and size metrics.
 */
export const HighlightRequestSchema = z.object({
  code: z.string().max(100_000),
  language: z.string().optional().default("text"),
  theme: z.string().optional().default("github-dark"),
  debug: z.boolean().optional().default(false),
});

/**
 * Request schema for `POST /highlight/dual`.
 *
 * Same fields as `HighlightRequestSchema` except the single `theme` is replaced
 * by separate `darkTheme` and `lightTheme` fields. Both themes are applied in a
 * single tokenization pass so the response carries both color sets per token,
 * allowing clients to switch between modes without re-fetching.
 */
export const HighlightDualRequestSchema = z.object({
  code: z.string().max(100_000),
  language: z.string().optional().default("text"),
  darkTheme: z.string().optional().default("github-dark"),
  lightTheme: z.string().optional().default("github-light"),
  debug: z.boolean().optional().default(false),
});

/**
 * Request schema for `POST /highlight/semantic`.
 *
 * No theme field — semantic highlighting is theme-independent. The route
 * internally uses `github-dark` to drive Shiki's tokenizer (which requires a
 * theme) but only the TextMate scope hierarchy is used; colors are discarded.
 */
export const HighlightSemanticRequestSchema = z.object({
  code: z.string().max(100_000),
  language: z.string().optional().default("text"),
  debug: z.boolean().optional().default(false),
});
