/* motion-deck diagram and chart language. One global: window.MotionDiagram (version, mount, update, steps, kinds). See references/diagrams.md. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const VERSION = 1;
  const KINDS = ['box', 'pill', 'chip', 'diamond', 'text', 'group', 'stack', 'person', 'cylinder', 'cloud', 'dot', 'ring', 'spinner', 'ghost', 'badge', 'bars', 'line', 'donut', 'gauge', 'kpi'];
  const SYN = { database: 'cylinder', db: 'cylinder', store: 'cylinder', storage: 'cylinder', decision: 'diamond', choice: 'diamond', condition: 'diamond', user: 'person', human: 'person', actor: 'person', progress: 'ring', loader: 'spinner', loading: 'spinner', number: 'kpi', metric: 'kpi', stat: 'kpi', bar: 'bars', barchart: 'bars', chart: 'bars', lines: 'line', pie: 'donut', frame: 'group', container: 'group', rect: 'box', node: 'box', service: 'box', label: 'text', placeholder: 'ghost', circle: 'dot', tag: 'chip', capsule: 'pill', layers: 'stack' };
  const FALLBACK = ['#4ea1ff', '#ffb347', '#7ed957', '#ff6b81', '#b48cff', '#36d1c4'];
  const TONES = ['muted', 'danger', 'ok', 'acc'];
  const ICONS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    doc: '<path d="M6 2h8l5 5v15H6zM14 2v5h5M9 13h7M9 17h7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  const COMMON = ['id', 'kind', 'at', 'span', 'x', 'y', 'w', 'h', 'step', 'out', 'highlight', 'delay', 'sync', 'entrance', 'tone', 'fill'];
  const LBLK = ['label', 'sub', 'icon', 'maxW'];
  const CHART = ['values', 'labels', 'unit', 'prefix', 'decimals', 'title', 'max'];
  const EXTRA = {
    box: LBLK, stack: LBLK, ghost: LBLK, pill: ['label', 'icon', 'maxW'], chip: ['label', 'icon', 'maxW'], diamond: ['label', 'sub', 'maxW'],
    text: ['label', 'size', 'align', 'valign', 'weight', 'mono'], group: ['title', 'dashed'],
    person: ['label', 'sub', 'maxW'], cylinder: ['label', 'sub', 'maxW'], cloud: ['label', 'sub', 'maxW'],
    dot: ['label', 'labelPos', 'size'], ring: ['value', 'label'], spinner: ['label'], badge: ['label', 'attach', 'corner'],
    bars: CHART.concat(['orient', 'hi', 'ticks']), line: CHART.concat(['area', 'min', 'zero', 'smooth', 'markers', 'ticks']),
    donut: ['segments', 'center', 'centerSub', 'unit', 'decimals', 'legend', 'title'], gauge: ['value', 'max', 'label', 'unit', 'decimals'],
    kpi: ['value', 'label', 'prefix', 'suffix', 'delta', 'deltaTone', 'decimals'],
  };
  const NEEDS_LABEL = ['box', 'stack', 'ghost', 'pill', 'chip', 'diamond', 'text', 'person', 'cylinder', 'cloud', 'badge', 'kpi'];
  const EDGE_KEYS = ['id', 'from', 'to', 'anchors', 'style', 'arrow', 'dashed', 'label', 'tone', 'draw', 'packets', 'step', 'out', 'highlight', 'delay', 'sync'];
  const TOP_KEYS = ['grid', 'nodes', 'edges', 'uniform'];
  const KEYALIAS = { type: 'kind', text: 'label', name: 'label', title: 'label', source: 'from', target: 'to', color: 'tone', colour: 'tone', pos: 'at', position: 'at', col: 'at', width: 'w', height: 'h', connectors: 'edges', links: 'edges', steps: 'step', icons: 'icon', subtitle: 'sub' };
  const DIR = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
  const OPP = { l: 'r', r: 'l', t: 'b', b: 't' };
  const NO_SPREAD = ['diamond', 'dot', 'ring', 'spinner', 'badge', 'gauge', 'cloud'];
  const FILL_KINDS = ['group', 'bars', 'line', 'donut', 'text'];
  const registry = new WeakMap();

  // ---------- helpers
  function fail(path, msg) { throw new Error('MotionDiagram: ' + path + (msg ? ': ' + msg : '')); }
  function lev(a, b) {
    const m = a.length, n = b.length; let prev = []; for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  function suggest(word, list) {
    let best = null, bd = 99; const w = String(word).toLowerCase();
    list.forEach((c) => { const d = lev(w, c.toLowerCase()); if (d < bd) { bd = d; best = c; } });
    return bd <= Math.max(2, Math.floor(w.length / 3)) ? best : null;
  }
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const isInt = (v) => Number.isInteger(v);
  const f2 = (n) => Math.round(n * 100) / 100;
  function S(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function toneCss(t) {
    if (isInt(t) && t >= 1 && t <= 6) return 'var(--a' + t + ', ' + FALLBACK[t - 1] + ')';
    if (t === 'muted') return 'var(--muted, #a9b4c0)';
    if (t === 'danger') return 'var(--a4, #ff6b81)';
    if (t === 'ok') return 'var(--a3, #7ed957)';
    return 'var(--acc, var(--a1, #4ea1ff))';
  }
  function checkKeys(obj, allowed, path) {
    Object.keys(obj).forEach((k) => {
      if (k[0] === '_' || allowed.includes(k)) return;
      const s = KEYALIAS[k] && allowed.includes(KEYALIAS[k]) ? KEYALIAS[k] : suggest(k, allowed);
      fail(path, 'unknown property "' + k + '"' + (s ? ', did you mean "' + s + '"?' : '; allowed: ' + allowed.join(', ')));
    });
  }
  function checkStepFields(s, path, withOut) {
    ['step', 'out', 'highlight'].forEach((k) => {
      if (s[k] !== undefined && !(isInt(s[k]) && s[k] >= (k === 'step' ? 0 : 1))) fail(path, '"' + k + '" must be a whole number' + (k === 'step' ? ' >= 0' : ' >= 1') + ', got ' + JSON.stringify(s[k]));
    });
    if (s.out !== undefined && s.step !== undefined && s.out <= s.step) fail(path, '"out" (' + s.out + ') must be greater than "step" (' + s.step + ')');
    if (s.delay !== undefined && !(isNum(s.delay) && s.delay >= 0)) fail(path, '"delay" must be a number of milliseconds >= 0');
  }

  // ---------- environment: tokens and text measuring (canvas, so it works when the slide is display:none)
  function readEnv(svg) {
    const cs = getComputedStyle(svg);
    const tok = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    const ctx = document.createElement('canvas').getContext('2d');
    const env = {
      body: tok('--f-body', 'system-ui, sans-serif'), mono: tok('--f-mono', 'ui-monospace, monospace'), display: tok('--f-display', tok('--f-body', 'system-ui, sans-serif')),
      wB: tok('--w-bold', '700'), wR: tok('--w-body', '400'), wD: tok('--w-display', '700'), lang: document.documentElement.lang || 'en',
    };
    env.w = (str, size, weight, fam) => { ctx.font = weight + ' ' + size + 'px ' + fam; return ctx.measureText(str).width * 1.02; };
    env.wrap = (str, maxW, size, weight, fam) => {
      const lines = []; let bad = null, mw = 0;
      String(str).split('\n').forEach((para) => {
        const words = para.split(/\s+/).filter(Boolean); let cur = '';
        if (!words.length) { lines.push(''); return; }
        words.forEach((wd) => { const t = cur ? cur + ' ' + wd : wd; if (cur && env.w(t, size, weight, fam) > maxW) { lines.push(cur); cur = wd; } else cur = t; });
        lines.push(cur);
      });
      lines.forEach((l) => { const lw = env.w(l, size, weight, fam); if (lw > mw) mw = lw; if (lw > maxW + 0.5 && !bad) bad = l; });
      return { lines, w: mw, bad };
    };
    env.fmt = (v, dec, unit, prefix) => {
      const d = dec != null ? dec : (Number.isInteger(v) ? 0 : 1);
      let n; try { n = new Intl.NumberFormat(env.lang, { minimumFractionDigits: dec != null ? d : 0, maximumFractionDigits: d }).format(v); } catch (e) { n = String(v); }
      return (prefix || '') + n + (unit || '');
    };
    return env;
  }

  // ---------- parse and validate (no DOM)
  function parse(spec) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('spec', 'must be an object like {"nodes":[...],"edges":[...]}');
    checkKeys(spec, TOP_KEYS, 'spec');
    const rawNodes = spec.nodes === undefined ? [] : spec.nodes;
    if (!Array.isArray(rawNodes)) fail('spec', '"nodes" must be an array');
    const grid = spec.grid || {};
    if (typeof grid !== 'object' || Array.isArray(grid)) fail('grid', 'must be an object {cols, rows, gap, padding}');
    checkKeys(grid, ['cols', 'rows', 'gap', 'padding'], 'grid');
    ['cols', 'rows'].forEach((k) => { if (grid[k] !== undefined && !(isInt(grid[k]) && grid[k] >= 1)) fail('grid', '"' + k + '" must be a whole number >= 1'); });
    ['gap', 'padding'].forEach((k) => { if (grid[k] !== undefined && !(isNum(grid[k]) && grid[k] >= 0)) fail('grid', '"' + k + '" must be a number >= 0'); });
    const nodes = [], byId = {};
    rawNodes.forEach((s, i) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) fail('nodes[' + i + ']', 'must be an object');
      const id = s.id, path = 'nodes[' + i + ']' + (id != null ? ' "' + id + '"' : '');
      if (id != null && (typeof id !== 'string' || !id)) fail(path, '"id" must be a non-empty string');
      if (id != null && byId[id]) fail(path, 'duplicate id "' + id + '" (also nodes[' + byId[id].i + '])');
      const kind = s.kind === undefined ? 'box' : s.kind;
      if (!KINDS.includes(kind)) {
        const sg = suggest(kind, KINDS.concat(Object.keys(SYN)));
        fail(path, 'unknown kind ' + JSON.stringify(kind) + (sg ? ', did you mean "' + (SYN[sg] || sg) + '"?' : '; kinds: ' + KINDS.join(', ')));
      }
      checkKeys(s, COMMON.concat(EXTRA[kind] || []), path);
      const N = { i, id, path, kind, s, step: s.step || 0, out: s.out, hl: s.highlight, delay: s.delay, sync: !!s.sync, tone: s.tone, entr: s.entrance };
      checkStepFields(s, path);
      if (s.tone !== undefined && !(isInt(s.tone) && s.tone >= 1 && s.tone <= 6) && !TONES.includes(s.tone)) fail(path, '"tone" must be 1 to 6 or one of ' + TONES.join(', ') + ', got ' + JSON.stringify(s.tone));
      if (s.entrance !== undefined && !['rise', 'fade', 'pop', 'none'].includes(s.entrance)) fail(path, '"entrance" must be rise, fade, pop or none');
      ['w', 'h', 'x', 'y'].forEach((k) => { if (s[k] !== undefined && !isNum(s[k])) fail(path, '"' + k + '" must be a number'); });
      ['w', 'h'].forEach((k) => { if (s[k] !== undefined && s[k] <= 0) fail(path, '"' + k + '" must be > 0'); });
      if (NEEDS_LABEL.includes(kind) && (typeof s.label !== 'string' && !isNum(s.label) || s.label === '')) fail(path, 'kind "' + kind + '" needs a non-empty "label"');
      if (kind === 'group' && s.title !== undefined && typeof s.title !== 'string') fail(path, '"title" must be a string');
      if (s.icon !== undefined && !ICONS[s.icon]) { const sg = suggest(s.icon, Object.keys(ICONS)); fail(path, 'unknown icon ' + JSON.stringify(s.icon) + (sg ? ', did you mean "' + sg + '"?' : '; icons: ' + Object.keys(ICONS).join(', '))); }
      const attached = kind === 'badge' && s.attach !== undefined;
      const hasAt = s.at !== undefined, hasXY = s.x !== undefined || s.y !== undefined;
      if (attached) {
        if (hasAt || hasXY) fail(path, 'a badge with "attach" takes its place from that node; remove "at"/"x"/"y"');
        if (s.corner !== undefined && !['tl', 'tr', 'bl', 'br'].includes(s.corner)) fail(path, '"corner" must be tl, tr, bl or br');
      } else {
        if (hasAt && hasXY) fail(path, 'give either "at" or "x"/"y", not both');
        if (!hasAt && !hasXY) fail(path, 'needs a position: "at": [col,row] or "x" and "y"');
        if (hasXY && !(isNum(s.x) && isNum(s.y))) fail(path, 'both "x" and "y" are needed');
      }
      if (hasAt) {
        if (!(Array.isArray(s.at) && s.at.length === 2 && s.at.every((v) => isInt(v) && v >= 0))) fail(path, '"at" must be [col,row] with whole numbers >= 0, got ' + JSON.stringify(s.at));
        N.at = s.at;
        if (s.span !== undefined && !(Array.isArray(s.span) && s.span.length === 2 && s.span.every((v) => isInt(v) && v >= 1))) fail(path, '"span" must be [cols,rows] with whole numbers >= 1');
        N.span = s.span || [1, 1];
      } else if (s.span !== undefined) fail(path, '"span" only works together with "at"');
      checkData(kind, s, path);
      if (kind === 'chip' || kind === 'pill') N.fixedSingle = true;
      nodes.push(N);
      if (id != null) byId[id] = N;
    });
    nodes.forEach((N) => {
      if (N.kind === 'badge' && N.s.attach !== undefined) {
        const t = byId[N.s.attach];
        if (!t) fail(N.path, '"attach" refers to unknown node id ' + JSON.stringify(N.s.attach) + idHint(N.s.attach, byId));
        if (t === N) fail(N.path, 'a badge cannot attach to itself');
        N.target = t;
      }
    });
    // grid size and cell occupancy
    let maxC = 0, maxR = 0;
    nodes.forEach((N) => { if (N.at) { maxC = Math.max(maxC, N.at[0] + N.span[0]); maxR = Math.max(maxR, N.at[1] + N.span[1]); } });
    const cols = grid.cols || Math.max(1, maxC), rows = grid.rows || Math.max(1, maxR);
    const occ = {};
    nodes.forEach((N) => {
      if (!N.at) return;
      if (N.at[0] + N.span[0] > cols) fail(N.path, '"at" [' + N.at + '] with span [' + N.span + '] reaches column ' + (N.at[0] + N.span[0] - 1) + ' but the grid has ' + cols + ' column(s) (0 to ' + (cols - 1) + ')');
      if (N.at[1] + N.span[1] > rows) fail(N.path, '"at" [' + N.at + '] with span [' + N.span + '] reaches row ' + (N.at[1] + N.span[1] - 1) + ' but the grid has ' + rows + ' row(s) (0 to ' + (rows - 1) + ')');
      if (N.kind === 'group' || N.kind === 'badge') return;
      for (let c = N.at[0]; c < N.at[0] + N.span[0]; c++) for (let r = N.at[1]; r < N.at[1] + N.span[1]; r++) {
        const k = c + ',' + r;
        (occ[k] = occ[k] || []).forEach((O) => {
          if (N.step < (O.out === undefined ? Infinity : O.out) && O.step < (N.out === undefined ? Infinity : N.out)) fail(N.path + ' and ' + O.path, 'both occupy cell [' + c + ',' + r + ']; move one with a different "at", use "span" so one node covers the other cells, or let one leave with "out" before the other arrives with "step"');
        });
        occ[k].push(N);
      }
    });
    // edges
    const rawEdges = spec.edges === undefined ? [] : spec.edges;
    if (!Array.isArray(rawEdges)) fail('spec', '"edges" must be an array');
    const edges = rawEdges.map((s, i) => {
      if (!s || typeof s !== 'object' || Array.isArray(s)) fail('edges[' + i + ']', 'must be an object');
      const path = 'edges[' + i + ']' + (typeof s.from === 'string' && typeof s.to === 'string' ? ' "' + s.from + '->' + s.to + '"' : '');
      checkKeys(s, EDGE_KEYS, path);
      ['from', 'to'].forEach((k) => {
        if (typeof s[k] !== 'string') fail(path, '"' + k + '" must be a node id');
        if (!byId[s[k]]) fail(path, 'unknown node id ' + JSON.stringify(s[k]) + ' in "' + k + '"' + idHint(s[k], byId));
      });
      if (s.from === s.to) fail(path, '"from" and "to" are the same node');
      checkStepFields(s, path);
      if (s.anchors !== undefined && !(Array.isArray(s.anchors) && s.anchors.length === 2 && s.anchors.every((a) => a == null || a === 'auto' || DIR[a]))) fail(path, '"anchors" must be [fromSide,toSide] with sides l, r, t, b or null, e.g. ["r","l"]');
      if (s.style !== undefined && !['auto', 'straight', 'elbow', 'curve'].includes(s.style)) fail(path, '"style" must be auto, straight, elbow or curve');
      if (s.arrow !== undefined && !['end', 'start', 'both', 'none'].includes(s.arrow)) fail(path, '"arrow" must be end, start, both or none');
      if (s.label !== undefined && typeof s.label !== 'string') fail(path, '"label" must be a string');
      if (s.tone !== undefined && !(isInt(s.tone) && s.tone >= 1 && s.tone <= 6) && !TONES.includes(s.tone)) fail(path, '"tone" must be 1 to 6 or one of ' + TONES.join(', '));
      let pk = null;
      if (s.packets) {
        const p = s.packets === true ? {} : isNum(s.packets) ? { count: s.packets } : s.packets;
        if (typeof p !== 'object') fail(path, '"packets" must be true, a count or {count, dur}');
        checkKeys(p, ['count', 'dur', 'size'], path + ' packets');
        pk = { count: p.count == null ? 1 : p.count, dur: p.dur == null ? 2.4 : p.dur, size: p.size || 6.5 };
        if (!(isInt(pk.count) && pk.count >= 1 && pk.count <= 8)) fail(path, 'packets.count must be a whole number 1 to 8');
        if (!(isNum(pk.dur) && pk.dur > 0)) fail(path, 'packets.dur must be seconds > 0');
      }
      const from = byId[s.from], to = byId[s.to];
      const outs = [from.out, to.out].filter((v) => v != null);
      return {
        i, path, s, from, to, pk, style: s.style || 'auto', arrow: s.arrow || 'end', dashed: !!s.dashed, label: s.label, tone: s.tone,
        step: s.step !== undefined ? s.step : Math.max(from.step, to.step), out: s.out !== undefined ? s.out : (outs.length ? Math.min.apply(null, outs) : undefined),
        hl: s.highlight, delay: s.delay, sync: !!s.sync, draw: s.draw !== false,
      };
    });
    return { nodes, edges, byId, grid, cols, rows, uniform: spec.uniform !== false };
  }
  function idHint(word, byId) { const sg = suggest(String(word), Object.keys(byId)); return sg ? ', did you mean "' + sg + '"?' : (Object.keys(byId).length ? '; known ids: ' + Object.keys(byId).join(', ') : '; no node has an id'); }
  function checkData(kind, s, path) {
    const arr = (k, min) => { if (!Array.isArray(s[k]) || s[k].length < min) fail(path, '"' + k + '" must be an array of at least ' + min + ' item(s)'); };
    if (kind === 'bars' || kind === 'line') {
      arr('values', kind === 'line' ? 2 : 1);
      s.values.forEach((v, i) => { if (!isNum(v) || (kind === 'bars' && v < 0)) fail(path, 'values[' + i + '] must be a number' + (kind === 'bars' ? ' >= 0' : '') + ', got ' + JSON.stringify(v)); });
      if (s.labels !== undefined && !(Array.isArray(s.labels) && s.labels.length === s.values.length)) fail(path, '"labels" has ' + (Array.isArray(s.labels) ? s.labels.length : 'the wrong type') + ' item(s) but "values" has ' + s.values.length + '; they must match');
      if (s.max !== undefined && !(isNum(s.max) && s.max > 0)) fail(path, '"max" must be a number > 0');
      if (kind === 'bars') {
        if (s.orient !== undefined && !['v', 'h'].includes(s.orient)) fail(path, '"orient" must be "v" or "h"');
        if (s.hi !== undefined) [].concat(s.hi).forEach((h) => { if (!isInt(h) || h < 0 || h >= s.values.length) fail(path, '"hi" ' + JSON.stringify(h) + ' is not an index into "values" (0 to ' + (s.values.length - 1) + ')'); });
      }
      if (s.max !== undefined && Math.max.apply(null, s.values) > s.max) fail(path, '"max" ' + s.max + ' is below the largest value ' + Math.max.apply(null, s.values));
    } else if (kind === 'donut') {
      arr('segments', 1);
      s.segments.forEach((g, i) => {
        if (!g || typeof g !== 'object' || typeof g.label !== 'string' || !isNum(g.value) || g.value < 0) fail(path, 'segments[' + i + '] must be {"label": string, "value": number >= 0, "tone"?}');
        checkKeys(g, ['label', 'value', 'tone'], path + ' segments[' + i + ']');
      });
      if (!s.segments.some((g) => g.value > 0)) fail(path, 'segments need at least one value > 0');
    } else if (kind === 'gauge') {
      if (!isNum(s.value)) fail(path, '"value" must be a number');
      const mx = s.max === undefined ? 100 : s.max;
      if (!(isNum(mx) && mx > 0)) fail(path, '"max" must be a number > 0');
      if (s.value < 0 || s.value > mx) fail(path, '"value" ' + s.value + ' is outside 0 to ' + mx);
    } else if (kind === 'ring') {
      if (!isNum(s.value) || s.value < 0 || s.value > 100) fail(path, '"value" must be a percentage from 0 to 100, got ' + JSON.stringify(s.value));
    } else if (kind === 'kpi') {
      if (!isNum(s.value) && typeof s.value !== 'string') fail(path, '"value" must be a number or a string');
    }
  }

  // ---------- layout
  const BOXCFG = {
    box: { ls: 26, ss: 20, px: 22, py: 20, minW: 150, minH: 76, maxW: 300 }, stack: { ls: 26, ss: 20, px: 22, py: 20, minW: 150, minH: 76, maxW: 300 }, ghost: { ls: 26, ss: 20, px: 22, py: 20, minW: 150, minH: 76, maxW: 300 },
    pill: { ls: 24, ss: 0, px: 30, py: 12, minW: 90, minH: 56, maxW: 460 }, chip: { ls: 20, ss: 0, px: 20, py: 8, minW: 60, minH: 40, maxW: 360 },
  };
  const LH = 32, SLH = 25;
  function measure(N, env, avail) {
    const s = N.s, k = N.kind;
    const lw = (str, size, weight, fam, maxW, hardW) => {
      let r = env.wrap(str, maxW, size, weight, fam);
      if (hardW > maxW && (r.bad || r.lines.length > 1)) { const r2 = env.wrap(str, hardW, size, weight, fam); if (r.bad || r2.lines.length < r.lines.length) { r = r2; maxW = hardW; } }
      if (r.bad) fail(N.path, 'the text ' + JSON.stringify(r.bad) + ' is ' + Math.round(env.w(r.bad, size, weight, fam)) + 'px wide but only ' + Math.round(maxW) + 'px fit; shorten the label, give it more room (a bigger "span", fewer columns) or set a larger "w"');
      return r;
    };
    const capHard = s.w || Math.min(s.maxW || (BOXCFG[k] || BOXCFG.box).maxW, avail.w), widthCap = s.w || Math.max(capHard - (avail.reserve || 0), Math.min(capHard, 120));
    if (BOXCFG[k]) {
      const c = BOXCFG[k], iconW = s.icon ? 44 : 0;
      const lab = lw(String(s.label), c.ls, env.wB, env.body, widthCap - 2 * c.px - iconW, capHard - 2 * c.px - iconW);
      const sub = s.sub && c.ss ? lw(String(s.sub), c.ss, env.wR, env.body, widthCap - 2 * c.px - iconW, capHard - 2 * c.px - iconW) : { lines: [], w: 0 };
      const th = lab.lines.length * LH + (sub.lines.length ? 6 + sub.lines.length * SLH : 0);
      return { w: Math.max(c.minW, Math.max(lab.w, sub.w) + 2 * c.px + iconW), h: Math.max(c.minH, th + 2 * c.py), lab: lab.lines, sub: sub.lines, th, iconW };
    }
    if (k === 'diamond') {
      const dw = Math.min(s.w || 320, avail.w) * 0.56, lab = lw(String(s.label), 22, env.wB, env.body, dw, dw * 1.15);
      const sub = s.sub ? lw(String(s.sub), 18, env.wR, env.body, dw, dw * 1.15) : { lines: [], w: 0 };
      const th = lab.lines.length * 30 + (sub.lines.length ? 4 + sub.lines.length * 23 : 0);
      return { w: Math.min(Math.max(190, 1.85 * Math.max(lab.w, sub.w) + 36), s.w || avail.w), h: Math.max(100, 2.4 * th + 28), lab: lab.lines, sub: sub.lines, th };
    }
    if (k === 'text') {
      const size = s.size || 28, wt = s.weight === 'bold' ? env.wB : env.wR, fam = s.mono ? env.mono : env.body;
      const lab = lw(String(s.label), size, wt, fam, s.w || avail.w);
      return { w: s.w || Math.ceil(lab.w), h: lab.lines.length * size * 1.3, lab: lab.lines, size, wt, fam, lh: size * 1.3 };
    }
    if (k === 'person' || k === 'cylinder' || k === 'cloud') {
      const mw = Math.min(s.maxW || (k === 'cloud' ? 320 : 260), avail.w);
      const lab = s.label ? lw(String(s.label), k === 'person' ? 24 : 26, env.wB, env.body, k === 'person' ? mw : (k === 'cloud' ? mw * 0.6 : mw - 40)) : { lines: [], w: 0 };
      const sub = s.sub ? lw(String(s.sub), 20, env.wR, env.body, k === 'cloud' ? mw * 0.6 : mw - 40) : { lines: [], w: 0 };
      const th = lab.lines.length * LH + (sub.lines.length ? 6 + sub.lines.length * SLH : 0), tw = Math.max(lab.w, sub.w);
      if (k === 'person') return { w: Math.max(130, tw + 24), h: 84 + 14 + th, lab: lab.lines, sub: sub.lines, th, gs: 84 };
      if (k === 'cylinder') return { w: Math.max(190, tw + 56), h: Math.max(96, th + 32 + 28), lab: lab.lines, sub: sub.lines, th, ry: 16 };
      return { w: Math.max(210, tw / 0.62), h: Math.max(104, th / 0.5), lab: lab.lines, sub: sub.lines, th };
    }
    if (k === 'dot') { const d = s.size || 20; return { w: d, h: d }; }
    if (k === 'badge') { const d = Math.max(34, env.w(String(s.label), 20, env.wB, env.body) + 18); return { w: d, h: 34 }; }
    if (k === 'ring' || k === 'spinner') {
      const lab = s.label ? lw(String(s.label), 22, env.wB, env.body, 220) : { lines: [], w: 0 }, d = k === 'ring' ? Math.max(70, Math.min(124, avail.h - (lab.lines.length ? 14 + lab.lines.length * 28 : 0) - 2)) : 56;
      return { w: Math.max(d + 20, lab.w + 8), h: d + (lab.lines.length ? 14 + lab.lines.length * 28 : 0), lab: lab.lines, d };
    }
    if (k === 'gauge') return { w: Math.min(s.w || 300, avail.w), h: Math.min(s.h || 270, avail.h) };
    if (k === 'kpi') {
      const vs = typeof s.value === 'number' ? env.fmt(s.value, s.decimals, '', s.prefix || '') + (s.suffix || '') : (s.prefix || '') + s.value + (s.suffix || '');
      const vw0 = env.w(vs, 72, env.wD, env.display), mw = Math.min(s.w || 380, avail.w), fs = Math.min(72, 72 * (mw - 56) / vw0), vw = vw0 * fs / 72;
      const lab = lw(String(s.label), 24, env.wR, env.body, mw - 48);
      const dl = s.delta ? 34 : 0;
      return { w: Math.max(240, Math.min(mw, Math.max(vw, lab.w) + 64)), h: 34 + 82 + 6 + lab.lines.length * 30 + dl + 30, lab: lab.lines, vs, vw, fs: Math.floor(fs) };
    }
    return { w: s.w || avail.w, h: s.h || avail.h }; // charts and groups
  }

  function layout(M, svg, env) {
    const vbA = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    let vb;
    if (vbA.length === 4 && vbA.every(isFinite) && vbA[2] > 0 && vbA[3] > 0) vb = { x: vbA[0], y: vbA[1], w: vbA[2], h: vbA[3] };
    else { vb = { x: 0, y: 0, w: 1360, h: 540 }; svg.setAttribute('viewBox', '0 0 1360 540'); }
    M.vb = vb;
    const g = M.grid, hasGroups = M.nodes.some((N) => N.kind === 'group' && N.at);
    const gap = g.gap !== undefined ? g.gap : (hasGroups ? 64 : 56), ex = hasGroups ? Math.round(gap * 0.36) : 0;
    const pb = g.padding !== undefined ? g.padding : 12;
    const pad = g.padding !== undefined ? { l: pb, r: pb, t: pb, b: pb } : { l: pb + ex, r: pb + ex, t: pb + ex + (hasGroups ? 8 : 0), b: pb + ex };
    const cw = (vb.w - pad.l - pad.r - (M.cols - 1) * gap) / M.cols, ch = (vb.h - pad.t - pad.b - (M.rows - 1) * gap) / M.rows;
    if (cw < 20 || ch < 20) fail('grid', M.cols + 'x' + M.rows + ' cells with gap ' + gap + ' leave cells of ' + Math.round(cw) + 'x' + Math.round(ch) + 'px in a ' + vb.w + 'x' + vb.h + ' viewBox; use fewer cols/rows or a smaller gap');
    const cell = (N) => ({ x: vb.x + pad.l + N.at[0] * (cw + gap), y: vb.y + pad.t + N.at[1] * (ch + gap), w: N.span[0] * cw + (N.span[0] - 1) * gap, h: N.span[1] * ch + (N.span[1] - 1) * gap });
    M.nodes.forEach((N) => {
      if (N.at) N.cell = cell(N);
      if (N.kind === 'group' || (N.kind === 'badge' && N.target)) return;
      const avail = N.cell ? { w: N.cell.w, h: N.cell.h, reserve: M.cols > 1 && N.s.w === undefined && !FILL_KINDS.includes(N.kind) && N.kind !== 'kpi' ? Math.min(64, N.cell.w * 0.2) : 0 } : { w: Math.min(vb.w, 400), h: vb.h };
      if (!N.cell && FILL_KINDS.includes(N.kind) && (N.s.w === undefined || N.s.h === undefined) && N.kind !== 'text') fail(N.path, 'kind "' + N.kind + '" with "x"/"y" also needs "w" and "h"');
      N.nat = measure(N, env, avail);
      const hMax = N.s.h || (N.cell ? N.cell.h : vb.h);
      if (N.nat.h > hMax + 0.5 && !FILL_KINDS.includes(N.kind)) fail(N.path, 'the content needs ' + Math.ceil(N.nat.h) + 'px of height but only ' + Math.floor(hMax) + 'px are available' + (N.s.h ? ' (h is ' + N.s.h + ')' : '') + '; shorten the label, use fewer lines or give it a bigger "span", fewer rows or a larger "h"');
      if (N.s.w && N.nat.w > N.s.w + 0.5) fail(N.path, 'the content needs ' + Math.ceil(N.nat.w) + 'px of width but "w" is ' + N.s.w);
    });
    // uniform sizes for auto-sized boxes of the same kind
    if (M.uniform) ['box', 'stack', 'kpi'].forEach((k) => {
      const set = M.nodes.filter((N) => N.kind === k && N.cell && N.span[0] === 1 && N.span[1] === 1 && N.s.w === undefined && !N.s.fill);
      if (set.length < 2) return;
      const uw = Math.max.apply(null, set.map((N) => N.nat.w)), rowH = {};
      set.forEach((N) => { rowH[N.at[1]] = Math.max(rowH[N.at[1]] || 0, N.nat.h); });
      set.forEach((N) => { N.nat.w = Math.min(uw, N.cell.w); if (N.s.h === undefined) N.nat.h = Math.min(rowH[N.at[1]], N.cell.h); });
    });
    M.nodes.forEach((N) => {
      if (N.kind === 'group' || (N.kind === 'badge' && N.target)) return;
      const s = N.s, nat = N.nat, fillIt = N.cell && (FILL_KINDS.includes(N.kind) || s.fill);
      const w = s.w !== undefined ? s.w : fillIt ? N.cell.w : nat.w, h = s.h !== undefined ? s.h : fillIt ? N.cell.h : nat.h;
      N.r = N.cell ? { x: N.cell.x + (N.cell.w - w) / 2, y: N.cell.y + (N.cell.h - h) / 2, w, h } : { x: s.x, y: s.y, w, h };
      if (N.kind === 'person' && N.cell) { const ny = N.cell.y + N.cell.h / 2 - 66; if (ny >= N.cell.y - 0.5 && ny + h <= N.cell.y + N.cell.h + 0.5) N.r.y = ny; } // shoulder line on the row centre, so connectors run straight
    });
    M.nodes.forEach((N) => { // groups: around their cells, or explicit
      if (N.kind !== 'group') return;
      const s = N.s, top = 0;
      if (N.cell) { const c = N.cell; N.r = { x: c.x - ex, y: c.y - ex - top, w: c.w + 2 * ex, h: c.h + 2 * ex + top }; }
      else { if (s.w === undefined || s.h === undefined) fail(N.path, 'a group with "x"/"y" also needs "w" and "h"'); N.r = { x: s.x, y: s.y, w: s.w, h: s.h }; }
      if (s.w !== undefined && N.cell) N.r.w = s.w; if (s.h !== undefined && N.cell) N.r.h = s.h;
      N.r.x = Math.max(N.r.x, vb.x + 2); N.r.y = Math.max(N.r.y, vb.y + 2);
      N.r.w = Math.min(N.r.w, vb.x + vb.w - 2 - N.r.x); N.r.h = Math.min(N.r.h, vb.y + vb.h - 2 - N.r.y);
    });
    M.nodes.forEach((N) => { // badges
      if (N.kind !== 'badge') return;
      const nat = measure(N, env, { w: 100, h: 100 }), s = N.s;
      if (N.target) {
        const t = N.target.kind === 'person' ? { x: N.target.r.x + N.target.r.w / 2 - 38, y: N.target.r.y, w: 76, h: N.target.nat.gs } : N.target.r, c = s.corner || 'tr', cx = c[1] === 'r' ? t.x + t.w : t.x, cy = c[0] === 't' ? t.y : t.y + t.h;
        N.r = { x: cx - nat.w / 2, y: cy - nat.h / 2, w: nat.w, h: nat.h };
      } else N.r = N.cell ? { x: N.cell.x + (N.cell.w - nat.w) / 2, y: N.cell.y + (N.cell.h - nat.h) / 2, w: nat.w, h: nat.h } : { x: s.x, y: s.y, w: nat.w, h: nat.h };
      N.nat = nat;
    });
    M.nodes.forEach((N) => {
      const r = N.r;
      if (!r) fail(N.path, 'cannot be placed (is its badge target missing a position?)');
      if (r.x < vb.x - 0.5 || r.y < vb.y - 0.5 || r.x + r.w > vb.x + vb.w + 0.5 || r.y + r.h > vb.y + vb.h + 0.5) fail(N.path, 'does not fit inside the viewBox ' + [vb.x, vb.y, vb.w, vb.h].join(' ') + ': it would cover x ' + Math.round(r.x) + ' to ' + Math.round(r.x + r.w) + ', y ' + Math.round(r.y) + ' to ' + Math.round(r.y + r.h) + '; use a smaller "w"/"h", a different position or fewer columns');
      N.pr = N.kind === 'stack' ? { x: r.x, y: r.y, w: r.w - 20, h: r.h - 20 } : N.kind === 'person' ? { x: r.x + r.w / 2 - 38, y: r.y, w: 76, h: N.nat.gs } : r;
    });
  }

  // ---------- edge routing
  function sideAuto(a, b) {
    const ac = [a.x + a.w / 2, a.y + a.h / 2], bc = [b.x + b.w / 2, b.y + b.h / 2];
    const rx = Math.abs(bc[0] - ac[0]) / ((a.w + b.w) / 2), ry = Math.abs(bc[1] - ac[1]) / ((a.h + b.h) / 2);
    if (rx >= ry) return bc[0] >= ac[0] ? ['r', 'l'] : ['l', 'r'];
    return bc[1] >= ac[1] ? ['b', 't'] : ['t', 'b'];
  }
  function sidePoint(N, side, off) {
    const r = N.pr; let x = r.x + r.w / 2, y = r.y + r.h / 2;
    if (N.kind === 'person' && side !== 'b') return side === 't' ? [x + off, r.y + 4] : [side === 'l' ? r.x : r.x + r.w, r.y + 66 + off];
    if (N.kind === 'cloud' && side !== 'b') return side === 't' ? [x + off, r.y + r.h * 0.04] : [side === 'l' ? r.x + r.w * 0.025 : r.x + r.w * 0.975, y + off];
    if (side === 'l') { x = r.x; y += off; } else if (side === 'r') { x = r.x + r.w; y += off; } else if (side === 't') { y = r.y; x += off; } else { y = N.kind === 'person' ? N.r.y + N.r.h : r.y + r.h; x += off; }
    return [x, y];
  }
  function elbowPts(p1, s1, p2, s2) {
    const d1 = DIR[s1], d2 = DIR[s2], a = d1[0] !== 0 ? 0 : 1, o = 1 - a, L = 28;
    const mk = (u, v) => (a === 0 ? [u, v] : [v, u]);
    if (d2[a] !== 0) {
      if (d1[a] === -d2[a] && (p2[a] - p1[a]) * d1[a] > 8) { const m = (p1[a] + p2[a]) / 2; return [p1, mk(m, p1[o]), mk(m, p2[o]), p2]; }
      if (d1[a] === d2[a]) { const u = d1[a] > 0 ? Math.max(p1[a], p2[a]) + L : Math.min(p1[a], p2[a]) - L; return [p1, mk(u, p1[o]), mk(u, p2[o]), p2]; }
      const u1 = p1[a] + d1[a] * L, u2 = p2[a] + d2[a] * L, v = Math.abs(p1[o] - p2[o]) > 40 ? (p1[o] + p2[o]) / 2 : Math.max(p1[o], p2[o]) + 70;
      return [p1, mk(u1, p1[o]), mk(u1, v), mk(u2, v), mk(u2, p2[o]), p2];
    }
    const c = a === 0 ? [p2[0], p1[1]] : [p1[0], p2[1]];
    if (d1[a] * (p2[a] - p1[a]) > 4 && d2[o] * (p1[o] - p2[o]) > 4) return [p1, c, p2];
    const u = p1[a] + d1[a] * L, w2 = p2[o] + d2[o] * L;
    return [p1, mk(u, p1[o]), mk(u, w2), mk(p2[a], w2), p2];
  }
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  function roundPath(pts, r) {
    let d = 'M' + f2(pts[0][0]) + ' ' + f2(pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], a = pts[i - 1], b = pts[i + 1], la = dist(a, p), lb = dist(p, b), rr = Math.min(r, la / 2, lb / 2);
      const s = [p[0] + (a[0] - p[0]) / la * rr, p[1] + (a[1] - p[1]) / la * rr], e = [p[0] + (b[0] - p[0]) / lb * rr, p[1] + (b[1] - p[1]) / lb * rr];
      d += ' L' + f2(s[0]) + ' ' + f2(s[1]) + ' Q' + f2(p[0]) + ' ' + f2(p[1]) + ' ' + f2(e[0]) + ' ' + f2(e[1]);
    }
    const l = pts[pts.length - 1];
    return d + ' L' + f2(l[0]) + ' ' + f2(l[1]);
  }
  const HL = 15, HW = 7.5;
  function headPoly(tip, u) {
    const bx = tip[0] - u[0] * HL, by = tip[1] - u[1] * HL, nx = -u[1] * HW, ny = u[0] * HW;
    return f2(tip[0]) + ',' + f2(tip[1]) + ' ' + f2(bx + nx) + ',' + f2(by + ny) + ' ' + f2(bx - nx) + ',' + f2(by - ny);
  }
  function bez(p0, c1, c2, p3, t) { const m = 1 - t; return [m * m * m * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * p3[1]]; }
  function polyAt(pts, frac) {
    let tot = 0; for (let i = 1; i < pts.length; i++) tot += dist(pts[i - 1], pts[i]);
    let want = tot * frac;
    for (let i = 1; i < pts.length; i++) { const l = dist(pts[i - 1], pts[i]); if (want <= l || i === pts.length - 1) { const t = l ? Math.min(1, want / l) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; } want -= l; }
    return pts[0];
  }

  function routeEdges(M, env) {
    const need = [];
    M.edges.forEach((E) => {
      const a = E.from.pr, b = E.to.pr, auto = sideAuto(a, b), an = E.s.anchors || [null, null];
      let s1 = an[0] && an[0] !== 'auto' ? an[0] : null, s2 = an[1] && an[1] !== 'auto' ? an[1] : null;
      if (s1 && !s2) s2 = (DIR[s1][0] !== 0) === (DIR[auto[0]][0] !== 0) ? OPP[s1] : auto[1];
      else if (s2 && !s1) s1 = (DIR[s2][0] !== 0) === (DIR[auto[1]][0] !== 0) ? OPP[s2] : auto[0];
      else if (!s1 && !s2) { s1 = auto[0]; s2 = auto[1]; }
      E.sides = [s1, s2];
      need.push({ E, end: 0, N: E.from, side: s1, other: E.to }, { E, end: 1, N: E.to, side: s2, other: E.from });
    });
    const groups = {};
    need.forEach((u) => { const k = u.N.i + u.side; (groups[k] = groups[k] || []).push(u); });
    Object.keys(groups).forEach((k) => {
      const list = groups[k], N = list[0].N, side = list[0].side;
      list.forEach((u) => { u.off = 0; });
      if (list.length < 2 || NO_SPREAD.includes(N.kind)) return;
      const vert = side === 'l' || side === 'r', len = vert ? N.pr.h : N.pr.w, step = Math.min(34, (len - 24) / list.length);
      list.sort((p, q) => { const pc = p.other.pr, qc = q.other.pr; return vert ? (pc.y + pc.h / 2) - (qc.y + qc.h / 2) : (pc.x + pc.w / 2) - (qc.x + qc.w / 2); });
      const live = (a, b) => (a.step < (b.out === undefined ? Infinity : b.out)) && (b.step < (a.out === undefined ? Infinity : a.out));
      list.forEach((u) => { const ov = list.filter((o) => live(o.E, u.E)); u.off = (ov.indexOf(u) - (ov.length - 1) / 2) * Math.min(34, (len - 24) / ov.length); });
    });
    need.forEach((u) => { u.E['p' + u.end] = sidePoint(u.N, u.side, u.off); });
    M.edges.forEach((E) => {
      const p1 = E.p0, p2 = E.p1, [s1, s2] = E.sides;
      let style = E.style;
      if (style === 'auto') style = (Math.abs(p1[0] - p2[0]) < 1.5 || Math.abs(p1[1] - p2[1]) < 1.5) && (DIR[s1][0] !== 0) === (Math.abs(p1[1] - p2[1]) < 1.5) ? 'straight' : 'elbow';
      E.styleUsed = style;
      const sa = E.arrow === 'start' || E.arrow === 'both', ea = E.arrow === 'end' || E.arrow === 'both';
      let d, heads = [], pts = null, cub = null, lbl = null;
      if (style === 'curve') {
        const k = Math.max(40, Math.min(200, dist(p1, p2) * 0.45)), d1 = DIR[s1], d2 = DIR[s2];
        let q0 = p1.slice(), q3 = p2.slice();
        if (sa) { heads.push(headPoly(p1, d1.map((v) => -v))); q0 = [p1[0] + d1[0] * (HL - 1), p1[1] + d1[1] * (HL - 1)]; }
        if (ea) { heads.push(headPoly(p2, d2.map((v) => -v))); q3 = [p2[0] + d2[0] * (HL - 1), p2[1] + d2[1] * (HL - 1)]; }
        const c1 = [q0[0] + d1[0] * k, q0[1] + d1[1] * k], c2 = [q3[0] + d2[0] * k, q3[1] + d2[1] * k];
        d = 'M' + f2(q0[0]) + ' ' + f2(q0[1]) + ' C' + f2(c1[0]) + ' ' + f2(c1[1]) + ' ' + f2(c2[0]) + ' ' + f2(c2[1]) + ' ' + f2(q3[0]) + ' ' + f2(q3[1]);
        cub = [q0, c1, c2, q3];
        E.len = dist(p1, p2) * 1.1; lbl = bez(q0, c1, c2, q3, 0.5); E.seg = E.len; E.lf = 0.5;
      } else {
        pts = style === 'straight' ? [p1, p2] : elbowPts(p1, s1, p2, s2);
        pts = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.5);
        if (pts.length < 2) pts = [p1, p2];
        const n = pts.length;
        if (sa) { const u = [(pts[1][0] - pts[0][0]) / dist(pts[0], pts[1]), (pts[1][1] - pts[0][1]) / dist(pts[0], pts[1])]; heads.push(headPoly(pts[0], [-u[0], -u[1]])); pts[0] = [pts[0][0] + u[0] * (HL - 1), pts[0][1] + u[1] * (HL - 1)]; }
        if (ea) { const l = dist(pts[n - 2], pts[n - 1]), u = [(pts[n - 1][0] - pts[n - 2][0]) / l, (pts[n - 1][1] - pts[n - 2][1]) / l]; heads.push(headPoly(pts[n - 1], u)); pts[n - 1] = [pts[n - 1][0] - u[0] * (HL - 1), pts[n - 1][1] - u[1] * (HL - 1)]; }
        d = pts.length === 2 ? 'M' + f2(pts[0][0]) + ' ' + f2(pts[0][1]) + ' L' + f2(pts[1][0]) + ' ' + f2(pts[1][1]) : roundPath(pts, 14);
        let best = 0, bi = 0; for (let i = 1; i < pts.length; i++) { const l = dist(pts[i - 1], pts[i]); if (l > best) { best = l; bi = i; } }
        lbl = [(pts[bi - 1][0] + pts[bi][0]) / 2, (pts[bi - 1][1] + pts[bi][1]) / 2]; let acc = 0, tot = 0; for (let i = 1; i < pts.length; i++) { const l = dist(pts[i - 1], pts[i]); if (i < bi) acc += l; if (i === bi) acc += l / 2; tot += l; } E.lf = tot ? acc / tot : 0.5; E.seg = best - (pts.length === 2 ? 0 : 28); E.len = 0; for (let i = 1; i < pts.length; i++) E.len += dist(pts[i - 1], pts[i]);
      }
      E.d = d; E.heads = heads; E.pts = pts; E.cub = cub; E.lbl = lbl;
      if (E.label) {
        E.lw = env.w(E.label, 19, env.wR, env.mono) + 24;
        if (E.seg < E.lw + 8) fail(E.path, 'the label ' + JSON.stringify(E.label) + ' needs ' + Math.ceil(E.lw) + 'px but the connector has only ' + Math.max(0, Math.floor(E.seg)) + 'px of straight line; shorten the label, move the nodes apart, widen the grid "gap" or use "anchors" so the line gets longer');
      }
    });
  }
  function staticFrac(E, i) { // where a packet rests in capture and print: spread along the line, clear of the label pill; null when there is no room
    const n = E.pk.count;
    if (!E.label || !E.len) return (i + 0.35) / n;
    const h = (E.lw / 2 + 14) / E.len, segs = [[0.04, E.lf - h], [E.lf + h, 0.96]].filter((g) => (g[1] - g[0]) * E.len >= 34);
    if (!segs.length) return null;
    const g = segs[i % segs.length], cnt = Math.ceil((n - (i % segs.length)) / segs.length), k = Math.floor(i / segs.length);
    return g[0] + (g[1] - g[0]) * (k + 0.5) / cnt;
  }
  const edgeAt = (E, f) => (E.cub ? bez(E.cub[0], E.cub[1], E.cub[2], E.cub[3], f) : polyAt(E.pts, f));

  // ---------- drawing
  function tbl(g, cx, cy, lab, sub, o) { // centered text block (label lines then sub lines)
    const lh = o.lh || LH, slh = o.slh || SLH, th = lab.length * lh + (sub && sub.length ? 6 + sub.length * slh : 0);
    let y = cy - th / 2;
    lab.forEach((t) => { S('text', { class: 't md-t md-lab' + (o.cls ? ' ' + o.cls : ''), x: f2(cx), y: f2(y + lh / 2), dy: '.35em', 'text-anchor': o.anchor || 'middle' }, g, t); y += lh; });
    if (sub && sub.length) { y += 6; sub.forEach((t) => { S('text', { class: 'md-t md-sub', x: f2(cx), y: f2(y + slh / 2), dy: '.35em', 'text-anchor': o.anchor || 'middle' }, g, t); y += slh; }); }
  }
  function icon(g, name, x, y, size) {
    const k = size / 24, gg = S('g', { class: 'md-icon', transform: 'translate(' + f2(x) + ' ' + f2(y) + ') scale(' + f2(k) + ')' }, g);
    gg.innerHTML = ICONS[name];
  }
  function nice(max, cap, target) {
    const top = cap || max; if (!(top > 0)) return { max: 1, ticks: [0, 1] };
    const raw = top / (target || 4), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    const st = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p, mx = cap || Math.ceil(top / st - 1e-9) * st, ticks = [];
    for (let v = 0; v <= mx + st * 1e-6; v += st) ticks.push(+v.toPrecision(12));
    return { max: mx, ticks };
  }
  const DRAW = {};
  function rrect(g, r, cls, extra) { return S('rect', Object.assign({ class: 'md-shape md-rr' + (cls ? ' ' + cls : ''), x: f2(r.x), y: f2(r.y), width: f2(r.w), height: f2(r.h) }, extra), g); }
  function drawBoxLike(g, N, env) {
    const r = N.r, nat = N.nat, k = N.kind, c = BOXCFG[k];
    if (k === 'pill' || k === 'chip') S('rect', { class: 'md-shape md-pill', x: f2(r.x), y: f2(r.y), width: f2(r.w), height: f2(r.h), rx: f2(r.h / 2) }, g);
    else if (k === 'stack') {
      const pr = N.pr; rrect(g, { x: pr.x + 20, y: pr.y + 20, w: pr.w, h: pr.h }, 'md-back2'); rrect(g, { x: pr.x + 10, y: pr.y + 10, w: pr.w, h: pr.h }, 'md-back1'); rrect(g, pr);
    } else rrect(g, r, k === 'ghost' ? 'md-ghost' : '');
    const pr = N.pr, iw = nat.iconW || 0, left = pr.x + c.px + iw, right = pr.x + pr.w - c.px, cx = (left + right) / 2, cy = pr.y + pr.h / 2;
    if (N.s.icon) icon(g, N.s.icon, pr.x + c.px, cy - 15, 30);
    tbl(g, cx, cy, nat.lab, nat.sub, { cls: k === 'chip' ? 'md-chip-t' : k === 'ghost' ? 'md-ghost-t' : '', lh: k === 'chip' ? 26 : LH });
  }
  ['box', 'stack', 'ghost', 'pill', 'chip'].forEach((k) => { DRAW[k] = drawBoxLike; });
  DRAW.diamond = (g, N) => {
    const r = N.r, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    S('polygon', { class: 'md-shape md-poly', points: [[cx, r.y], [r.x + r.w, cy], [cx, r.y + r.h], [r.x, cy]].map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ') }, g);
    tbl(g, cx, cy, N.nat.lab, N.nat.sub, { lh: 30, slh: 23, cls: 'md-dia' });
  };
  DRAW.text = (g, N) => {
    const r = N.r, nat = N.nat, s = N.s, al = s.align || 'middle', anchor = al === 'start' || al === 'left' ? 'start' : al === 'end' || al === 'right' ? 'end' : 'middle';
    const x = anchor === 'start' ? r.x : anchor === 'end' ? r.x + r.w : r.x + r.w / 2, th = nat.lab.length * nat.lh;
    const top = s.valign === 'top' ? r.y : s.valign === 'bottom' ? r.y + r.h - th : r.y + (r.h - th) / 2;
    nat.lab.forEach((t, i) => { S('text', { class: 't md-t md-free', x: f2(x), y: f2(top + (i + 0.5) * nat.lh), dy: '.35em', 'text-anchor': anchor, style: 'font-size:' + nat.size + 'px;font-weight:' + nat.wt + ';font-family:' + (s.mono ? 'var(--f-mono, ui-monospace, monospace)' : 'var(--f-body, system-ui, sans-serif)') }, g, t); });
  };
  DRAW.group = (g, N, env) => {
    const r = N.r; rrect(g, r, 'md-group' + (N.s.dashed ? ' md-dash' : ''));
    if (N.s.title) {
      const t = N.s.title, tw = env.w(t, 20, env.wB, env.body) * 1.04 + t.length * 1.7 + 24;
      S('rect', { class: 'md-gtbg', x: f2(r.x + 22), y: f2(r.y - 13), width: f2(tw), height: 26, rx: 13 }, g);
      S('text', { class: 'md-t md-gt', x: f2(r.x + 34), y: f2(r.y), dy: '.35em' }, g, t);
    }
  };
  DRAW.person = (g, N) => {
    const r = N.r, nat = N.nat, cx = r.x + r.w / 2, y = r.y, gs = nat.gs;
    S('circle', { class: 'md-shape', cx: f2(cx), cy: f2(y + 24), r: 20 }, g);
    S('path', { class: 'md-shape', d: 'M' + f2(cx - 38) + ' ' + f2(y + gs) + ' C' + f2(cx - 38) + ' ' + f2(y + 56) + ' ' + f2(cx - 22) + ' ' + f2(y + 50) + ' ' + f2(cx) + ' ' + f2(y + 50) + ' C' + f2(cx + 22) + ' ' + f2(y + 50) + ' ' + f2(cx + 38) + ' ' + f2(y + 56) + ' ' + f2(cx + 38) + ' ' + f2(y + gs) + ' Z' }, g);
    tbl(g, cx, y + gs + 14 + nat.th / 2, nat.lab, nat.sub, {});
  };
  DRAW.cylinder = (g, N) => {
    const r = N.r, ry = N.nat.ry, rx = r.w / 2, x2 = r.x + r.w;
    S('path', { class: 'md-shape', d: 'M' + f2(r.x) + ' ' + f2(r.y + ry) + ' A' + f2(rx) + ' ' + ry + ' 0 0 1 ' + f2(x2) + ' ' + f2(r.y + ry) + ' V' + f2(r.y + r.h - ry) + ' A' + f2(rx) + ' ' + ry + ' 0 0 1 ' + f2(r.x) + ' ' + f2(r.y + r.h - ry) + ' Z' }, g);
    S('path', { class: 'md-lip', d: 'M' + f2(r.x) + ' ' + f2(r.y + ry) + ' A' + f2(rx) + ' ' + ry + ' 0 0 0 ' + f2(x2) + ' ' + f2(r.y + ry) }, g);
    tbl(g, r.x + rx, r.y + ry + (r.h - 2 * ry) / 2 + ry / 2, N.nat.lab, N.nat.sub, {});
  };
  DRAW.cloud = (g, N) => {
    const r = N.r, X = (v) => f2(r.x + v * r.w / 100), Y = (v) => f2(r.y + v * r.h / 54), P = (a, b) => X(a) + ' ' + Y(b);
    S('path', { class: 'md-shape', d: 'M' + P(24, 54) + ' C' + P(8, 54) + ' ' + P(1, 38) + ' ' + P(13, 31) + ' C' + P(8, 14) + ' ' + P(27, 5) + ' ' + P(37, 14) + ' C' + P(43, 0) + ' ' + P(67, 0) + ' ' + P(72, 14) + ' C' + P(88, 8) + ' ' + P(99, 25) + ' ' + P(88, 35) + ' C' + P(99, 48) + ' ' + P(90, 54) + ' ' + P(78, 54) + ' Z' }, g);
    tbl(g, r.x + r.w / 2, r.y + r.h * 0.56, N.nat.lab, N.nat.sub, {});
  };
  DRAW.dot = (g, N) => {
    const r = N.r, cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = N.s;
    S('circle', { class: 'md-fillt', cx: f2(cx), cy: f2(cy), r: f2(r.w / 2) }, g);
    if (s.label) {
      const pos = s.labelPos || 'r';
      S('text', { class: 'md-t md-lab md-sm', x: f2(pos === 'r' ? r.x + r.w + 12 : cx), y: f2(pos === 'b' ? cy + r.h / 2 + 24 : pos === 't' ? cy - r.h / 2 - 24 : cy), dy: '.35em', 'text-anchor': pos === 'r' ? 'start' : 'middle' }, g, s.label);
    }
  };
  function arcRing(g, cx, cy, rad, sw, pct) {
    S('circle', { class: 'md-track', cx: f2(cx), cy: f2(cy), r: f2(rad), style: 'stroke-width:' + sw + 'px' }, g);
    const a = S('circle', { class: 'md-arc md-grow-arc', cx: f2(cx), cy: f2(cy), r: f2(rad), pathLength: 100, transform: 'rotate(-90 ' + f2(cx) + ' ' + f2(cy) + ')', style: 'stroke-width:' + sw + 'px;stroke-dasharray:' + pct + ' 100;--v:' + pct }, g);
    return a;
  }
  DRAW.ring = (g, N) => {
    const r = N.r, nat = N.nat, cx = r.x + r.w / 2, cy = r.y + nat.d / 2, v = N.s.value;
    arcRing(g, cx, cy, nat.d / 2 - 8, 14, v);
    S('text', { class: 't md-t md-bigv', x: f2(cx), y: f2(cy), dy: '.35em', 'text-anchor': 'middle', style: 'font-size:30px' }, g, Math.round(v) + '%');
    if (nat.lab && nat.lab.length) tbl(g, cx, r.y + nat.d + 14 + nat.lab.length * 14, nat.lab, null, { lh: 28, cls: 'md-sm' });
  };
  DRAW.spinner = (g, N) => {
    const r = N.r, nat = N.nat, cx = r.x + r.w / 2, cy = r.y + nat.d / 2;
    S('circle', { class: 'md-track', cx: f2(cx), cy: f2(cy), r: f2(nat.d / 2 - 5), style: 'stroke-width:7px' }, g);
    S('circle', { class: 'md-arc md-spin', cx: f2(cx), cy: f2(cy), r: f2(nat.d / 2 - 5), pathLength: 100, style: 'stroke-width:7px;stroke-dasharray:28 72' }, g);
    if (nat.lab && nat.lab.length) tbl(g, cx, r.y + nat.d + 14 + nat.lab.length * 14, nat.lab, null, { lh: 28, cls: 'md-sm' });
  };
  DRAW.badge = (g, N) => {
    const r = N.r;
    S('rect', { class: 'md-fillt', x: f2(r.x), y: f2(r.y), width: f2(r.w), height: f2(r.h), rx: f2(r.h / 2) }, g);
    S('text', { class: 't md-t md-badge-t', x: f2(r.x + r.w / 2), y: f2(r.y + r.h / 2), dy: '.35em', 'text-anchor': 'middle' }, g, String(N.s.label));
  };
  DRAW.kpi = (g, N, env) => {
    const r = N.r, nat = N.nat, s = N.s, cx = r.x + r.w / 2;
    rrect(g, r);
    const total = 82 + 6 + nat.lab.length * 30 + (s.delta ? 34 : 0);
    let y = r.y + (r.h - total) / 2;
    S('text', { class: 't md-t md-kpi-v', x: f2(cx), y: f2(y + 41), dy: '.35em', 'text-anchor': 'middle', style: nat.fs < 72 ? 'font-size:' + nat.fs + 'px' : null }, g, nat.vs);
    y += 88;
    nat.lab.forEach((t) => { S('text', { class: 'md-t md-sub md-kpi-l', x: f2(cx), y: f2(y + 15), dy: '.35em', 'text-anchor': 'middle' }, g, t); y += 30; });
    if (s.delta) {
      const d = String(s.delta), tn = s.deltaTone || (d[0] === '-' || d[0] === '−' ? 'danger' : d[0] === '+' ? 'ok' : 'muted'), up = d[0] !== '-' && d[0] !== '−';
      const dw = env.w(d, 22, env.wB, env.body), x0 = cx - (dw + 22) / 2, c = toneCss(tn);
      S('path', { d: up ? 'M' + f2(x0) + ' ' + f2(y + 21) + ' l7 -12 l7 12 z' : 'M' + f2(x0) + ' ' + f2(y + 9) + ' l7 12 l7 -12 z', style: 'fill:' + c }, g);
      S('text', { class: 't md-t md-delta', x: f2(x0 + 22), y: f2(y + 15), dy: '.35em', style: 'fill:' + c }, g, d);
    }
  };
  function chartTitle(g, s, r) { if (!s.title) return 0; S('text', { class: 'md-t md-sub md-ctitle', x: f2(r.x + 4), y: f2(r.y + 12), dy: '.35em' }, g, s.title); return 34; }
  function ticksFor(g, env, s, sc, x0, y0, pw, ph, horiz) {
    sc.ticks.forEach((t) => {
      const lab = env.fmt(t, s.decimals, s.unit, s.prefix);
      if (horiz) { const x = x0 + t / sc.max * pw; S('line', { class: 'md-grid', x1: f2(x), x2: f2(x), y1: y0, y2: f2(y0 + ph) }, g); S('text', { class: 'md-t md-tick', x: f2(x), y: f2(y0 + ph + 22), dy: '.35em', 'text-anchor': 'middle' }, g, lab); }
      else { const y = y0 + ph - t / sc.max * ph; S('line', { class: 'md-grid', x1: x0, x2: f2(x0 + pw), y1: f2(y), y2: f2(y) }, g); S('text', { class: 't md-t md-tick', x: f2(x0 - 12), y: f2(y), dy: '.35em', 'text-anchor': 'end' }, g, lab); }
    });
  }
  DRAW.bars = (g, N, env) => {
    const s = N.s, r = N.r, vals = s.values, labs = s.labels || [], horiz = s.orient === 'h', n = vals.length;
    const sc = nice(Math.max.apply(null, vals), s.max, 4), hi = s.hi === undefined ? null : [].concat(s.hi);
    const tt = chartTitle(g, s, r), showTicks = s.ticks !== undefined ? s.ticks : !horiz;
    const fmt = (v) => env.fmt(v, s.decimals, s.unit, s.prefix);
    const cls = (i) => 'md-bar ' + (hi && !hi.includes(i) ? 'md-dim' : 'md-fillt');
    if (!horiz) {
      const tw = showTicks ? Math.max.apply(null, sc.ticks.map((t) => env.w(fmt(t), 18, env.wR, env.mono))) + 18 : 0;
      const x0 = r.x + tw, y0 = r.y + tt + 34, pw = r.w - tw, ph = r.h - tt - 34 - (labs.length ? 46 : 10);
      if (ph < 40) fail(N.path, 'the chart area is too short (' + Math.round(r.h) + 'px); give it a taller cell or "h"');
      if (showTicks) ticksFor(g, env, s, sc, x0, y0, pw, ph, false); else S('line', { class: 'md-grid', x1: x0, x2: f2(x0 + pw), y1: f2(y0 + ph), y2: f2(y0 + ph) }, g);
      const slot = pw / n, bw = Math.min(slot * 0.58, 120);
      vals.forEach((v, i) => {
        const bh = v / sc.max * ph, bx = x0 + slot * i + (slot - bw) / 2;
        S('rect', { class: cls(i) + ' md-gy', x: f2(bx), y: f2(y0 + ph - bh), width: f2(bw), height: f2(bh), rx: Math.min(8, bw / 3), style: '--bi:' + i }, g);
        S('text', { class: 't md-t md-val md-fadein', x: f2(bx + bw / 2), y: f2(y0 + ph - bh - 16), dy: '.35em', 'text-anchor': 'middle', style: '--si:' + i }, g, fmt(v));
        if (labs[i] != null) { const wl = env.wrap(String(labs[i]), slot - 8, 22, env.wR, env.body); if (wl.bad || wl.lines.length > 2) fail(N.path, 'label ' + JSON.stringify(String(labs[i])) + ' does not fit under its bar (' + Math.round(slot - 8) + 'px wide); use shorter labels, fewer bars or a wider chart'); wl.lines.forEach((t, j) => S('text', { class: 't md-t md-cat', x: f2(bx + bw / 2), y: f2(y0 + ph + 26 + j * 24), dy: '.35em', 'text-anchor': 'middle' }, g, t)); }
      });
    } else {
      const lw = labs.length ? Math.max.apply(null, labs.map((l) => env.w(String(l), 22, env.wR, env.body))) + 22 : 0, vw = Math.max.apply(null, vals.map((v) => env.w(fmt(v), 22, env.wB, env.body))) + 18;
      const x0 = r.x + lw, y0 = r.y + tt, pw = r.w - lw - vw, ph = r.h - tt - (showTicks ? 36 : 0);
      if (pw < 60) fail(N.path, 'labels and values leave only ' + Math.round(pw) + 'px for the bars; shorten the labels or widen the chart');
      if (showTicks) ticksFor(g, env, s, sc, x0, y0, pw, ph, true);
      const slot = ph / n, bh = Math.min(slot * 0.58, 56);
      vals.forEach((v, i) => {
        const bw = v / sc.max * pw, by = y0 + slot * i + (slot - bh) / 2;
        S('rect', { class: cls(i) + ' md-gx', x: f2(x0), y: f2(by), width: f2(bw), height: bh, rx: Math.min(8, bh / 3), style: '--bi:' + i }, g);
        S('text', { class: 't md-t md-val md-fadein', x: f2(x0 + bw + 12), y: f2(by + bh / 2), dy: '.35em', style: '--si:' + i }, g, fmt(v));
        if (labs[i] != null) S('text', { class: 't md-t md-cat', x: f2(x0 - 14), y: f2(by + bh / 2), dy: '.35em', 'text-anchor': 'end' }, g, String(labs[i]));
      });
    }
  };
  DRAW.line = (g, N, env) => {
    const s = N.s, r = N.r, vals = s.values, labs = s.labels || [], n = vals.length, lo = Math.min.apply(null, vals), hiV = Math.max.apply(null, vals);
    const zero = s.zero !== false && lo >= 0, base = s.min !== undefined ? s.min : zero ? 0 : lo - (hiV - lo) * 0.15;
    const span = nice(hiV - base, s.max !== undefined ? s.max - base : undefined, 4), top = base + span.max;
    const fmt = (v) => env.fmt(v, s.decimals, s.unit, s.prefix), showTicks = s.ticks !== false;
    const ticks = span.ticks.map((t) => +(base + t).toPrecision(12)), tt = chartTitle(g, s, r);
    const tw = showTicks ? Math.max.apply(null, ticks.map((t) => env.w(fmt(t), 18, env.wR, env.mono))) + 18 : 0;
    const x0 = r.x + tw + 22, y0 = r.y + tt + 34, pw = r.w - tw - 44, ph = r.h - tt - 34 - (labs.length ? 46 : 12);
    if (ph < 40) fail(N.path, 'the chart area is too short (' + Math.round(r.h) + 'px); give it a taller cell or "h"');
    const Y = (v) => y0 + ph - (v - base) / (top - base) * ph, X = (i) => x0 + i * pw / (n - 1);
    ticks.forEach((t) => { const y = Y(t); S('line', { class: 'md-grid', x1: f2(r.x + tw), x2: f2(r.x + r.w), y1: f2(y), y2: f2(y) }, g); if (showTicks) S('text', { class: 't md-t md-tick', x: f2(r.x + tw - 12), y: f2(y), dy: '.35em', 'text-anchor': 'end' }, g, fmt(t)); });
    let d = 'M' + f2(X(0)) + ' ' + f2(Y(vals[0]));
    for (let i = 1; i < n; i++) d += s.smooth ? ' C' + f2((X(i - 1) + X(i)) / 2) + ' ' + f2(Y(vals[i - 1])) + ' ' + f2((X(i - 1) + X(i)) / 2) + ' ' + f2(Y(vals[i])) + ' ' + f2(X(i)) + ' ' + f2(Y(vals[i])) : ' L' + f2(X(i)) + ' ' + f2(Y(vals[i]));
    if (s.area) S('path', { class: 'md-area', d: d + ' L' + f2(X(n - 1)) + ' ' + f2(Y(base)) + ' L' + f2(X(0)) + ' ' + f2(Y(base)) + ' Z' }, g);
    S('path', { class: 'md-curve md-draw-line', d, pathLength: 1 }, g);
    if (s.markers) vals.forEach((v, i) => S('circle', { class: 'md-fillt md-mk', cx: f2(X(i)), cy: f2(Y(v)), r: 5 }, g));
    const ex = X(n - 1), ey = Y(vals[n - 1]), end = S('g', { class: 'md-endpt' }, g);
    S('circle', { class: 'md-halo', cx: f2(ex), cy: f2(ey), r: 15 }, end); S('circle', { class: 'md-fillt md-endc', cx: f2(ex), cy: f2(ey), r: 8 }, end);
    const above = ey - 26 > r.y + tt;
    S('text', { class: 't md-t md-val', x: f2(ex + 6), y: f2(above ? ey - 28 : ey + 30), dy: '.35em', 'text-anchor': 'end' }, end, fmt(vals[n - 1]));
    const every = n <= 12 ? 1 : Math.ceil(n / 10);
    labs.forEach((l, i) => { if (i % every === 0 || i === n - 1) S('text', { class: 't md-t md-cat', x: f2(X(i)), y: f2(y0 + ph + 30), dy: '.35em', 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, g, String(l)); });
  };
  DRAW.donut = (g, N, env) => {
    const s = N.s, r = N.r, segs = s.segments, total = segs.reduce((a, b) => a + b.value, 0), tt = chartTitle(g, s, r);
    const legend = s.legend !== false, D = Math.min(r.h - tt - 6, legend ? r.w * 0.5 : r.w, 380), sw = Math.max(26, Math.min(58, D * 0.2)), rad = D / 2 - sw / 2 - 2;
    const legW = legend ? Math.min(Math.max(260, Math.max.apply(null, segs.map((g) => env.w(g.label, 24, env.wR, env.body))) + 190), 400, r.w - D - 56) : 0, shift = legend ? Math.max(0, (r.w - D - 56 - legW) / 2) : 0;
    const cx = r.x + shift + (legend ? D / 2 + 6 : r.w / 2), cy = r.y + tt + (r.h - tt) / 2;
    S('circle', { class: 'md-track', cx: f2(cx), cy: f2(cy), r: f2(rad), style: 'stroke-width:' + f2(sw) + 'px' }, g);
    let acc = 0; const gap = segs.length > 1 ? 0.8 : 0;
    segs.forEach((sg, i) => {
      const len = sg.value / total * 100;
      if (len <= 0) return;
      const l = Math.max(0.01, len - gap), t = sg.tone || (i % 6) + 1;
      S('circle', { class: 'md-seg md-sweep', cx: f2(cx), cy: f2(cy), r: f2(rad), pathLength: 100, transform: 'rotate(-90 ' + f2(cx) + ' ' + f2(cy) + ')', style: 'stroke:' + toneCss(t) + ';stroke-width:' + f2(sw) + 'px;stroke-dasharray:' + f2(l) + ' ' + f2(100 - l) + ';stroke-dashoffset:' + f2(-(acc + gap / 2)) + ';--l:' + f2(l) + ';--r:' + f2(100 - l) + ';--si:' + i }, g);
      acc += len;
    });
    const ctr = s.center !== undefined ? String(s.center) : env.fmt(total, s.decimals, s.unit);
    const cw = env.w(ctr, 52, env.wD, env.display);
    if (cw > (rad - sw / 2) * 1.9) fail(N.path, 'the center text ' + JSON.stringify(ctr) + ' (' + Math.round(cw) + 'px) does not fit the hole of the donut (' + Math.round((rad - sw / 2) * 1.9) + 'px); shorten "center" or make the chart bigger');
    S('text', { class: 't md-t md-bigv', x: f2(cx), y: f2(cy - (s.centerSub ? 10 : 0)), dy: '.35em', 'text-anchor': 'middle', style: 'font-size:52px' }, g, ctr);
    if (s.centerSub) S('text', { class: 'md-t md-sub', x: f2(cx), y: f2(cy + 30), dy: '.35em', 'text-anchor': 'middle' }, g, s.centerSub);
    if (legend) {
      const lx = r.x + shift + D + 56, lw = legW, rows = segs.length, rh = Math.min(48, (r.h - tt) / rows), ly = cy - rows * rh / 2;
      segs.forEach((sg, i) => {
        const y = ly + i * rh + rh / 2, t = sg.tone || (i % 6) + 1, val = s.unit ? env.fmt(sg.value, s.decimals, s.unit) : Math.round(sg.value / total * 100) + '%';
        if (env.w(sg.label, 24, env.wR, env.body) + env.w(val, 22, env.wB, env.mono) + 70 > lw) fail(N.path, 'legend label ' + JSON.stringify(sg.label) + ' is too long for the legend (' + Math.round(lw) + 'px); shorten it, widen the chart or use "legend": false');
        const row = S('g', { class: 'md-leg md-fadein', style: '--si:' + i }, g);
        S('rect', { x: f2(lx), y: f2(y - 9), width: 18, height: 18, rx: 5, style: 'fill:' + toneCss(t) }, row);
        S('text', { class: 't md-t md-cat md-legl', x: f2(lx + 32), y: f2(y), dy: '.35em' }, row, sg.label);
        S('text', { class: 't md-t md-val md-sm', x: f2(lx + lw), y: f2(y), dy: '.35em', 'text-anchor': 'end' }, row, val);
      });
    }
  };
  DRAW.gauge = (g, N, env) => {
    const s = N.s, r = N.r, mx = s.max === undefined ? 100 : s.max, pct = s.value / mx * 100, sw = 22;
    const d = Math.min(r.w, r.h - 4), rad = d / 2 - sw / 2 - 4, cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 2;
    const pt = (a) => f2(cx + rad * Math.cos(a * Math.PI / 180)) + ' ' + f2(cy + rad * Math.sin(a * Math.PI / 180)), path = 'M' + pt(135) + ' A' + f2(rad) + ' ' + f2(rad) + ' 0 1 1 ' + pt(405);
    S('path', { class: 'md-track', d: path, style: 'stroke-width:' + sw + 'px;stroke-linecap:round' }, g);
    S('path', { class: 'md-arc md-grow-arc', d: path, pathLength: 100, style: 'stroke-width:' + sw + 'px;stroke-linecap:round;stroke-dasharray:' + f2(pct) + ' 100;--v:' + f2(pct) }, g);
    const vs = env.fmt(s.value, s.decimals, s.unit);
    if (env.w(vs, 56, env.wD, env.display) > rad * 1.5) fail(N.path, 'the value text ' + JSON.stringify(vs) + ' does not fit the gauge; shorten "unit" or make the gauge bigger');
    S('text', { class: 't md-t md-bigv', x: f2(cx), y: f2(cy), dy: '.35em', 'text-anchor': 'middle', style: 'font-size:56px' }, g, vs);
    if (s.label) S('text', { class: 'md-t md-sub', x: f2(cx), y: f2(cy + rad * 0.86), dy: '.35em', 'text-anchor': 'middle' }, g, s.label);
  };

  function outline(N, pad) {
    const r = N.r, k = N.kind;
    if (k === 'diamond') { const cx = r.x + r.w / 2, cy = r.y + r.h / 2, px = pad * 1.6; return S('polygon', { class: 'md-hl', points: [[cx, r.y - px], [r.x + r.w + px, cy], [cx, r.y + r.h + px], [r.x - px, cy]].map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ') }); }
    if (k === 'dot' || k === 'spinner' || k === 'ring' || k === 'badge') { return S('circle', { class: 'md-hl', cx: f2(r.x + r.w / 2), cy: f2(r.y + (N.nat.d || r.h) / 2), r: f2((N.nat.d || r.w) / 2 + pad) }); }
    return S('rect', { class: 'md-hl md-rr', x: f2(r.x - pad), y: f2(r.y - pad), width: f2(r.w + 2 * pad), height: f2(r.h + 2 * pad), style: 'rx:calc(var(--radius, 14px) + ' + pad + 'px)' });
  }

  // ---------- render
  function render(M, svg, env) {
    const old = svg.querySelector(':scope > g.md-root'); if (old) old.remove();
    svg.classList.add('md-diagram');
    const root = S('g', { class: 'md-root' }, svg), L = {};
    ['g', 'e', 'n', 'o'].forEach((k) => { L[k] = S('g', { class: 'md-layer md-l-' + k }, root); });
    const els = [], byEl = new Map();
    const entr = (N) => N.entr || (['text', 'group', 'ring', 'bars', 'line', 'donut', 'gauge'].includes(N.kind) ? 'fade' : ['dot', 'badge', 'spinner'].includes(N.kind) ? 'pop' : 'rise');
    M.nodes.forEach((N) => {
      const layer = N.kind === 'group' ? L.g : N.kind === 'badge' ? L.o : L.n, e = entr(N);
      const g = S('g', { class: 'md-el md-n md-k-' + N.kind + ' md-e-' + e + (N.tone !== undefined ? ' md-tone' : '') + (N.id ? ' md-id-' + N.id.replace(/[^\w-]/g, '_') : ''), style: '--t:' + toneCss(N.tone), 'data-kind': N.kind }, layer);
      if (N.id) g.setAttribute('data-id', N.id);
      DRAW[N.kind](g, N, env);
      if (N.hl) g.appendChild(outline(N, 8));
      const el = { g, N, step: N.step, out: N.out, hl: N.hl, kind: 'node' }; els.push(el); byEl.set(N, el);
    });
    M.edges.forEach((E) => {
      const g = S('g', { class: 'md-el md-edge md-e-' + (E.draw && !E.dashed ? 'edge' : 'fade') + (E.tone !== undefined ? ' md-tone' : ''), style: '--t:' + (E.tone !== undefined ? toneCss(E.tone) : 'var(--muted, #a9b4c0)'), 'data-from': E.from.id, 'data-to': E.to.id }, L.e);
      const ln = S('path', { class: 'md-line' + (E.dashed ? ' md-dashed' : ''), d: E.d }, g);
      if (!E.dashed) ln.setAttribute('pathLength', '1');
      if (E.hl) S('path', { class: 'md-hl md-hl-line' + (E.dashed ? ' md-dashed' : ''), d: E.d }, g);
      E.heads.forEach((p) => S('polygon', { class: 'md-head', points: p }, g));
      const pks = [];
      if (E.pk) {
        const pg = S('g', { class: 'md-pk' }, g);
        for (let i = 0; i < E.pk.count; i++) {
          const c = S('circle', { class: 'md-pkt', r: E.pk.size }, pg), off = -(i * E.pk.dur / E.pk.count), dur = E.pk.dur + 's';
          const mo = S('animateMotion', { path: E.d, dur, repeatCount: 'indefinite', begin: f2(off) + 's', calcMode: 'linear' }), an = S('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;.1;.9;1', dur, repeatCount: 'indefinite', begin: f2(off) + 's' });
          const f = staticFrac(E, i), pos = f == null ? null : edgeAt(E, f);
          pks.push({ c, anims: [mo, an], pos }); c.appendChild(mo); c.appendChild(an);
        }
      }
      if (E.label) {
        S('rect', { class: 'md-lblbg', x: f2(E.lbl[0] - E.lw / 2), y: f2(E.lbl[1] - 16), width: f2(E.lw), height: 32, rx: 16 }, g);
        S('text', { class: 't md-t md-elab', x: f2(E.lbl[0]), y: f2(E.lbl[1]), dy: '.35em', 'text-anchor': 'middle' }, g, E.label);
      }
      els.push({ g, E, step: E.step, out: E.out, hl: E.hl, kind: 'edge', pks });
    });
    // delays
    const START = 240, STAG = 90, counters = {}, nodeD = new Map();
    let prev = null;
    els.forEach((e) => {
      if (e.kind !== 'node') return;
      const N = e.N; let d;
      if (N.delay !== undefined) d = N.delay;
      else if (N.sync && prev && prev.step === e.step) d = prev.d;
      else { const k = counters[e.step] = (counters[e.step] === undefined ? 0 : counters[e.step] + 1); d = (e.step ? 0 : START) + k * STAG; }
      e.d = d; prev = e; nodeD.set(N, e);
    });
    prev = null;
    els.forEach((e) => {
      if (e.kind !== 'edge') return;
      const E = e.E; let d;
      if (E.delay !== undefined) d = E.delay;
      else if (E.sync && prev && prev.step === e.step) d = prev.d;
      else if (nodeD.get(E.from).step === e.step) d = nodeD.get(E.from).d + 180;
      else { const k = counters[e.step] = (counters[e.step] === undefined ? 0 : counters[e.step] + 1); d = (e.step ? 0 : START) + k * STAG; }
      e.d = d; prev = e;
    });
    // data-ds, data-do and data-dh (build, leave and highlight step) let a copy of the drawing, such as the presenter's preview, show any step without the instance.
    els.forEach((e) => {
      e.g.style.setProperty('--md-d', e.d + 'ms');
      e.g.setAttribute('data-ds', e.step);
      if (e.out != null) e.g.setAttribute('data-do', e.out);
      if (e.hl) e.g.setAttribute('data-dh', e.hl);
      if (e.step > 0) e.g.classList.add('md-hid');
    });
    return { els, steps: stepsOf(M), vis: null };
  }
  function stepsOf(M) { let m = 0; M.nodes.concat(M.edges).forEach((o) => { m = Math.max(m, o.step || 0, o.out || 0, o.hl || 0); }); return m; }

  // ---------- CSS
  const CSS = `
.md-diagram{overflow:visible}
.md-diagram .md-t{font-family:var(--f-body,system-ui,sans-serif);fill:var(--text,#f2f5f8)}
.md-diagram .md-lab{font-size:26px;font-weight:var(--w-bold,700)}
.md-diagram .md-lab.md-sm{font-size:22px}
.md-diagram .md-chip-t{font-size:20px}
.md-diagram .md-dia{font-size:22px}
.md-diagram .md-sub{font-size:20px;font-weight:var(--w-body,400);fill:var(--muted,#a9b4c0)}
.md-diagram .md-ghost-t{fill:var(--muted,#a9b4c0);font-weight:var(--w-body,400)}
.md-diagram .md-gt{font-size:20px;font-weight:var(--w-bold,700);letter-spacing:.08em;text-transform:uppercase;fill:var(--muted,#a9b4c0)}
.md-diagram .md-tone .md-gt{fill:var(--t)}
.md-gtbg{fill:var(--bg,#101418)}
.md-diagram .md-free{font-weight:var(--w-body,400)}
.md-diagram .md-tone .md-free{fill:var(--t)}
.md-diagram .md-bigv,.md-diagram .md-kpi-v{font-family:var(--f-display,var(--f-body,system-ui,sans-serif));font-weight:var(--w-display,700);fill:var(--text,#f2f5f8)}
.md-diagram .md-kpi-v{font-size:72px;fill:var(--t)}
.md-diagram .md-kpi-l{font-size:24px}
.md-diagram .md-delta{font-size:22px;font-weight:var(--w-bold,700)}
.md-diagram .md-badge-t{font-size:20px;font-weight:var(--w-bold,700);fill:var(--on-acc,#101418)}
.md-diagram .md-val{font-size:22px;font-weight:var(--w-bold,700)}
.md-diagram .md-val.md-sm{font-size:22px;font-family:var(--f-mono,ui-monospace,monospace);font-weight:var(--w-body,400)}
.md-diagram .md-cat,.md-diagram .md-ctitle{font-size:22px;font-weight:var(--w-body,400);fill:var(--muted,#a9b4c0)}
.md-diagram .md-legl{fill:var(--text,#f2f5f8)}
.md-diagram .md-tick{font-family:var(--f-mono,ui-monospace,monospace);font-size:18px;fill:var(--muted,#a9b4c0)}
.md-diagram .md-elab{font-family:var(--f-mono,ui-monospace,monospace);font-size:19px;fill:var(--text,#f2f5f8)}
.md-shape{fill:var(--panel,#1a222b);stroke:var(--line,#2b3440);stroke-width:var(--stroke,2px);stroke-linejoin:round}
.md-rr{rx:var(--radius,14px)}
.md-tone .md-shape{stroke:var(--t);fill:var(--panel,#1a222b);fill:color-mix(in srgb,var(--t) 14%,var(--panel,#1a222b))}
.md-back1{fill:var(--bg-2,#171d24)}.md-back2{fill:var(--bg-2,#171d24);opacity:.7}
.md-tone .md-back1,.md-tone .md-back2{fill:var(--bg-2,#171d24);fill:color-mix(in srgb,var(--t) 7%,var(--bg-2,#171d24))}
.md-group{fill:var(--bg-2,#171d24);stroke:var(--line,#2b3440);stroke-width:1.5px}
.md-tone .md-group{stroke:var(--t);fill:var(--bg-2,#171d24);fill:color-mix(in srgb,var(--t) 6%,var(--bg-2,#171d24))}
.md-dash,.md-ghost{stroke-dasharray:9 7}
.md-ghost{fill:none;stroke:var(--muted,#a9b4c0);opacity:.8}
.md-lip{fill:none;stroke:var(--line,#2b3440);stroke-width:var(--stroke,2px)}
.md-tone .md-lip{stroke:var(--t)}
.md-icon{fill:none;stroke:var(--t);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.md-fillt{fill:var(--t)}
.md-track{fill:none;stroke:var(--line,#2b3440)}
.md-arc{fill:none;stroke:var(--t);stroke-linecap:round}
.md-seg{fill:none}
.md-spin{transform-box:fill-box;transform-origin:center;animation:md-spin 1.1s linear infinite}
.md-bar.md-dim{fill:var(--muted,#a9b4c0);fill:color-mix(in srgb,var(--muted,#a9b4c0) 40%,var(--panel,#1a222b))}
.md-grid{stroke:var(--line,#2b3440);stroke-width:1.5px}
.md-curve{fill:none;stroke:var(--t);stroke-width:4px;stroke-linecap:round;stroke-linejoin:round}
.md-area{fill:var(--t);fill-opacity:.14}
.md-halo{fill:var(--t);fill-opacity:.22}
.md-endc{stroke:var(--bg,#101418);stroke-width:3px}
.md-mk{stroke:var(--bg,#101418);stroke-width:2px}
.md-line{fill:none;stroke:var(--t);stroke-width:var(--stroke,2px);stroke-linecap:butt}
.md-line.md-dashed{stroke-dasharray:9 8}
.md-head{fill:var(--t)}
.md-lblbg{fill:var(--bg,#101418);stroke:var(--line,#2b3440);stroke-width:1.5px}
.md-pkt{fill:var(--t);stroke:var(--bg,#101418);stroke-width:2px}
.md-edge:not(.md-tone){--t:var(--muted,#a9b4c0)}
.md-edge.md-tone .md-pkt{fill:var(--t)}
.md-pk .md-pkt{fill:var(--acc,var(--a1,#4ea1ff))}
.md-edge.md-tone .md-pk .md-pkt{fill:var(--t)}
.md-hl{fill:none;stroke:var(--acc,var(--a1,#4ea1ff));stroke-width:3.5px;opacity:0;pointer-events:none}
.md-hl.md-dashed{stroke-dasharray:9 8}
.md-hl-line{stroke-width:var(--stroke,2px);stroke-width:5px;stroke-opacity:.9;stroke-linecap:round}
.md-hl.md-on{opacity:1;animation:md-pulse 1.4s ease-in-out .15s 2 both}
.md-el{transition:opacity .3s}
.md-el.md-hid{visibility:hidden;opacity:0;transition:opacity .3s,visibility 0s .3s}
.md-e-pop,.md-e-pop .md-fillt{transform-box:fill-box;transform-origin:center}
.md-play.md-e-rise{animation:md-rise .6s var(--ease-out,cubic-bezier(.16,1,.3,1)) var(--md-d,0ms) both}
.md-play.md-e-fade{animation:md-fade .5s ease-out var(--md-d,0ms) both}
.md-play.md-e-pop{animation:md-pop .5s var(--ease-spring,cubic-bezier(.34,1.56,.64,1)) var(--md-d,0ms) both}
.md-play.md-e-edge .md-line{animation:md-draw .7s var(--ease,cubic-bezier(.2,.8,.2,1)) var(--md-d,0ms) both}
.md-play.md-e-edge .md-head,.md-play.md-e-edge .md-lblbg,.md-play.md-e-edge .md-elab{animation:md-fade .3s ease-out calc(var(--md-d,0ms) + .5s) both}
.md-play .md-pk{animation:md-fade .4s ease-out calc(var(--md-d,0ms) + 1s) both}
.md-play .md-gy,.md-play .md-gx{transform-box:fill-box;animation:md-grow .7s var(--ease-out,cubic-bezier(.16,1,.3,1)) calc(var(--md-d,0ms) + 120ms + var(--bi,0) * 90ms) both}
.md-play .md-gy{transform-origin:50% 100%}
.md-play .md-gx{transform-origin:0 50%;animation-name:md-growx}
.md-play .md-draw-line{animation:md-draw 1s var(--ease,cubic-bezier(.2,.8,.2,1)) calc(var(--md-d,0ms) + 100ms) both}
.md-play .md-area{animation:md-fade .6s ease-out calc(var(--md-d,0ms) + .7s) both}
.md-play .md-endpt{animation:md-pop .5s var(--ease-spring,cubic-bezier(.34,1.56,.64,1)) calc(var(--md-d,0ms) + 1s) both;transform-box:fill-box;transform-origin:center}
.md-play .md-grow-arc{animation:md-arc 1s var(--ease-out,cubic-bezier(.16,1,.3,1)) calc(var(--md-d,0ms) + 150ms) both}
.md-play .md-sweep{animation:md-sweep .8s var(--ease-out,cubic-bezier(.16,1,.3,1)) calc(var(--md-d,0ms) + 100ms + var(--si,0) * 110ms) both}
.md-play .md-fadein{animation:md-fade .4s ease-out calc(var(--md-d,0ms) + 500ms + var(--si,0) * 90ms) both}
@keyframes md-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes md-fade{from{opacity:0}to{opacity:1}}
@keyframes md-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes md-draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}
@keyframes md-grow{from{transform:scaleY(0)}to{transform:none}}
@keyframes md-growx{from{transform:scaleX(0)}to{transform:none}}
@keyframes md-arc{from{stroke-dasharray:0 100}to{stroke-dasharray:var(--v) 100}}
@keyframes md-sweep{from{stroke-dasharray:0 100}to{stroke-dasharray:var(--l) var(--r)}}
@keyframes md-pulse{0%{opacity:0;stroke-width:2px}40%{opacity:1;stroke-width:7px}100%{opacity:1;stroke-width:3.5px}}
@keyframes md-spin{to{transform:rotate(360deg)}}
.md-cap,.md-cap *,html.capture .md-diagram,html.capture .md-diagram *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.md-diagram,.md-diagram *{animation:none!important;transition:none!important}}
`;
  function injectCss() {
    if (document.getElementById('md-diagram-style')) return;
    const st = document.createElement('style'); st.id = 'md-diagram-style'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }

  // ---------- public API
  function setPackets(inst, stat) {
    inst.els.forEach((e) => (e.pks || []).forEach((p) => {
      if (stat) { p.anims.forEach((a) => a.remove()); if (p.pos) p.c.setAttribute('transform', 'translate(' + f2(p.pos[0]) + ' ' + f2(p.pos[1]) + ')'); p.c.style.display = p.pos ? '' : 'none'; }
      else { p.c.removeAttribute('transform'); p.c.style.display = ''; p.anims.forEach((a) => p.c.appendChild(a)); }
    }));
  }
  function mount(svg, spec) {
    if (!svg || svg.namespaceURI !== NS) throw new Error('MotionDiagram: mount needs an <svg> element');
    injectCss();
    const M = parse(spec), env = readEnv(svg);
    layout(M, svg, env);
    routeEdges(M, env);
    const inst = render(M, svg, env);
    inst.M = M; inst.pkStatic = false;
    registry.set(svg, inst);
    update(svg, { step: 0 });
    return { steps: inst.steps };
  }
  function update(svg, state) {
    const inst = registry.get(svg); if (!inst) return;
    const st = state || {}, step = Math.max(0, Math.floor(+st.step) || 0), cap = !!st.capture, replay = !!st.replay;
    svg.classList.toggle('md-cap', cap);
    const restart = [], hlRestart = [];
    inst.els.forEach((e) => {
      const g = e.g, vis = step >= e.step && !(e.out != null && step >= e.out);
      if (!vis) { if (e.vis !== false) { g.classList.add('md-hid'); g.classList.remove('md-play'); e.vis = false; } }
      else {
        if (e.vis !== true) { g.classList.remove('md-hid'); e.vis = true; if (!cap) restart.push(g); } else if (replay && !cap) restart.push(g);
        if (cap) g.classList.remove('md-play');
      }
      if (e.hl) {
        const ov = g.querySelector('.md-hl'), on = vis && step === e.hl;
        if (on && (!e.hlOn || (replay && !cap))) hlRestart.push(ov); else if (!on) ov.classList.remove('md-on');
        if (on && cap) ov.classList.add('md-on');
        e.hlOn = on;
      }
    });
    restart.forEach((g) => g.classList.remove('md-play')); hlRestart.forEach((o) => o.classList.remove('md-on'));
    if (restart.length || hlRestart.length) void svg.getBoundingClientRect();
    restart.forEach((g) => g.classList.add('md-play')); hlRestart.forEach((o) => o.classList.add('md-on'));
    const stat = cap || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (inst.pkStatic !== stat) { setPackets(inst, stat); inst.pkStatic = stat; }
  }
  function steps(spec) {
    let m = 0;
    if (spec && typeof spec === 'object') [].concat(Array.isArray(spec.nodes) ? spec.nodes : [], Array.isArray(spec.edges) ? spec.edges : []).forEach((o) => { if (o) m = Math.max(m, +o.step || 0, +o.out || 0, +o.highlight || 0); });
    return m;
  }
  window.MotionDiagram = { version: VERSION, mount, update, steps, kinds: KINDS.slice() };
})();
