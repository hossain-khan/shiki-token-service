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

export function mapScopeToTokenType(scopes: string[]): string {
  for (const scope of scopes.reverse()) {
    for (const [prefix, tokenType] of SCOPE_RULES) {
      if (scope.startsWith(prefix)) {
        return tokenType;
      }
    }
  }
  return "plain";
}
