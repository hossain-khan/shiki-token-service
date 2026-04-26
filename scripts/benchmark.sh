#!/usr/bin/env bash
# =============================================================================
# Shiki Token Service — Benchmark Script
#
# Tests all three highlight endpoints (/highlight, /highlight/dual,
# /highlight/semantic) against real-world fixture files using `debug: true`
# to capture server-side tokenizer timing.
#
# Usage:
#   bash scripts/benchmark.sh [--url <base_url>] [--iterations <n>]
#
# Outputs:
#   scripts/reports/benchmark-YYYYMMDD-HHMMSS.md
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

BASE_URL="https://syntax-highlight.gohk.xyz"
ITERATIONS=5

# Parse optional CLI flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)        BASE_URL="$2";    shift 2 ;;
    --iterations) ITERATIONS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
REPORTS_DIR="$SCRIPT_DIR/reports"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORTS_DIR/benchmark-$TIMESTAMP.md"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ── Dependency check ──────────────────────────────────────────────────────────

check_deps() {
  local missing=()
  for cmd in curl jq bc; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: Missing required tools: ${missing[*]}" >&2
    echo "Install them and re-run the script." >&2
    exit 1
  fi
}
check_deps

# ── Setup ─────────────────────────────────────────────────────────────────────

mkdir -p "$REPORTS_DIR"

# ── API version ───────────────────────────────────────────────────────────────

echo "Fetching API info from $BASE_URL/health ..."
HEALTH_RESPONSE="$(curl -sf "$BASE_URL/health" || echo '{}')"
API_VERSION="$(echo "$HEALTH_RESPONSE" | jq -r '.version // "unknown"')"
API_STATUS="$(echo "$HEALTH_RESPONSE" | jq -r '.status // "unknown"')"

if [[ "$API_STATUS" != "ok" ]]; then
  echo "ERROR: API at $BASE_URL is not healthy (status=$API_STATUS)" >&2
  exit 1
fi
echo "API version: $API_VERSION — status: $API_STATUS"

# ── Warm-up ───────────────────────────────────────────────────────────────────

echo "Warming up the API (initializes Shiki singleton)..."

warmup_payload() {
  local fixture="$1" lang="$2"
  jq -Rrs --arg lang "$lang" '{code: ., language: $lang, theme: "github-dark", debug: false}' "$fixture"
}

for lang_fixture in "kotlin:$FIXTURES_DIR/kotlin-medium.kt" \
                    "typescript:$FIXTURES_DIR/typescript-medium.ts" \
                    "python:$FIXTURES_DIR/python-medium.py" \
                    "sql:$FIXTURES_DIR/sql-medium.sql"; do
  lang="${lang_fixture%%:*}"
  fixture="${lang_fixture#*:}"
  payload="$(warmup_payload "$fixture" "$lang")"
  curl -sf -X POST "$BASE_URL/highlight" \
    -H "Content-Type: application/json" \
    -d "$payload" -o /dev/null
done
echo "Warm-up complete."
echo ""

# ── Report buffer (accumulated in memory, written at end) ─────────────────────

REPORT_LINES=()

append() { REPORT_LINES+=("$1"); }

# ── Header ────────────────────────────────────────────────────────────────────

append "# Shiki Token Service — Benchmark Report"
append ""
append "| Field | Value |"
append "|---|---|"
append "| Date | $(date '+%Y-%m-%d %H:%M:%S %Z') |"
append "| API URL | \`$BASE_URL\` |"
append "| API Version | \`$API_VERSION\` |"
append "| Iterations per test | $ITERATIONS |"
append "| OS | $(uname -s) $(uname -m) |"
append "| Script | \`scripts/benchmark.sh\` |"
append ""
append "> All requests sent with \`debug: true\` — tokenizer timing comes from the server response body."
append ""

# ── Table header helper ───────────────────────────────────────────────────────

append_table_header() {
  append "| Language | Size | File Bytes | Lines | Req Bytes | Resp Bytes | Token Lines | Total Tokens | Avg RTT ms | Min ms | Max ms | Server ms | Tokenizer ms |"
  append "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
}

