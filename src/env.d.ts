/**
 * Hono context variables set by the global timing middleware in `index.ts`
 * and by individual route handlers.
 *
 * - `requestStart`     — `performance.now()` timestamp recorded at the start of
 *                        every request; used to compute `totalMs` in Server-Timing
 *                        and `_debug.totalMs`.
 * - `requestBodyBytes` — value of the incoming `Content-Length` header (0 when
 *                        absent); surfaced in `_debug.requestBodyBytes`.
 * - `tokenizerMs`      — wall-clock time (ms) spent inside the Shiki tokenizer,
 *                        set by each highlight route handler and included in both
 *                        the `Server-Timing` header and `_debug.tokenizerMs`.
 */
type Variables = {
  requestStart: number;
  requestBodyBytes: number;
  tokenizerMs: number;
};

/** Hono application environment — threads `Variables` through all route contexts. */
type Env = { Variables: Variables };
