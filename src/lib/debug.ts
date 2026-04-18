import type { Context } from "hono";

export function withDebug(c: Context<Env>, body: Record<string, unknown>, debug: boolean, extra?: Record<string, unknown>) {
  if (!debug) return body;

  const totalMs = performance.now() - c.get("requestStart");
  const tokenizerMs = c.get("tokenizerMs");

  return {
    ...body,
    _debug: {
      totalMs: Math.round(totalMs * 10) / 10,
      ...(tokenizerMs !== undefined && { tokenizerMs: Math.round(tokenizerMs * 10) / 10 }),
      requestBodyBytes: c.get("requestBodyBytes"),
      ...extra,
    },
  };
}