# ── Core benchmark function ───────────────────────────────────────────────────
#
# run_test <label> <endpoint> <fixture_file> <language> [extra_jq_args]
#
# Builds a JSON payload from the fixture file using jq --rawfile (safe for
# any source code content). Runs ITERATIONS curl requests and collects:
#   - round-trip time (time_total)
#   - response body bytes
#   - _debug.totalMs, _debug.tokenizerMs, _debug.requestBodyBytes (from JSON)
#   - token line count and total token count (from JSON)
#
# Appends a markdown table row to REPORT_LINES.
# ─────────────────────────────────────────────────────────────────────────────

run_test() {
  local label="$1"
  local endpoint="$2"
  local fixture_file="$3"
  local language="$4"
  local extra_jq="${5:-}"   # optional jq filter additions (e.g. for dual themes)

  local size_label
  case "$fixture_file" in
    *-medium*) size_label="medium" ;;
    *-large*)  size_label="large"  ;;
    *)         size_label="?"      ;;
  esac

  # File stats
  local file_bytes line_count
  file_bytes="$(wc -c < "$fixture_file" | tr -d ' ')"
  line_count="$(wc -l < "$fixture_file" | tr -d ' ')"

  # Build payload — jq --rawfile reads the fixture as a raw string (no escaping needed)
  local payload_file="$TMP_DIR/payload_${language}_${size_label}_$(basename "$endpoint").json"

  if [[ -z "$extra_jq" ]]; then
    jq -Rrs \
      --arg lang "$language" \
      '{code: ., language: $lang, theme: "github-dark", debug: true}' \
      "$fixture_file" > "$payload_file"
  else
    jq -Rrs \
      --arg lang "$language" \
      "$extra_jq" \
      "$fixture_file" > "$payload_file"
  fi

  local req_bytes
  req_bytes="$(wc -c < "$payload_file" | tr -d ' ')"

  # ── Run iterations ────────────────────────────────────────────────────────

  local sum_rtt=0 min_rtt="" max_rtt=""
  local last_resp_file="$TMP_DIR/response_last.json"
  local resp_bytes=0

  for i in $(seq 1 "$ITERATIONS"); do
    local resp_tmp="$TMP_DIR/resp_$i.json"
    local time_ms

    # -s silent, -o response body, -w write-out for timing
    local raw_time
    raw_time="$(curl -sf -X POST "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      --data-binary "@$payload_file" \
      -o "$resp_tmp" \
      -w "%{time_total}" 2>/dev/null || echo "0")"

    # Convert fractional seconds → integer ms
    time_ms="$(echo "scale=0; $raw_time * 1000 / 1" | bc)"

    sum_rtt="$(echo "$sum_rtt + $time_ms" | bc)"

    [[ -z "$min_rtt" || "$time_ms" -lt "$min_rtt" ]] && min_rtt="$time_ms"
    [[ -z "$max_rtt" || "$time_ms" -gt "$max_rtt" ]] && max_rtt="$time_ms"

    # Keep last response for parsing
    cp "$resp_tmp" "$last_resp_file"
    resp_bytes="$(wc -c < "$resp_tmp" | tr -d ' ')"
  done

  local avg_rtt
  avg_rtt="$(echo "scale=0; $sum_rtt / $ITERATIONS" | bc)"

  # ── Parse final response ─────────────────────────────────────────────────

  local server_total_ms tokenizer_ms req_body_bytes_server token_lines total_tokens
  server_total_ms="$(jq -r '._debug.totalMs // "n/a"' "$last_resp_file" 2>/dev/null || echo "n/a")"
  tokenizer_ms="$(jq -r '._debug.tokenizerMs // "n/a"' "$last_resp_file" 2>/dev/null || echo "n/a")"
  token_lines="$(jq -r '.tokens | length' "$last_resp_file" 2>/dev/null || echo "0")"
  total_tokens="$(jq -r '[.tokens[] | length] | add // 0' "$last_resp_file" 2>/dev/null || echo "0")"

  # Format server_total_ms and tokenizer_ms as integers for cleaner table
  if [[ "$server_total_ms" != "n/a" ]]; then
    server_total_ms="$(echo "scale=0; $server_total_ms / 1" | bc)"
  fi
  if [[ "$tokenizer_ms" != "n/a" ]]; then
    tokenizer_ms="$(echo "scale=0; $tokenizer_ms / 1" | bc)"
  fi

  append "| $language | $size_label | $file_bytes | $line_count | $req_bytes | $resp_bytes | $token_lines | $total_tokens | $avg_rtt | $min_rtt | $max_rtt | $server_total_ms | $tokenizer_ms |"

  printf "  %-22s  %-8s  RTT: avg=%sms min=%sms max=%sms  tokenizer=%sms\n" \
    "$language" "$size_label" "$avg_rtt" "$min_rtt" "$max_rtt" "$tokenizer_ms"
}

