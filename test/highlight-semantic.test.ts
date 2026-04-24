import { describe, it, expect } from "vitest";
import app from "../src/index.js";

// These are the only values our scope-mapper.ts can produce. We own this mapping,
// so pinning exact types here is correct — unlike hex colors which belong to Shiki.
const VALID_TOKEN_TYPES = new Set([
  "keyword",
  "type",
  "modifier",
  "function",
  "tag",
  "attribute",
  "parameter",
  "variable",
  "number",
  "constant",
  "string",
  "comment",
  "punctuation",
  "plain",
]);

function post(body: unknown) {
  return app.request("/highlight/semantic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /highlight/semantic", () => {
  const code = "const x = 1;\nfunction foo() { return x; }";

  it("returns 200 with correct response shape", async () => {
    const res = await post({ code, language: "javascript" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.language).toBe("string");
    expect(Array.isArray(body.tokenTypes)).toBe(true);
    expect(Array.isArray(body.tokens)).toBe(true);
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

  it("every token type is from the known semantic type set", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    for (const line of body.tokens) {
      for (const token of line as { text: string; type: string }[]) {
        expect(VALID_TOKEN_TYPES.has(token.type)).toBe(true);
      }
    }
  });

  // Proves tokenTypes summary accurately reflects what's in the token array — not stale or fabricated.
  it("tokenTypes summary matches the set of types actually present in tokens", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    const seenTypes = new Set(body.tokens.flat().map((t: { type: string }) => t.type));
    const summaryTypes = new Set(body.tokenTypes);
    expect(seenTypes).toEqual(summaryTypes);
  });

  it("produces known types for well-known JavaScript constructs", async () => {
    const res = await post({ code: "const x = 1;", language: "javascript" });
    const body = await res.json();
    const allTypes: string[] = body.tokens.flat().map((t: { type: string }) => t.type);
    // `const` is a storage keyword → "type"; `1` is a numeric literal → "number"
    expect(allTypes).toContain("type");
    expect(allTypes).toContain("number");
  });

  it("returns 400 for unsupported language", async () => {
    const res = await post({ code, language: "brainfuck" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported language: brainfuck");
  });

  it("returns 400 when code field is missing", async () => {
    const res = await post({ language: "javascript" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });
});
