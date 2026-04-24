import { describe, it, expect } from "vitest";
import app from "../src/index.js";

const HEX_OR_EMPTY = /^(#[0-9a-fA-F]{6})?$/;

function post(body: unknown) {
  return app.request("/highlight/dual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /highlight/dual", () => {
  const code = "const x = 1;\nfunction foo() { return x; }";

  it("returns 200 with correct response shape", async () => {
    const res = await post({ code, language: "javascript" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.language).toBe("string");
    expect(typeof body.darkTheme).toBe("string");
    expect(typeof body.lightTheme).toBe("string");
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

  it("each token has darkColor and lightColor as hex or empty string", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    for (const line of body.tokens) {
      for (const token of line as { darkColor: string; lightColor: string }[]) {
        expect(token.darkColor).toMatch(HEX_OR_EMPTY);
        expect(token.lightColor).toMatch(HEX_OR_EMPTY);
      }
    }
  });

  // Proves both themes were actually applied — not just the same theme returned twice.
  it("dark and light colors differ for at least some tokens", async () => {
    const res = await post({ code, language: "javascript" });
    const body = await res.json();
    const allTokens: { darkColor: string; lightColor: string }[] = body.tokens.flat();
    const hasDiff = allTokens.some((t) => t.darkColor !== t.lightColor);
    expect(hasDiff).toBe(true);
  });

  it("defaults to github-dark and github-light when themes are omitted", async () => {
    const res = await post({ code: "hello" });
    const body = await res.json();
    expect(body.darkTheme).toBe("github-dark");
    expect(body.lightTheme).toBe("github-light");
  });

  it("includes Server-Timing header", async () => {
    const res = await post({ code, language: "javascript" });
    expect(res.headers.get("Server-Timing")).toMatch(/total;dur=/);
  });

  it("returns 400 for unsupported darkTheme", async () => {
    const res = await post({ code, language: "javascript", darkTheme: "invalid-dark" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported theme: invalid-dark");
  });

  it("returns 400 for unsupported lightTheme", async () => {
    const res = await post({ code, language: "javascript", lightTheme: "invalid-light" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported theme: invalid-light");
  });

  it("returns 400 for unsupported language", async () => {
    const res = await post({ code, language: "brainfuck" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unsupported language: brainfuck");
  });
});
