import { describe, it, expect } from "vitest";
import { mapScopeToTokenType } from "../src/lib/scope-mapper.js";

// Unit tests for mapScopeToTokenType. Each rule in SCOPE_RULES is covered so
// that regressions in the mapping are caught without running the full API stack.

describe("mapScopeToTokenType", () => {
  it("returns 'plain' for an empty scope array", () => {
    expect(mapScopeToTokenType([])).toBe("plain");
  });

  it("returns 'plain' when no scope matches any rule", () => {
    expect(mapScopeToTokenType(["source.js", "meta.block"])).toBe("plain");
  });

  it("maps 'keyword.control' to 'keyword'", () => {
    expect(mapScopeToTokenType(["keyword.control.if"])).toBe("keyword");
  });

  it("maps 'storage.type' to 'type'", () => {
    expect(mapScopeToTokenType(["storage.type.var"])).toBe("type");
  });

  it("maps 'storage.modifier' to 'modifier'", () => {
    expect(mapScopeToTokenType(["storage.modifier.async"])).toBe("modifier");
  });

  it("maps 'entity.name.function' to 'function'", () => {
    expect(mapScopeToTokenType(["entity.name.function.myFunc"])).toBe("function");
  });

  it("maps 'entity.name.type' to 'type'", () => {
    expect(mapScopeToTokenType(["entity.name.type.class"])).toBe("type");
  });

  it("maps 'entity.name.tag' to 'tag'", () => {
    expect(mapScopeToTokenType(["entity.name.tag.html"])).toBe("tag");
  });

  it("maps 'entity.other.attribute-name' to 'attribute'", () => {
    expect(mapScopeToTokenType(["entity.other.attribute-name.html"])).toBe("attribute");
  });

  it("maps 'variable.parameter' to 'parameter'", () => {
    expect(mapScopeToTokenType(["variable.parameter.function"])).toBe("parameter");
  });

  it("maps 'variable.other' to 'variable'", () => {
    expect(mapScopeToTokenType(["variable.other.readwrite"])).toBe("variable");
  });

  it("maps 'constant.numeric' to 'number'", () => {
    expect(mapScopeToTokenType(["constant.numeric.integer"])).toBe("number");
  });

  it("maps 'constant.language' to 'constant'", () => {
    expect(mapScopeToTokenType(["constant.language.null"])).toBe("constant");
  });

  it("maps 'constant.other' to 'constant' (broad constant rule)", () => {
    expect(mapScopeToTokenType(["constant.other.placeholder"])).toBe("constant");
  });

  it("maps 'string.quoted' to 'string'", () => {
    expect(mapScopeToTokenType(["string.quoted.double"])).toBe("string");
  });

  it("maps 'comment.line' to 'comment'", () => {
    expect(mapScopeToTokenType(["comment.line.double-slash"])).toBe("comment");
  });

  it("maps 'punctuation.definition' to 'punctuation'", () => {
    expect(mapScopeToTokenType(["punctuation.definition.string.begin"])).toBe("punctuation");
  });

  it("maps 'support.function' to 'function'", () => {
    expect(mapScopeToTokenType(["support.function.console"])).toBe("function");
  });

  it("maps 'support.type' to 'type'", () => {
    expect(mapScopeToTokenType(["support.type.primitive"])).toBe("type");
  });

  it("maps 'meta.import' to 'keyword'", () => {
    expect(mapScopeToTokenType(["meta.import"])).toBe("keyword");
  });

  // Precedence: more-specific (innermost) scope wins when multiple scopes are present.
  it("innermost scope wins over outer scope", () => {
    // Outer: keyword; inner: string — result must be 'string'
    expect(mapScopeToTokenType(["keyword.control", "string.quoted.double"])).toBe("string");
  });

  // 'variable.parameter' must resolve to 'parameter' rather than 'variable' because
  // 'variable.parameter' is listed before 'variable' in SCOPE_RULES.
  it("variable.parameter resolves to 'parameter', not 'variable'", () => {
    expect(mapScopeToTokenType(["variable.parameter.arg"])).toBe("parameter");
  });

  // 'constant.numeric' must resolve to 'number', not 'constant', because
  // 'constant.numeric' is listed before the broad 'constant' rule in SCOPE_RULES.
  it("constant.numeric resolves to 'number', not 'constant'", () => {
    expect(mapScopeToTokenType(["constant.numeric.decimal"])).toBe("number");
  });
});
