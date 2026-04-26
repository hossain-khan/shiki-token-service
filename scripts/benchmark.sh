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
HTML_REPORT_FILE="$REPORTS_DIR/benchmark-$TIMESTAMP.html"
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
DATA_JSON_ROWS=()
CURRENT_ENDPOINT=""

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

  # JSON-safe values (convert "n/a" to null for the HTML report)
  local sm_json tm_json
  [[ "$server_total_ms" == "n/a" ]] && sm_json="null" || sm_json="$server_total_ms"
  [[ "$tokenizer_ms"    == "n/a" ]] && tm_json="null" || tm_json="$tokenizer_ms"
  DATA_JSON_ROWS+=("{\"endpoint\":\"$CURRENT_ENDPOINT\",\"language\":\"$language\",\"size\":\"$size_label\",\"fileBytes\":$file_bytes,\"lines\":$line_count,\"reqBytes\":$req_bytes,\"respBytes\":$resp_bytes,\"tokenLines\":$token_lines,\"totalTokens\":$total_tokens,\"avgRtt\":$avg_rtt,\"minRtt\":$min_rtt,\"maxRtt\":$max_rtt,\"serverMs\":$sm_json,\"tokenizerMs\":$tm_json}")

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

CURRENT_ENDPOINT="/highlight"
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
CURRENT_ENDPOINT="/highlight/dual"
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
CURRENT_ENDPOINT="/highlight/semantic"
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

# ── HTML report generator ─────────────────────────────────────────────────────

