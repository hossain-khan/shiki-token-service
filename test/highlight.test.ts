import { describe, it, expect } from "vitest";
import app from "../src/index.js";

// Validates format without pinning exact values — we own this transform, not Shiki's color tables.
const HEX_OR_EMPTY = /^(#[0-9a-fA-F]{6})?$/;

function post(body: unknown) {
  return app.request("/highlight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /highlight", () => {
  const code = "const x = 1;\nfunction foo() { return x; }";

  it("returns 200 with correct response shape", async () => {
    const res = await post({ code, language: "javascript" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.language).toBe("string");
    expect(typeof body.theme).toBe("string");
    expect(Array.isArray(body.tokens)).toBe(true);
    expect(Array.isArray(body.tokens[0])).toBe(true);
  });

  // The strongest invariant we own: Shiki must not drop or duplicate characters.
  it("token texts reconstruct the original code exactly", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    const reconstructed = body.tokens
      .map((line: { text: string }[]) => line.map((t) => t.text).join(""))
      .join("\n");
    expect(reconstructed).toBe(code);
  });

  it("each token color is a hex string (#RRGGBB) or empty string", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    for (const line of body.tokens) {
      for (const token of line as { text: string; color: string }[]) {
        expect(token.color).toMatch(HEX_OR_EMPTY);
      }
    }
  });

  it("defaults language to 'text' and theme to 'github-dark' when omitted", async () => {
    const res = await post({ code: "hello world" });
    const body = await res.json();
    expect(body.language).toBe("text");
    expect(body.theme).toBe("github-dark");
  });

  it("respects explicit language and theme", async () => {
    const res = await post({ code, language: "javascript", theme: "dracula" });
    const body = await res.json();
    expect(body.language).toBe("javascript");
    expect(body.theme).toBe("dracula");
  });

  it("includes Server-Timing header with both total and tokenizer metrics", async () => {
    const res = await post({ code, language: "javascript" });
    expect(res.headers.get("Server-Timing")).toMatch(/total;dur=.*tokenizer;dur=/);
  });

  it("includes _debug block when debug is true", async () => {
    const res = await post({ code, language: "javascript", debug: true });
    const body = await res.json();
    expect(body._debug).toBeDefined();
    expect(typeof body._debug.totalMs).toBe("number");
    expect(typeof body._debug.tokenizerMs).toBe("number");
    expect(typeof body._debug.requestBodyBytes).toBe("number");
  });

  it("omits _debug block when debug is false (default)", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    expect(body._debug).toBeUndefined();
  });

  it("returns 400 for unsupported language", async () => {
    const res = await post({ code, language: "brainfuck" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported language: brainfuck");
    expect(typeof body.details).toBe("string");
  });

  it("returns 400 for unsupported theme", async () => {
    const res = await post({ code, language: "javascript", theme: "nonexistent-theme" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported theme: nonexistent-theme");
  });

  it("returns 400 when code field is missing", async () => {
    const res = await post({ language: "javascript" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("returns 413 when Content-Length exceeds 200 KB", async () => {
    const res = await app.request("/highlight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(201 * 1024),
      },
      body: JSON.stringify({ code: "x", language: "javascript" }),
    });
    expect(res.status).toBe(413);
  });
});
