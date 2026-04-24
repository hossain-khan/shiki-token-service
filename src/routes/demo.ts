import { Hono } from "hono";

const app = new Hono();

const SNIPPETS_JSON = JSON.stringify({
  kotlin: {
    lang: "kotlin",
    code: 'data class User(val id: Long, val name: String, val age: Int)\n\nclass UserRepo(private val db: Database) {\n\n    suspend fun findById(id: Long): User? =\n        db.query("SELECT * FROM users WHERE id = ?", id)\n            .map { User(it["id"], it["name"], it["age"]) }\n            .firstOrNull()\n\n    suspend fun findAdults(): List<User> =\n        db.query("SELECT * FROM users WHERE age >= 18")\n            .map { User(it["id"], it["name"], it["age"]) }\n}',
  },
  typescript: {
    lang: "typescript",
    code: "interface ApiResponse<T> {\n  data: T;\n  status: number;\n  message: string;\n}\n\nasync function fetchData<T>(url: string): Promise<ApiResponse<T>> {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error('HTTP ' + res.status);\n  return res.json() as ApiResponse<T>;\n}\n\n// Usage\nconst result = await fetchData<{ id: number; name: string }>('/api/user');",
  },
  python: {
    lang: "python",
    code: 'from dataclasses import dataclass, field\nfrom typing import Optional, List\n\n@dataclass\nclass Config:\n    host: str = "localhost"\n    port: int = 8080\n    debug: bool = False\n    allowed_origins: List[str] = field(default_factory=list)\n\ndef create_app(config: Optional[Config] = None) -> None:\n    cfg = config or Config()\n    print(f"Starting on {cfg.host}:{cfg.port}")\n    if cfg.debug:\n        print("Debug mode enabled")',
  },
  sql: {
    lang: "sql",
    code: "SELECT\n    u.name,\n    COUNT(o.id)       AS order_count,\n    SUM(o.total)      AS total_spent,\n    MAX(o.created_at) AS last_order\nFROM users u\nLEFT JOIN orders o\n    ON u.id = o.user_id\n   AND o.status = 'completed'\nWHERE u.created_at >= '2024-01-01'\nGROUP BY u.id, u.name\nHAVING total_spent > 1000\nORDER BY total_spent DESC\nLIMIT 20;",
  },
  json: {
    lang: "json",
    code: '{\n  "code": "const greet = (name) => console.log(name);",\n  "language": "javascript",\n  "darkTheme": "github-dark",\n  "lightTheme": "github-light",\n  "debug": true\n}',
  },
  bash: {
    lang: "shellscript",
    code: '#!/bin/bash\nset -euo pipefail\n\nAPI=\'https://syntax-highlight.gohk.xyz\'\n\ncurl -s "$API/highlight" \\\n  -X POST \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"code":"print(42)","language":"python","theme":"github-dark"}\'',
  },
}).replace(/<\//g, "<\\/");

app.get("/demo", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shiki Token Service · Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f111a; color: #cdd6f4; min-height: 100vh;
      display: flex; flex-direction: column;
    }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 24px; background: #13151f; border-bottom: 1px solid #2a2d3e;
      flex-shrink: 0;
    }
    header h1 { font-size: 0.97rem; font-weight: 600; letter-spacing: -0.01em; }
    header h1 span { color: #89b4fa; }
    header nav { display: flex; gap: 16px; }
    header nav a {
      font-size: 0.8rem; color: #89b4fa; text-decoration: none; opacity: 0.7;
      transition: opacity 0.15s;
    }
    header nav a:hover { opacity: 1; }
    .controls {
      padding: 10px 24px; background: #13151f; border-bottom: 1px solid #2a2d3e;
      display: flex; flex-wrap: wrap; gap: 10px; align-items: center; flex-shrink: 0;
    }
    .mode-tabs { display: flex; background: #1e2030; border-radius: 7px; padding: 3px; gap: 2px; }
    .mode-tab {
      padding: 5px 13px; border: none; background: transparent; color: #7f849c;
      font-size: 0.8rem; cursor: pointer; border-radius: 5px; transition: all 0.15s; white-space: nowrap;
    }
    .mode-tab.active { background: #89b4fa; color: #1e2030; font-weight: 600; }
    .mode-tab:hover:not(.active) { color: #cdd6f4; background: #2a2d3e; }
    .ctrl-group { display: flex; align-items: center; gap: 6px; }
    .ctrl-group label { font-size: 0.75rem; color: #7f849c; white-space: nowrap; }
    select {
      background: #1e2030; border: 1px solid #313244; color: #cdd6f4;
      padding: 5px 26px 5px 9px; font-size: 0.8rem; border-radius: 6px; cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237f849c' d='M5 7L0 2h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 7px center; min-width: 110px;
    }
    select:focus { outline: none; border-color: #89b4fa; }
    .dual-view { display: flex; background: #1e2030; border-radius: 6px; border: 1px solid #313244; overflow: hidden; }
    .dual-view button {
      padding: 5px 10px; border: none; background: transparent; color: #7f849c;
      font-size: 0.75rem; cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .dual-view button.active { background: #313244; color: #cdd6f4; }
    .sem-note { font-size: 0.75rem; color: #585b70; font-style: italic; }
    .main { flex: 1; display: flex; flex-direction: column; gap: 12px; padding: 16px 24px 10px; }
    .input-hdr { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .input-hdr .lbl { font-size: 0.75rem; color: #7f849c; display: flex; align-items: center; gap: 8px; }
    kbd {
      font-size: 0.67rem; background: #1e2030; border: 1px solid #313244;
      border-radius: 4px; padding: 1px 5px; color: #585b70; font-family: inherit;
    }
    textarea {
      width: 100%; height: 175px; background: #1e2030; border: 1px solid #313244; color: #cdd6f4;
      font-family: 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, monospace;
      font-size: 12.5px; line-height: 1.65; padding: 12px 14px; border-radius: 8px; resize: vertical; tab-size: 2;
    }
    textarea:focus { outline: none; border-color: #89b4fa; }
    .action-row { display: flex; align-items: center; gap: 12px; }
    .btn { padding: 8px 20px; border: none; border-radius: 7px; font-size: 0.83rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
    .btn-primary { background: #89b4fa; color: #1e2030; }
    .btn-primary:hover { opacity: 0.88; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    #status    { font-size: 0.78rem; color: #a6e3a1; }
    #error-msg { font-size: 0.78rem; color: #f38ba8; }
    .output-section { display: flex; flex-direction: column; gap: 7px; flex: 1; }
    .output-hdr { display: flex; align-items: center; justify-content: space-between; min-height: 22px; }
    .output-hdr > span { font-size: 0.75rem; color: #7f849c; }
    #sem-legend { display: none; flex-wrap: wrap; gap: 4px; }
    .badge { font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; background: #1e2030; border: 1px solid #313244; font-family: monospace; }
    #output-wrap { border-radius: 10px; overflow: hidden; border: 1px solid #313244; background: #1e1e1e; transition: background 0.2s; }
    pre#output {
      margin: 0; padding: 15px 18px;
      font-family: 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, monospace;
      font-size: 12.5px; line-height: 1.7; overflow-x: auto; min-height: 150px; white-space: pre;
    }
    pre#output .placeholder { color: #45475a; font-style: italic; }
    .sem-keyword     { color: #569cd6; }
    .sem-type        { color: #4ec9b0; }
    .sem-modifier    { color: #569cd6; }
    .sem-function    { color: #dcdcaa; }
    .sem-tag         { color: #4ec9b0; }
    .sem-attribute   { color: #9cdcfe; }
    .sem-parameter   { color: #9cdcfe; }
    .sem-variable    { color: #9cdcfe; }
    .sem-number      { color: #b5cea8; }
    .sem-constant    { color: #4fc1ff; }
    .sem-string      { color: #ce9178; }
    .sem-comment     { color: #6a9955; font-style: italic; }
    .sem-punctuation { color: #808080; }
    .sem-plain       { color: #d4d4d4; }
    [class^="sem-"] { cursor: default; }
    [class^="sem-"]:hover { outline: 1px dashed currentColor; border-radius: 2px; }
    footer {
      padding: 9px 24px; background: #13151f; border-top: 1px solid #2a2d3e;
      display: flex; gap: 18px; align-items: center; flex-wrap: wrap; flex-shrink: 0;
    }
    .metric { display: flex; flex-direction: column; gap: 1px; }
    .metric-lbl { font-size: 0.65rem; color: #45475a; text-transform: uppercase; letter-spacing: 0.06em; }
    .metric-val { font-size: 0.82rem; font-weight: 600; color: #cdd6f4; font-variant-numeric: tabular-nums; }
    .metric-val.dim { color: #45475a; }
    .sep { width: 1px; height: 26px; background: #2a2d3e; flex-shrink: 0; }
  </style>
</head>
<body>
<header>
  <h1>Shiki Token Service <span>· Demo</span></h1>
  <nav>
    <a href="/languages">Languages API</a>
    <a href="/docs">API Docs →</a>
  </nav>
</header>
<div class="controls">
  <div class="mode-tabs">
    <button class="mode-tab active" data-mode="single">Single Theme</button>
    <button class="mode-tab" data-mode="dual">Dual Theme</button>
    <button class="mode-tab" data-mode="semantic">Semantic</button>
  </div>
  <div class="ctrl-group">
    <label>Language</label>
    <select id="lang-select"><option>kotlin</option></select>
  </div>
  <div id="ctrl-single" class="ctrl-group">
    <label>Theme</label>
    <select id="theme-select"></select>
  </div>
  <div id="ctrl-dual" class="ctrl-group" style="display:none">
    <label>Dark</label>
    <select id="dark-theme"></select>
    <label>Light</label>
    <select id="light-theme"></select>
    <div class="dual-view">
      <button id="view-dark" class="active">🌙 Dark</button>
      <button id="view-light">☀️ Light</button>
    </div>
  </div>
  <span id="ctrl-sem-note" class="sem-note" style="display:none">Theme-independent — uses TextMate scope analysis</span>
</div>
<div class="main">
  <div class="input-hdr">
    <div class="lbl">Code Input <kbd>⌘ ↵ highlight</kbd></div>
    <div class="ctrl-group">
      <label>Sample:</label>
      <select id="preset-select">
        <option value="">— pick a snippet —</option>
        <option value="kotlin">Kotlin</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="sql">SQL</option>
        <option value="json">JSON</option>
        <option value="bash">Bash</option>
      </select>
    </div>
  </div>
  <textarea id="code-input" spellcheck="false" autocorrect="off" autocomplete="off" placeholder="Paste code here…"></textarea>
  <div class="action-row">
    <button class="btn btn-primary" id="btn-highlight">Highlight →</button>
    <span id="status"></span>
    <span id="error-msg"></span>
  </div>
  <div class="output-section">
    <div class="output-hdr">
      <span id="output-label">Output</span>
      <div id="sem-legend"></div>
    </div>
    <div id="output-wrap">
      <pre id="output"><span class="placeholder">Highlighted tokens will appear here.</span></pre>
    </div>
  </div>
</div>
<footer>
  <div class="metric"><div class="metric-lbl">Tokenizer</div><div class="metric-val dim" id="m-tok">—</div></div>
  <div class="sep"></div>
  <div class="metric"><div class="metric-lbl">Server total</div><div class="metric-val dim" id="m-srv">—</div></div>
  <div class="sep"></div>
  <div class="metric"><div class="metric-lbl">Round-trip</div><div class="metric-val dim" id="m-rtt">—</div></div>
  <div class="sep"></div>
  <div class="metric"><div class="metric-lbl">Lines</div><div class="metric-val dim" id="m-lines">—</div></div>
  <div class="sep"></div>
  <div class="metric"><div class="metric-lbl">Tokens</div><div class="metric-val dim" id="m-toks">—</div></div>
  <div class="sep"></div>
  <div class="metric"><div class="metric-lbl">Request size</div><div class="metric-val dim" id="m-size">—</div></div>
  <div class="sep"></div>
  <div class="metric"><div class="metric-lbl">Endpoint</div><div class="metric-val dim" id="m-ep">—</div></div>
</footer>
<script>
  var PRESETS  = ${SNIPPETS_JSON};
  var THEME_BG = { 'github-dark':'#0d1117','github-light':'#ffffff','one-dark-pro':'#282c34','dracula':'#282a36','min-light':'#f8f8f8','dark-plus':'#1e1e1e','light-plus':'#ffffff' };
  var mode = 'single', dualView = 'dark';
  var langSel=document.getElementById('lang-select'), themeSel=document.getElementById('theme-select'),
      darkSel=document.getElementById('dark-theme'), lightSel=document.getElementById('light-theme'),
      codeIn=document.getElementById('code-input'), output=document.getElementById('output'),
      outputWrap=document.getElementById('output-wrap'), btnHL=document.getElementById('btn-highlight'),
      statusEl=document.getElementById('status'), errEl=document.getElementById('error-msg'),
      semLegend=document.getElementById('sem-legend'), outLabel=document.getElementById('output-label');
  function loadMeta() {
    return fetch('/languages').then(function(r){return r.json();}).then(function(d){
      langSel.innerHTML=d.languages.map(function(l){return '<option value="'+l+'">'+l+'</option>';}).join('');
      langSel.value='kotlin';
      var to=d.themes.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');
      themeSel.innerHTML=to; themeSel.value='github-dark';
      darkSel.innerHTML=to;  darkSel.value='github-dark';
      lightSel.innerHTML=to; lightSel.value='github-light';
    }).catch(function(){errEl.textContent='Failed to load API metadata';});
  }
  document.querySelectorAll('.mode-tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.mode-tab').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active'); mode=btn.getAttribute('data-mode');
      document.getElementById('ctrl-single').style.display  =mode==='single'  ?'':'none';
      document.getElementById('ctrl-dual').style.display    =mode==='dual'    ?'':'none';
      document.getElementById('ctrl-sem-note').style.display=mode==='semantic'?'':'none';
      semLegend.style.display=mode==='semantic'?'flex':'none';
      outLabel.textContent=mode==='semantic'?'Semantic Tokens (hover a token to see its type)':'Output';
    });
  });
  document.getElementById('view-dark').addEventListener('click',function(){
    dualView='dark'; document.getElementById('view-dark').classList.add('active');
    document.getElementById('view-light').classList.remove('active'); applyDualTheme();
  });
  document.getElementById('view-light').addEventListener('click',function(){
    dualView='light'; document.getElementById('view-light').classList.add('active');
    document.getElementById('view-dark').classList.remove('active'); applyDualTheme();
  });
  function applyDualTheme(){
    var spans=output.querySelectorAll('[data-d]');
    if(dualView==='dark'){spans.forEach(function(s){s.style.color=s.getAttribute('data-d')||'';});outputWrap.style.background=THEME_BG[darkSel.value]||'#1e1e1e';}
    else{spans.forEach(function(s){s.style.color=s.getAttribute('data-l')||'';});outputWrap.style.background=THEME_BG[lightSel.value]||'#ffffff';}
  }
  document.getElementById('preset-select').addEventListener('change',function(e){
    var key=e.target.value; if(!key||!PRESETS[key]){e.target.value='';return;}
    codeIn.value=PRESETS[key].code; langSel.value=PRESETS[key].lang; e.target.value='';
  });
  function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  btnHL.addEventListener('click',doHighlight);
  codeIn.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter')doHighlight();});
  function doHighlight(){
    var code=codeIn.value; if(!code.trim())return;
    btnHL.disabled=true; statusEl.textContent='Highlighting…'; errEl.textContent='';
    var lang=langSel.value,url,body;
    if(mode==='single'){url='/highlight';body={code:code,language:lang,theme:themeSel.value,debug:true};}
    else if(mode==='dual'){url='/highlight/dual';body={code:code,language:lang,darkTheme:darkSel.value,lightTheme:lightSel.value,debug:true};}
    else{url='/highlight/semantic';body={code:code,language:lang,debug:true};}
    var t0=performance.now();
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(res){var rtt=performance.now()-t0;return res.json().then(function(data){return{data:data,ok:res.ok,rtt:rtt};});})
      .then(function(r){
        if(!r.ok){errEl.textContent=r.data.error+(r.data.details?': '+r.data.details:'');statusEl.textContent='';return;}
        renderOutput(r.data); updateMetrics(r.data._debug,r.rtt,r.data.tokens,url);
        statusEl.textContent='Done ✓'; setTimeout(function(){statusEl.textContent='';},2000);
      })
      .catch(function(e){errEl.textContent='Request failed: '+e.message;statusEl.textContent='';})
      .finally(function(){btnHL.disabled=false;});
  }
  function renderOutput(data){
    var tokens=data.tokens; semLegend.innerHTML='';
    if(mode==='single'){
      outputWrap.style.background=THEME_BG[data.theme||themeSel.value]||'#1e1e1e';
      output.innerHTML=tokens.map(function(line){return line.map(function(t){return '<span style="color:'+(t.color||'inherit')+'">'+esc(t.text)+'</span>';}).join('');}).join('\\n');
    } else if(mode==='dual'){
      outputWrap.style.background=dualView==='dark'?(THEME_BG[darkSel.value]||'#1e1e1e'):(THEME_BG[lightSel.value]||'#ffffff');
      output.innerHTML=tokens.map(function(line){return line.map(function(t){
        var col=dualView==='dark'?(t.darkColor||''):(t.lightColor||'');
        return '<span data-d="'+esc(t.darkColor||'')+'" data-l="'+esc(t.lightColor||'')+'" style="color:'+col+'">'+esc(t.text)+'</span>';
      }).join('');}).join('\\n');
    } else {
      outputWrap.style.background='#1e1e1e';
      var typesFound={};
      output.innerHTML=tokens.map(function(line){return line.map(function(t){
        typesFound[t.type]=true;
        return '<span class="sem-'+t.type+'" title="'+t.type+'">'+esc(t.text)+'</span>';
      }).join('');}).join('\\n');
      semLegend.style.display='flex';
      Object.keys(typesFound).sort().forEach(function(type){
        var span=document.createElement('span');
        span.className='badge sem-'+type; span.textContent=type; semLegend.appendChild(span);
      });
    }
  }
  function updateMetrics(debug,rtt,tokens,endpoint){
    var lines=tokens?tokens.length:0;
    var toks=tokens?tokens.reduce(function(s,l){return s+l.length;},0):0;
    ['m-tok','m-srv','m-rtt','m-lines','m-toks','m-size','m-ep'].forEach(function(id){document.getElementById(id).classList.remove('dim');});
    document.getElementById('m-tok').textContent  =debug&&debug.tokenizerMs  !=null?debug.tokenizerMs  +' ms':'—';
    document.getElementById('m-srv').textContent  =debug&&debug.totalMs      !=null?debug.totalMs      +' ms':'—';
    document.getElementById('m-rtt').textContent  =Math.round(rtt)+' ms';
    document.getElementById('m-lines').textContent=String(lines);
    document.getElementById('m-toks').textContent =String(toks);
    document.getElementById('m-size').textContent =debug&&debug.requestBodyBytes!=null?(debug.requestBodyBytes/1024).toFixed(1)+' KB':'—';
    document.getElementById('m-ep').textContent   =endpoint||'—';
  }
  loadMeta().then(function(){codeIn.value=PRESETS.kotlin.code;langSel.value='kotlin';});
</script>
</body>
</html>`;
  return c.html(html);
});

export default app;