generate_html_report() {
  local html_file="$1"
  local run_date="$2"
  local api_url="$3"
  local api_version="$4"
  local iterations="$5"

  # Join collected JSON rows into a JS array literal
  local data_js=""
  if [[ ${#DATA_JSON_ROWS[@]} -gt 0 ]]; then
    local IFS=','
    data_js="${DATA_JSON_ROWS[*]}"
  fi

  # ── Part 1: Static HTML head + CSS ──────────────────────────────────────────
  cat << 'EOHTML_HEAD' > "$html_file"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shiki Token Service — Benchmark Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f8fa;color:#1e293b;line-height:1.5;min-width:320px}
header{background:#0f172a;color:#fff;padding:2rem 2.5rem}
header h1{font-size:1.4rem;font-weight:700;letter-spacing:-.01em}
.meta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem;margin-top:1.25rem}
.meta-item{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:.75rem 1rem}
.meta-item .lbl{font-size:.7rem;opacity:.55;text-transform:uppercase;letter-spacing:.06em}
.meta-item .val{font-size:.95rem;font-weight:600;margin-top:.2rem;font-family:ui-monospace,monospace;word-break:break-all}
main{max-width:1400px;margin:0 auto;padding:2rem 1.5rem}
.section-title{font-size:.95rem;font-weight:700;color:#0f172a;margin:2.5rem 0 1rem;padding-bottom:.5rem;border-bottom:2px solid #e2e8f0;display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}
.section-title code{background:#e0f2fe;color:#0369a1;padding:.15em .5em;border-radius:4px;font-size:.88em;font-family:ui-monospace,monospace}
.section-title .desc{font-weight:400;font-size:.82rem;color:#64748b}
.chart-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.25rem;margin-bottom:2.5rem}
@media(max-width:860px){.chart-grid{grid-template-columns:1fr}}
.chart-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem 1.5rem;box-shadow:0 1px 4px rgba(0,0,0,.05)}
.chart-card h3{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:1rem}
.tbl-wrap{overflow-x:auto;margin-bottom:2rem;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.05)}
table{width:100%;border-collapse:collapse;font-size:.82rem;background:#fff;border:1px solid #e2e8f0;min-width:820px}
thead th{background:#f8fafc;padding:.6rem .9rem;text-align:left;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#475569;border-bottom:2px solid #e2e8f0;white-space:nowrap}
thead th.r{text-align:right}
tbody td{padding:.5rem .9rem;border-bottom:1px solid #f1f5f9;color:#1e293b}
tbody td.r{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace;font-size:.8rem}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#f8fafc}
.pill{display:inline-block;padding:.15em .55em;border-radius:4px;font-size:.73em;font-weight:700;letter-spacing:.02em}
.pill-medium{background:#dbeafe;color:#1d4ed8}
.pill-large{background:#fef3c7;color:#92400e}
.pill-kotlin{background:#ede9fe;color:#5b21b6}
.pill-typescript{background:#dbeafe;color:#1e40af}
.pill-python{background:#dcfce7;color:#166534}
.pill-sql{background:#fee2e2;color:#9f1239}
.note-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:1rem 1.25rem;font-size:.82rem;color:#0c4a6e;margin-bottom:2rem;line-height:1.7}
.note-box strong{font-weight:600}
footer{text-align:center;padding:1.5rem 2rem;font-size:.78rem;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:2rem}
footer code{color:#64748b;font-family:ui-monospace,monospace}
</style>
</head>
<body>
<header>
  <h1>Shiki Token Service &mdash; Benchmark Report</h1>
  <div class="meta-grid" id="metaGrid"></div>
</header>
<main>
  <div class="section-title">Performance Charts</div>
  <div class="chart-grid">
    <div class="chart-card"><h3>Avg Round-Trip Time (ms) &mdash; All Endpoints</h3><canvas id="chartRtt"></canvas></div>
    <div class="chart-card"><h3>Response Size (KB) &mdash; All Endpoints</h3><canvas id="chartRespSize"></canvas></div>
    <div class="chart-card"><h3>Total Tokens per Fixture</h3><canvas id="chartTokens"></canvas></div>
    <div class="chart-card"><h3>RTT Range &mdash; /highlight &nbsp;(min / avg / max)</h3><canvas id="chartRttRange"></canvas></div>
  </div>
  <div id="tables"></div>
  <div class="note-box" id="notesBox"></div>
</main>
<footer>Generated by <code>scripts/benchmark.sh</code> &bull; Shiki Token Service v<span id="apiVer"></span></footer>
EOHTML_HEAD

  # ── Part 2: Injected run-time data (variable expansion enabled) ─────────────
  cat << EOHTML_DATA >> "$html_file"
<script>
const META = {
  runDate:    "$run_date",
  apiUrl:     "$api_url",
  apiVersion: "$api_version",
  iterations: $iterations
};
const DATA = [$data_js];
</script>
EOHTML_DATA

  # ── Part 3: Static chart + table JS and closing tags ─────────────────────────
  # Single-quoted heredoc — $ characters are literal JavaScript, not bash vars.
  cat << 'EOHTML_TAIL' >> "$html_file"
<script>
// ── Meta grid ─────────────────────────────────────────────────────────────────
document.getElementById('metaGrid').innerHTML = [
  { lbl: 'Date',       val: META.runDate },
  { lbl: 'API URL',    val: META.apiUrl },
  { lbl: 'Version',    val: META.apiVersion },
  { lbl: 'Iterations', val: META.iterations },
].map(m => `<div class="meta-item"><div class="lbl">${m.lbl}</div><div class="val">${m.val}</div></div>`).join('');
document.getElementById('apiVer').textContent = META.apiVersion;

// ── Chart helpers ─────────────────────────────────────────────────────────────
const ENDPOINTS  = ['/highlight', '/highlight/dual', '/highlight/semantic'];
const EP_LABELS  = ['highlight', 'highlight/dual', 'highlight/semantic'];
const EP_COLORS  = ['rgba(59,130,246,0.8)',  'rgba(245,158,11,0.8)', 'rgba(34,197,94,0.8)'];
const EP_BORDERS = ['#3b82f6', '#f59e0b', '#22c55e'];
const FX_LABELS  = ['Kotlin Med','Kotlin Lg','TS Med','TS Lg','Python Med','Python Lg','SQL Med','SQL Lg'];

function epData(ep, field) {
  return DATA.filter(d => d.endpoint === ep).map(d => d[field]);
}

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { position: 'top', labels: { boxWidth: 11, font: { size: 11 } } } },
  scales: {
    x: { ticks: { font: { size: 10 } }, grid: { display: false } },
    y: { beginAtZero: true, ticks: { font: { size: 10 } }, grid: { color: '#f1f5f9' } }
  }
};

function mkDatasets(field, xform) {
  return ENDPOINTS.map((ep, i) => ({
    label: EP_LABELS[i],
    data: epData(ep, field).map(v => xform ? xform(v) : v),
    backgroundColor: EP_COLORS[i],
    borderColor: EP_BORDERS[i],
    borderWidth: 1.5,
    borderRadius: 3,
  }));
}

function yTitle(text) {
  return { ...BASE_OPTS, scales: { ...BASE_OPTS.scales,
    y: { ...BASE_OPTS.scales.y, title: { display: true, text, font: { size: 10 } } } } };
}

// Chart 1: Avg RTT — all endpoints
new Chart(document.getElementById('chartRtt'), {
  type: 'bar',
  data: { labels: FX_LABELS, datasets: mkDatasets('avgRtt') },
  options: yTitle('ms'),
});

// Chart 2: Response size — all endpoints
new Chart(document.getElementById('chartRespSize'), {
  type: 'bar',
  data: { labels: FX_LABELS, datasets: mkDatasets('respBytes', v => +(v / 1024).toFixed(1)) },
  options: yTitle('KB'),
});

// Chart 3: Total tokens (/highlight only — same code, same token count across endpoints)
const hlData = DATA.filter(d => d.endpoint === '/highlight');
new Chart(document.getElementById('chartTokens'), {
  type: 'bar',
  data: {
    labels: FX_LABELS,
    datasets: [{
      label: 'Total Tokens',
      data: hlData.map(d => d.totalTokens),
      backgroundColor: 'rgba(99,102,241,0.8)',
      borderColor: '#6366f1',
      borderWidth: 1.5,
      borderRadius: 3,
    }],
  },
  options: { ...yTitle('Tokens'), plugins: { legend: { display: false } } },
});

// Chart 4: RTT min / avg / max for /highlight
new Chart(document.getElementById('chartRttRange'), {
  type: 'bar',
  data: {
    labels: FX_LABELS,
    datasets: [
      { label: 'Min', data: hlData.map(d => d.minRtt), backgroundColor: 'rgba(52,211,153,0.8)',  borderColor: '#34d399', borderWidth: 1.5, borderRadius: 3 },
      { label: 'Avg', data: hlData.map(d => d.avgRtt), backgroundColor: 'rgba(59,130,246,0.8)',  borderColor: '#3b82f6', borderWidth: 1.5, borderRadius: 3 },
      { label: 'Max', data: hlData.map(d => d.maxRtt), backgroundColor: 'rgba(251,113,133,0.8)', borderColor: '#fb7185', borderWidth: 1.5, borderRadius: 3 },
    ],
  },
  options: yTitle('ms'),
});

// ── Data tables (one per endpoint) ────────────────────────────────────────────
const EP_DESC = {
  '/highlight':          'Single-theme tokenization (theme: github-dark)',
  '/highlight/dual':     'Dual-theme tokenization (dark: github-dark, light: github-light)',
  '/highlight/semantic': 'Theme-independent semantic tokenization (token types, no colors)',
};

function fmt(n)  { return n == null ? 'n/a' : Number(n).toLocaleString(); }
function kb(n)   { return n == null ? 'n/a' : (n / 1024).toFixed(1) + ' KB'; }

const tablesEl = document.getElementById('tables');
ENDPOINTS.forEach(ep => {
  const rows  = DATA.filter(d => d.endpoint === ep);
  const title = ep.replace('/highlight', 'POST /highlight');
  tablesEl.innerHTML += `
    <div class="section-title">
      <code>${title}</code>
      <span class="desc">${EP_DESC[ep]}</span>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>Language</th><th>Size</th>
        <th class="r">File Bytes</th><th class="r">Lines</th>
        <th class="r">Req Bytes</th><th class="r">Resp Bytes</th>
        <th class="r">Token Lines</th><th class="r">Total Tokens</th>
        <th class="r">Avg RTT ms</th><th class="r">Min ms</th><th class="r">Max ms</th>
        <th class="r">Server ms</th><th class="r">Tokenizer ms</th>
      </tr></thead>
      <tbody>
        ${rows.map(d => `<tr>
          <td><span class="pill pill-${d.language}">${d.language}</span></td>
          <td><span class="pill pill-${d.size}">${d.size}</span></td>
          <td class="r">${fmt(d.fileBytes)}</td>
          <td class="r">${fmt(d.lines)}</td>
          <td class="r">${fmt(d.reqBytes)}</td>
          <td class="r">${kb(d.respBytes)}</td>
          <td class="r">${fmt(d.tokenLines)}</td>
          <td class="r">${fmt(d.totalTokens)}</td>
          <td class="r"><strong>${fmt(d.avgRtt)}</strong></td>
          <td class="r">${fmt(d.minRtt)}</td>
          <td class="r">${fmt(d.maxRtt)}</td>
          <td class="r">${d.serverMs   == null ? 'n/a' : fmt(d.serverMs)}</td>
          <td class="r">${d.tokenizerMs == null ? 'n/a' : fmt(d.tokenizerMs)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
});

// ── Notes ─────────────────────────────────────────────────────────────────────
document.getElementById('notesBox').innerHTML = `
  <strong>Notes:</strong><br>
  &bull; <strong>RTT</strong>: Full client round-trip time measured by curl <code>time_total</code>, includes network latency.<br>
  &bull; <strong>Server ms</strong>: <code>_debug.totalMs</code> — server wall-clock time from the response body (<code>debug: true</code>).<br>
  &bull; <strong>Tokenizer ms</strong>: <code>_debug.tokenizerMs</code> — time spent inside the Shiki tokenizer on the server.<br>
  &bull; <strong>Token Lines / Total Tokens</strong>: parsed from the response <code>tokens</code> array.<br>
  &bull; Iterations per test: <strong>${META.iterations}</strong>. Avg / min / max computed over all iterations.
`;
</script>
</body>
</html>
EOHTML_TAIL
}

# ── Write markdown report ──────────────────────────────────────────────────────

{
  for line in "${REPORT_LINES[@]}"; do
    echo "$line"
  done
} > "$REPORT_FILE"

# ── Write HTML report ─────────────────────────────────────────────────────────

RUN_DATE="$(date '+%Y-%m-%d %H:%M:%S %Z')"
generate_html_report "$HTML_REPORT_FILE" "$RUN_DATE" "$BASE_URL" "$API_VERSION" "$ITERATIONS"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo " Reports written to:"
echo "   $REPORT_FILE"
echo "   $HTML_REPORT_FILE"
echo "══════════════════════════════════════════════════════════════"
