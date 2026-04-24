// Maps TextMate scope prefixes to semantic token types.
// Order matters: more specific prefixes (e.g. "storage.type") must come before
// broader ones (e.g. "variable") to match correctly.
const SCOPE_RULES: [string, string][] = [
  ["keyword", "keyword"],
  ["storage.type", "type"],
  ["storage.modifier", "modifier"],
  ["entity.name.function", "function"],
  ["entity.name.type", "type"],
  ["entity.name.tag", "tag"],
  ["entity.other.attribute-name", "attribute"],
  ["variable.parameter", "parameter"],
  ["variable", "variable"],
  ["constant.numeric", "number"],
  ["constant.language", "constant"],
  ["constant", "constant"],
  ["string", "string"],
  ["comment", "comment"],
  ["punctuation", "punctuation"],
  ["meta.import", "keyword"],
  ["support.function", "function"],
  ["support.type", "type"],
];

/**
 * Maps a TextMate scope stack to a single semantic token type string.
 *
 * Shiki provides scopes as a hierarchy (outermost → innermost). The array is
 * iterated in reverse so the most-specific (innermost) scope is evaluated first.
 * Each scope is tested against `SCOPE_RULES` in order; the first prefix match
 * wins. Falls back to `"plain"` if no rule matches.
 *
 * @param scopes - Array of TextMate scope names for a single token, ordered
 *                 from least-specific to most-specific.
 * @returns A semantic token type string (e.g. `"keyword"`, `"string"`, `"plain"`).
 */
export function mapScopeToTokenType(scopes: string[]): string {
  for (let i = scopes.length - 1; i >= 0; i--) {
    for (const [prefix, tokenType] of SCOPE_RULES) {
      if (scopes[i].startsWith(prefix)) {
        return tokenType;
      }
    }
  }
  return "plain";
}
