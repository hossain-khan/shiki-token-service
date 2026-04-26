import type { Context } from "hono";

/**
 * Conditionally appends a `_debug` object to a JSON response body.
 *
 * When `debug` is `false` the original `body` is returned unchanged. When
 * `true`, the following fields are added under `_debug`:
 * - `totalMs`          — total request wall-clock time in ms (3 decimal places, µs resolution).
 * - `tokenizerMs`      — Shiki tokenizer time in ms (present on highlight routes).
 * - `requestBodyBytes` — incoming `Content-Length` in bytes.
 * - `...extra`         — any route-specific fields (e.g. echoed `language` / `theme`).
 *
 * @param c     - Hono context; reads `requestStart`, `tokenizerMs`, `requestBodyBytes`.
 * @param body  - Base response object to extend.
 * @param debug - Whether to include the `_debug` block.
 * @param extra - Additional key/value pairs to merge into `_debug`.
 */
export function withDebug(
  c: Context<Env>,
  body: Record<string, unknown>,
  debug: boolean,
  extra?: Record<string, unknown>
) {
  if (!debug) return body;

  const totalMs = performance.now() - c.get("requestStart");
  const tokenizerMs = c.get("tokenizerMs");

  return {
    ...body,
    _debug: {
      totalMs: Math.round(totalMs * 1000) / 1000,
      ...(tokenizerMs !== undefined && { tokenizerMs: Math.round(tokenizerMs * 1000) / 1000 }),
      requestBodyBytes: c.get("requestBodyBytes"),
      ...extra,
    },
  };
}