# ── Test fixtures list ────────────────────────────────────────────────────────

declare -a FIXTURES=(
  "kotlin:$FIXTURES_DIR/kotlin-medium.kt"
  "kotlin:$FIXTURES_DIR/kotlin-large.kt"
  "typescript:$FIXTURES_DIR/typescript-medium.ts"
  "typescript:$FIXTURES_DIR/typescript-large.ts"
  "python:$FIXTURES_DIR/python-medium.py"
  "python:$FIXTURES_DIR/python-large.py"
  "sql:$FIXTURES_DIR/sql-medium.sql"
  "sql:$FIXTURES_DIR/sql-large.sql"
)

# ── /highlight ────────────────────────────────────────────────────────────────

echo "── /highlight ───────────────────────────────────────────────"
append "## \`POST /highlight\`"
append ""
append "Single-theme tokenization (theme: \`github-dark\`)."
append ""
append_table_header

for entry in "${FIXTURES[@]}"; do
  lang="${entry%%:*}"
  fixture="${entry#*:}"
  run_test "$lang" "/highlight" "$fixture" "$lang"
done

append ""

# ── /highlight/dual ───────────────────────────────────────────────────────────

echo ""
echo "── /highlight/dual ──────────────────────────────────────────"
append "## \`POST /highlight/dual\`"
append ""
append "Dual-theme tokenization (dark: \`github-dark\`, light: \`github-light\`)."
append ""
append_table_header

DUAL_JQ='{code: ., language: $lang, darkTheme: "github-dark", lightTheme: "github-light", debug: true}'
for entry in "${FIXTURES[@]}"; do
  lang="${entry%%:*}"
  fixture="${entry#*:}"
  run_test "$lang" "/highlight/dual" "$fixture" "$lang" "$DUAL_JQ"
done

append ""

# ── /highlight/semantic ───────────────────────────────────────────────────────

echo ""
echo "── /highlight/semantic ──────────────────────────────────────"
append "## \`POST /highlight/semantic\`"
append ""
append "Theme-independent semantic tokenization (token types, no colors)."
append ""
append_table_header

SEM_JQ='{code: ., language: $lang, debug: true}'
for entry in "${FIXTURES[@]}"; do
  lang="${entry%%:*}"
  fixture="${entry#*:}"
  run_test "$lang" "/highlight/semantic" "$fixture" "$lang" "$SEM_JQ"
done

append ""

# ── Summary ───────────────────────────────────────────────────────────────────

append "## Notes"
append ""
append "- **RTT (Round-Trip Time)**: Measured by curl \`time_total\` in ms, includes network latency."
append "- **Server ms**: \`_debug.totalMs\` from response body — server wall-clock time in ms."
append "- **Tokenizer ms**: \`_debug.tokenizerMs\` from response body — time spent in the Shiki tokenizer."
append "- **Token Lines**: Number of source code lines in the tokenized output (\`tokens.length\`)."
append "- **Total Tokens**: Sum of all tokens across all lines."
append "- **Req Bytes**: JSON payload size sent (includes \`debug: true\` and metadata)."
append "- **Resp Bytes**: Full JSON response body size."
append "- Iterations per test: **$ITERATIONS** — avg/min/max computed over all iterations."

# ── Write report ──────────────────────────────────────────────────────────────

{
  for line in "${REPORT_LINES[@]}"; do
    echo "$line"
  done
} > "$REPORT_FILE"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo " Report written to:"
echo "   $REPORT_FILE"
echo "══════════════════════════════════════════════════════════════"
