/* motion-deck runtime. Contract: references/contract.md. Plain ES2020, no dependencies. */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');

  const VOCAB = {
    map: 'Map', mapHint: 'Pick a slide to jump to it. Esc closes.', counter: '{n} / {N}', backupCounter: 'Backup {L}',
    section: '', now: 'Now', notes: 'Notes', timer: 'Time', next: 'Next', presenter: 'Presenter', rotate: 'Rotate your device',
    hint: 'Arrows move · M map · P presenter · F full screen · ? keys',
    ahead: 'Ahead', behind: 'Behind', onTime: 'On pace',
    ambient: 'Motion', help: 'Keys', helpClose: 'Esc or ? closes.', jump: 'Go to slide',
    keyMove: 'Next, previous', keyMap: 'Map', keyPresenter: 'Presenter', keyFull: 'Full screen', keyBlackout: 'Blackout', keyAmbient: 'Pause or resume the moving background',
    keyJump: 'Jump to a slide: G, a number, Enter', keyHelp: 'This help',
  };
  // Elements that get the entrance cascade (contract 5.1).
  const ANIM_SEL = '.kicker,h1,h2,h3,h4,p,li,blockquote,cite,figure,pre.code,.card,.stat,.chip,.callout,.meta,.links>*,.attrib,table.data,[data-art],svg[data-diagram],img';
  const STAGE_W = 1600;
  const STAGE_H = 900;

  const S = {
    config: null, theme: null, vocab: {}, token: '', slides: [], sections: [], secById: {}, normalCount: 0,
    index: -1, step: 0, captureOn: false, mapOpen: false, trTimer: 0, stage: null, amb: null, ambRun: false, presenter: null,
    morphing: false, queue: [], ambientOn: true, blackoutOn: false, helpOpen: false, jump: null, jumpTimer: 0,
  };
  let resolveReady;
  let rejectReady;

  const D = (window.Deck = {
    version: 1,
    ready: new Promise((res, rej) => { resolveReady = res; rejectReady = rej; }),
    features: [],
  });
  Object.defineProperties(D, {
    index: { get: () => S.index, enumerable: true },
    step: { get: () => S.step, enumerable: true },
    count: { get: () => S.slides.length, enumerable: true },
    config: { get: () => S.config, enumerable: true },
    theme: { get: () => S.theme, enumerable: true },
    token: { get: () => S.token, enumerable: true },
  });

  const h = (tag, props = {}, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => e.append(c));
    return e;
  };
  const dispatch = (type, detail) => doc.dispatchEvent(new CustomEvent(type, { detail }));
  const safe = (label, fn) => { try { return fn(); } catch (err) { console.error(`motion-deck: ${label}: ${err && err.message ? err.message : err}`); } };
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hashStr = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };

  /* ---------- boot ---------- */

  function fail(err) {
    const msg = err && err.message ? err.message : String(err);
    console.error('motion-deck: boot failed: ' + msg);
    root.dataset.deckError = msg;
    rejectReady(err instanceof Error ? err : new Error(msg));
  }

  async function boot() {
    try {
      S.config = JSON.parse($('#deck-config').textContent);
      if (!S.theme) throw new Error('no theme registered (theme.js missing or failed)');
      S.vocab = Object.assign({}, VOCAB, S.theme.vocabulary || {}, S.config.vocabulary || {});
      S.stage = $('#stage');
      S.token = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
      root.lang = S.config.lang || 'en';
      root.classList.toggle('reduced', reducedMQ.matches);
      if (S.config.accent) { root.style.setProperty('--a1', S.config.accent); root.style.setProperty('--glow', S.config.accent); }
      if (/[?&]capture=1\b/.test(location.search)) { S.captureOn = true; root.classList.add('capture'); }
      S.ambientOn = !(String(S.config.ambient).toLowerCase() === 'off' || /[?&]ambient=off\b/.test(location.search));
      root.classList.toggle('still', !S.ambientOn);

      collectSlides();
      fillArt();
      tagAnimations();
      setColumns();
      highlightCode();
      buildChrome();
      setupAmbient();
      fit();
      bindInput();
      // Load every embedded face first: a face only slide content uses may not have started while the slides are hidden, and the measure pass needs its metrics.
      const faces = doc.fonts ? Promise.all(Array.from(doc.fonts, (f) => f.load().catch(() => {}))) : null;
      await Promise.all([faces, doc.fonts ? doc.fonts.ready : null, ...$$('img').map((i) => (i.decode ? i.decode().catch(() => {}) : null))]);
      measurePass();

      const start = readHash();
      go(start.index, { instant: true, step: start.step, initial: true });
      syncAmbient();
      D.features = computeFeatures();
      resolveReady(D);
    } catch (err) {
      fail(err);
    }
  }

  // data-minutes: planned minutes for one slide; anything but a positive number is ignored.
  function minutesOf(el) {
    const m = parseFloat(el.dataset.minutes);
    return m > 0 && Number.isFinite(m) ? m : null;
  }

  function collectSlides() {
    const els = $$('#stage > .slide');
    if (!els.length) throw new Error('the deck has no slides');
    let normal = 0;
    let backup = 0;
    S.slides = els.map((el, index) => {
      const isBackup = el.hasAttribute('data-backup');
      const num = isBackup ? String.fromCharCode(65 + backup++) : ++normal;
      const notesEl = $('aside.notes', el);
      const s = {
        el, index, num, backup: isBackup, id: el.id || `s${index + 1}`,
        title: el.dataset.title || `Slide ${index + 1}`, sec: el.dataset.sec || 'main', layout: el.dataset.layout || 'content',
        steps: 0, notes: notesEl ? notesEl.innerHTML.trim() : '', minutes: minutesOf(el),
        morph: $$('[data-morph]', el).map((e) => e.dataset.morph),
      };
      el.id = s.id;
      el.dataset.layout = s.layout;
      el.dataset.n = String(num);
      el.setAttribute('role', 'group');
      el.setAttribute('aria-roledescription', 'slide');
      el.setAttribute('aria-label', `${num}: ${s.title}`);
      return s;
    });
    S.normalCount = normal;

    // sections: config order first, then first appearance; accents 1..6 cycling for the ones without one
    const list = (S.config.sections || []).map((x) => ({ id: x.id, label: x.label || x.id, accent: x.accent || 0 }));
    S.slides.forEach((s) => {
      if (s.backup) return;
      if (!list.find((x) => x.id === s.sec)) list.push({ id: s.sec, label: s.sec.charAt(0).toUpperCase() + s.sec.slice(1), accent: 0 });
    });
    let next = 1;
    list.forEach((x) => { if (!x.accent) { x.accent = next; next = (next % 6) + 1; } });
    S.sections = list;
    S.secById = Object.fromEntries(list.map((x) => [x.id, x]));
    S.slides.forEach((s) => {
      const sec = S.secById[s.sec] || { accent: 1 };
      s.el.style.setProperty('--acc', `var(--a${sec.accent})`);
    });
  }

  function fillArt() {
    const art = S.theme.art || {};
    $$('[data-art]').forEach((el) => {
      const role = el.dataset.art;
      if (art[role] && !el.firstElementChild && !el.textContent.trim()) el.innerHTML = art[role];
      else if (!art[role]) console.warn(`motion-deck: theme "${S.theme.name}" has no art for role "${role}"`);
      el.classList.add('art');
      if (el.dataset.alt) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', el.dataset.alt); } else el.setAttribute('aria-hidden', 'true');
    });
  }

  function tagAnimations() {
    S.slides.forEach((s) => {
      let i = 0;
      $$(ANIM_SEL, s.el).forEach((el) => {
        if (el.closest('[data-anim="none"]') || el.closest('[data-step]') || el.closest('[data-morph]')) return;
        if (el.parentElement.closest('.a') || (el.closest('svg') && el.tagName.toLowerCase() !== 'svg')) return;
        el.classList.add('a');
        el.style.setProperty('--i', String(Math.min(i++, 18)));
        const kind = el.closest('[data-anim]')?.dataset.anim ?? 'rise';
        if (kind && kind !== 'rise') el.classList.add('a-' + kind);
        if (el.dataset.delay) el.style.setProperty('--d', `${parseInt(el.dataset.delay, 10) || 0}ms`);
      });
    });
  }

  function setColumns() {
    $$('.cards,.stats').forEach((el) => el.style.setProperty('--n', String(el.children.length)));
  }

  /* ---------- code blocks ---------- */

  const KW = {
    js: 'async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield true false null undefined',
    py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
    sh: 'if then else elif fi for while do done case esac function in echo export cd ls git npm node',
    sql: 'select from where group by order having insert into values update set delete create table join left right inner outer on as and or not null limit',
    yaml: 'true false null yes no',
    json: 'true false null',
  };
  const ALIAS = { javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', mjs: 'js', python: 'py', bash: 'sh', shell: 'sh', zsh: 'sh', yml: 'yaml', htm: 'html', xml: 'html', jsonc: 'json' };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function highlight(code, langRaw) {
    const lang = ALIAS[langRaw] || langRaw || '';
    const kw = new Set((KW[lang] || '').split(' '));
    const com = lang === 'py' || lang === 'sh' || lang === 'yaml' ? '#[^\\n]*' : lang === 'sql' ? '--[^\\n]*' : lang === 'html' ? '<!--[\\s\\S]*?-->' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
    const re = new RegExp(`(${com})|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)(?=\\s*\\()|([A-Za-z_$][\\w$]*)`, 'g');
    // One span per line of a token, so splitting the result on newlines never cuts a span in two.
    const tok = (cls, s) => s.split('\n').map((p) => (p ? `<span class="${cls}">${p}</span>` : p)).join('\n');
    let out = '';
    let last = 0;
    for (const m of code.matchAll(re)) {
      out += esc(code.slice(last, m.index));
      last = m.index + m[0].length;
      const t = esc(m[0]);
      if (m[1]) out += tok('tk-c', t);
      else if (m[2]) out += tok(lang === 'json' && /^\s*:/.test(code.slice(last)) ? 'tk-f' : 'tk-s', t);
      else if (m[3]) out += tok('tk-n', t);
      else if (m[4]) out += tok(kw.has(m[4]) ? 'tk-k' : 'tk-f', t);
      else out += kw.has(m[5]) ? tok('tk-k', t) : t;
    }
    return out + esc(code.slice(last));
  }

  function highlightCode() {
    $$('pre.code').forEach((pre) => {
      const code = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
      const lines = highlight(code, (pre.dataset.lang || '').toLowerCase()).split('\n');
      const hl = new Set();
      (pre.dataset.hl || '').split(',').filter(Boolean).forEach((part) => {
        const [a, b] = part.split('-').map(Number);
        for (let n = a; n <= (b || a); n++) hl.add(n);
      });
      pre.innerHTML = lines.map((l, i) => `<span class="ln${hl.has(i + 1) ? ' hl' : ''}">${l || ' '}</span>`).join('');
      pre.classList.toggle('has-hl', hl.size > 0);
    });
  }

  function fitCode(slide) {
    $$('pre.code', slide.el).forEach((pre) => {
      pre.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(pre).fontSize);
      while ((pre.scrollHeight > pre.clientHeight + 1 || pre.scrollWidth > pre.clientWidth + 1) && fs > 18) { fs -= 1; pre.style.fontSize = `${fs}px`; }
    });
  }

  // Big numbers shrink until the widest fits its column; all numbers of one row share the smallest size.
  function fitNumbers(slide) {
    $$('.stats', slide.el).forEach((row) => {
      const nums = $$('.num', row);
      let best = Infinity;
      nums.forEach((n) => {
        n.style.fontSize = '';
        let fs = parseFloat(getComputedStyle(n).fontSize);
        // Both widths are rounded to whole pixels, so a difference of 1 can already be a number that pokes out of its column by a pixel.
        while (n.scrollWidth > n.clientWidth && fs > 28) { fs -= 2; n.style.fontSize = `${fs}px`; }
        best = Math.min(best, fs);
      });
      nums.forEach((n) => { n.style.fontSize = `${best}px`; });
    });
  }

  /* ---------- diagrams, steps, measuring pass ---------- */

  const specOf = (svg) => {
    const ref = svg.dataset.spec;
    const node = ref ? $(ref) : $('script[type="application/json"]', svg);
    if (!node) throw new Error('diagram has no JSON spec');
    return JSON.parse(node.textContent);
  };

  function measurePass() {
    S.slides.forEach((s) => {
      s.el.classList.add('measuring');
      let max = 0;
      $$('[data-step],[data-step-out]', s.el).forEach((e) => { max = Math.max(max, parseInt(e.dataset.step, 10) || 0, parseInt(e.dataset.stepOut, 10) || 0); });
      $$('svg[data-diagram]', s.el).forEach((svg) => safe(`diagram on slide ${s.num}`, () => {
        if (!window.MotionDiagram) throw new Error('MotionDiagram is not loaded');
        const info = window.MotionDiagram.mount(svg, specOf(svg));
        max = Math.max(max, (info && info.steps) || 0);
      }));
      fitCode(s);
      fitNumbers(s);
      s.steps = max;
      s.el.classList.remove('measuring');
    });
  }

  function updateDiagrams(slide, o = {}) {
    if (!window.MotionDiagram) return;
    $$('svg[data-diagram]', slide.el).forEach((svg) => safe('diagram update', () => {
      window.MotionDiagram.update(svg, { step: o.step ?? S.step, replay: !!o.replay, capture: o.capture ?? S.captureOn });
    }));
  }

  function applySteps(el, n, animate) {
    const fresh = [];
    $$('[data-step]', el).forEach((e) => {
      const on = n >= (parseInt(e.dataset.step, 10) || 0);
      if (on && !e.classList.contains('on')) { e.classList.add('on'); if (animate) e.classList.add('anim'); fresh.push(e); }
      else if (!on) e.classList.remove('on', 'anim');
    });
    $$('[data-step-out]', el).forEach((e) => e.classList.toggle('off', n >= (parseInt(e.dataset.stepOut, 10) || 0)));
    return fresh;
  }

  function setStep(n, o = {}) {
    const s = S.slides[S.index];
    if (!s) return;
    n = clamp(n | 0, 0, s.steps);
    const animate = o.animate !== false && !S.captureOn && !reducedMQ.matches && n > S.step;
    const fresh = applySteps(s.el, n, animate);
    const changed = n !== S.step;
    S.step = n;
    updateDiagrams(s);
    fresh.forEach(startCountersIn);
    if (changed) {
      dispatch('deck:step', { index: S.index, step: n, steps: s.steps });
      syncPresenter();
    }
  }

  /* ---------- counters ---------- */

  const numberFormats = new Map(); // a formatter per decimals count, since counters format on every frame
  const counterFmt = (el, v) => {
    const raw = String(el.dataset.count);
    const dec = el.dataset.decimals !== undefined ? +el.dataset.decimals : (raw.split('.')[1] || '').length;
    if (!numberFormats.has(dec)) numberFormats.set(dec, new Intl.NumberFormat(S.config.lang || 'en', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return (el.dataset.prefix || '') + numberFormats.get(dec).format(v) + (el.dataset.suffix || '');
  };

  function prepCounters(slideEl, complete) {
    $$('[data-count]', slideEl).forEach((el) => {
      cancelAnimationFrame(el.__raf);
      if (el.dataset.final === undefined) el.dataset.final = el.textContent;
      el.textContent = complete || S.captureOn || reducedMQ.matches ? el.dataset.final : counterFmt(el, 0);
    });
  }

  function startCountersIn(root0) {
    const list = root0.matches && root0.matches('[data-count]') ? [root0] : [];
    list.push(...$$('[data-count]', root0));
    list.forEach((el) => {
      const target = parseFloat(el.dataset.count);
      if (Number.isNaN(target) || S.captureOn || reducedMQ.matches) { if (el.dataset.final !== undefined) el.textContent = el.dataset.final; return; }
      cancelAnimationFrame(el.__raf);
      const dur = +el.dataset.dur || 1400;
      const t0 = performance.now() + 240;
      const tick = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        el.textContent = counterFmt(el, target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) el.__raf = requestAnimationFrame(tick); else el.textContent = el.dataset.final;
      };
      el.__raf = requestAnimationFrame(tick);
    });
  }

  function startVisibleCounters(slideEl) {
    $$('[data-count]', slideEl).forEach((el) => {
      const gate = el.closest('[data-step]');
      if (!gate || gate.classList.contains('on')) startCountersIn(el);
    });
  }

  /* ---------- navigation ---------- */

  function transitionName(to) {
    const el = S.slides[to].el;
    return el.dataset.transition || S.config.transition || S.theme.defaultTransition || 'slide';
  }

  function trDuration() {
    const v = getComputedStyle(S.stage).getPropertyValue('--tr-dur').trim();
    return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : parseFloat(v) || 600;
  }

  function finishTransition() {
    clearTimeout(S.trTimer);
    $$('.slide.leaving').forEach((e) => e.classList.remove('leaving'));
    $$('.slide.entering').forEach((e) => e.classList.remove('entering'));
    delete S.stage.dataset.tr;
    delete S.stage.dataset.dir;
  }

  function swap(from, to, step, back, name, complete) {
    finishTransition();
    const prev = from >= 0 ? S.slides[from].el : null;
    const slide = S.slides[to];
    const next = slide.el;
    S.index = to;
    $$('[data-step]', next).forEach((e) => e.classList.remove('on', 'anim'));
    $$('[data-step-out]', next).forEach((e) => e.classList.remove('off'));
    applySteps(next, step, false);
    S.step = step;
    next.classList.remove('play', 'complete');
    next.classList.add('active');
    if (name !== 'none') {
      S.stage.dataset.tr = name;
      S.stage.dataset.dir = back ? 'back' : 'fwd';
      next.classList.add('entering');
      if (prev) prev.classList.add('leaving');
      S.trTimer = setTimeout(finishTransition, trDuration() + 60);
    }
    $$('.slide.active', S.stage).forEach((e) => { if (e !== next) e.classList.remove('active', 'play', 'complete'); });
    void next.offsetWidth;
    next.classList.add(complete ? 'complete' : 'play');
    prepCounters(next, complete);
    if (!complete) startVisibleCounters(next);
    updateDiagrams(slide, { replay: !complete });
    updateChrome();
    writeHash();
    if (S.amb && S.theme.ambient && S.theme.ambient.change) safe('ambient.change', () => S.theme.ambient.change(S.amb, { from, to, dir: back ? 'back' : 'fwd', transition: name }));
    if (!S.ambRun) paintAmbient();
    dispatch('deck:change', { index: to, from, step, dir: back ? 'back' : 'fwd', transition: name });
    syncPresenter();
  }

  // A morph updates the DOM in a later frame, so navigation that arrives meanwhile waits its turn instead of reading a stale index.
  const queueNav = (fn) => { if (S.queue.length < 8) S.queue.push(fn); };
  const drainNav = () => { while (S.queue.length && !S.morphing) S.queue.shift()(); };

  function go(i, o = {}) {
    if (!S.slides.length) return;
    if (S.morphing && !o.instant) { queueNav(() => go(i, o)); return; }
    i = clamp(i | 0, 0, S.slides.length - 1);
    const from = S.index;
    const back = from >= 0 && i < from;
    let step = o.step;
    if (step === undefined) step = back ? S.slides[i].steps : 0;
    step = clamp(step, 0, S.slides[i].steps);
    const complete = o.complete ?? (back && o.step === undefined);
    if (i === from) { setStep(step, { animate: false }); return; }
    const instant = !!o.instant || from < 0 || S.captureOn || reducedMQ.matches;
    let name = instant ? 'none' : transitionName(i);
    const keys = !instant && name !== 'none' ? morphKeys(from, i) : [];
    if (keys.length && morphSupported()) { name = 'none'; morphRun(keys, to => swap(from, to, step, back, name, complete), i); } else swap(from, i, step, back, name, complete);
  }

  const next = () => {
    if (S.morphing) { queueNav(next); return; }
    const s = S.slides[S.index];
    if (S.step < s.steps) setStep(S.step + 1);
    else if (S.index < S.slides.length - 1) go(S.index + 1);
  };
  const prev = () => {
    if (S.morphing) { queueNav(prev); return; }
    if (S.step > 0) setStep(S.step - 1);
    else if (S.index > 0) go(S.index - 1);
  };

  /* ---------- morph (contract 5.6) ---------- */

  const morphSupported = () => typeof doc.startViewTransition === 'function';
  const morphKeys = (from, to) => (from < 0 ? [] : S.slides[from].morph.filter((k) => S.slides[to].morph.includes(k)));

  function morphRun(keys, run, to) {
    const named = [];
    const name = (slideEl) => keys.forEach((k) => {
      const e = $(`[data-morph="${k}"]`, slideEl);
      if (e) { e.style.viewTransitionName = `md-${k}`; named.push(e); }
    });
    const style = h('style', { id: 'md-morph-style', text: keys.map((k) => `::view-transition-group(md-${k}){animation-duration:calc(var(--tr-dur) * 1.2);animation-timing-function:var(--ease)}`).join('') });
    doc.head.append(style);
    name(S.slides[S.index].el);
    S.morphing = true;
    const t = doc.startViewTransition(() => {
      named.forEach((e) => { e.style.viewTransitionName = ''; });
      run(to);
      name(S.slides[to].el);
    });
    const done = () => { named.forEach((e) => { e.style.viewTransitionName = ''; }); style.remove(); S.morphing = false; drainNav(); };
    t.ready.catch(() => {});
    t.finished.then(done, done);
  }

  /* ---------- hash ---------- */

  function readHash() {
    const m = /^#([A-Za-z]|\d+)(?:\.(\d+))?$/.exec(location.hash);
    let index = 0;
    if (m) {
      const key = /\d/.test(m[1]) ? +m[1] : m[1].toUpperCase();
      const found = S.slides.findIndex((s) => s.num === key);
      if (found >= 0) index = found;
    }
    return { index, step: m && m[2] !== undefined ? +m[2] : undefined };
  }

  function writeHash() {
    try { history.replaceState(null, '', `#${S.slides[S.index].num}`); } catch (_) { /* sandboxed frame */ }
  }

  /* ---------- chrome: HUD, track, map, hint ---------- */

  function sectionGroups() {
    const groups = S.sections.map((sec) => ({ sec, slides: S.slides.filter((s) => s.sec === sec.id && !s.backup) })).filter((g) => g.slides.length);
    const backups = S.slides.filter((s) => s.backup);
    if (backups.length) groups.push({ sec: { id: '_backup', label: 'Backup', accent: 0 }, slides: backups });
    return groups;
  }

  function buildChrome() {
    const chrome = h('div', { id: 'chrome' },
      h('div', { id: 'hud' }, h('span', { class: 'hud-sec' }), h('span', { class: 'hud-title' }), h('span', { class: 'hud-count' }),
        h('button', { id: 'hud-amb', class: 'hud-btn', type: 'button', 'aria-pressed': String(S.ambientOn), title: S.vocab.keyAmbient, onclick: (e) => { ambient(!S.ambientOn); if (e.detail) e.currentTarget.blur(); } }, S.vocab.ambient)),
      h('nav', { id: 'track', 'aria-label': 'Progress' }),
      h('div', { id: 'map', role: 'dialog', 'aria-modal': 'true', 'aria-label': S.vocab.map, hidden: true }),
      h('div', { id: 'hint', hidden: true, text: S.vocab.hint }),
      h('div', { id: 'rotate', text: S.vocab.rotate }),
      h('div', { id: 'help', role: 'dialog', 'aria-modal': 'true', 'aria-label': S.vocab.help, hidden: true, onclick: () => help(false) }),
      h('div', { id: 'jump', role: 'status', hidden: true }),
      h('div', { id: 'blackout', hidden: true, onclick: () => blackout(false) }),
      h('div', { id: 'sr', class: 'sr-only', 'aria-live': 'polite' }));
    doc.body.append(chrome);
    const nav = $('#track');
    sectionGroups().forEach((g) => {
      const seg = h('div', { class: 'seg', style: `flex:${g.slides.length};--acc:${g.sec.accent ? `var(--a${g.sec.accent})` : 'var(--muted)'}` });
      g.slides.forEach((s) => seg.append(h('button', { class: 'dot', type: 'button', 'data-i': s.index, 'aria-label': `${s.num}: ${s.title}`, title: s.title, onclick: (e) => { go(s.index); if (e.detail) e.currentTarget.blur(); } })));
      nav.append(seg);
    });
    if (!S.captureOn && !/[?&]nohint\b/.test(location.search)) {
      const hint = $('#hint');
      hint.hidden = false;
      setTimeout(() => { hint.hidden = true; }, 4200);
    }
  }

  function updateChrome() {
    const s = S.slides[S.index];
    const sec = S.secById[s.sec];
    $('#chrome').style.setProperty('--acc', s.el.style.getPropertyValue('--acc') || 'var(--a1)');
    const label = s.backup ? 'Backup' : sec ? sec.label : '';
    $('.hud-sec').textContent = [S.vocab.section, label].filter(Boolean).join(' ');
    $('.hud-title').textContent = s.title.toLowerCase() === label.toLowerCase() ? '' : s.title;
    $('.hud-count').textContent = s.backup ? S.vocab.backupCounter.replace('{L}', s.num) : S.vocab.counter.replace('{n}', s.num).replace('{N}', S.normalCount);
    $$('#track .dot').forEach((d) => {
      const i = +d.dataset.i;
      d.classList.toggle('cur', i === S.index);
      d.classList.toggle('seen', i < S.index);
    });
    $('#sr').textContent = `${s.num}: ${s.title}`;
  }

  function renderMap() {
    const m = $('#map');
    m.replaceChildren(h('div', { class: 'map-head' }, h('h2', { text: S.vocab.map }), h('p', { class: 'map-hint', text: S.vocab.mapHint })));
    sectionGroups().forEach((g) => m.append(h('section', { class: 'map-sec', style: `--acc:${g.sec.accent ? `var(--a${g.sec.accent})` : 'var(--muted)'}` },
      h('h3', { text: g.sec.label }),
      h('div', { class: 'map-grid' }, g.slides.map((s) => h('button', {
        class: `map-item${s.index === S.index ? ' cur' : ''}`, type: 'button', onclick: () => { openMap(false); go(s.index); },
      }, h('span', { class: 'map-n', text: String(s.num) }), h('span', { class: 'map-t', text: s.title })))))));
  }

  function openMap(on) {
    if (on === undefined) return S.mapOpen;
    S.mapOpen = !!on;
    root.classList.toggle('map-open', S.mapOpen);
    const m = $('#map');
    m.hidden = !S.mapOpen;
    if (S.mapOpen) { renderMap(); const cur = $('.map-item.cur', m); if (cur) cur.focus(); }
    else if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    return S.mapOpen;
  }

  /* ---------- stage fit, input ---------- */

  function fit() {
    S.stage.style.setProperty('--s', String(Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H)));
  }

  function bindInput() {
    addEventListener('resize', () => { fit(); sizeCanvas(); });
    addEventListener('hashchange', () => { const t = readHash(); if (t.index !== S.index) go(t.index, { instant: true, step: t.step }); });
    addEventListener('beforeprint', finalizeAll);
    addEventListener('afterprint', restoreAfterPrint);
    doc.addEventListener('visibilitychange', syncAmbient);
    reducedMQ.addEventListener('change', () => { root.classList.toggle('reduced', reducedMQ.matches); syncAmbient(); });
    doc.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (S.helpOpen) {
        if (k === 'Escape' || k === '?' || k === 'h' || k === 'H') { e.preventDefault(); help(false); }
        return;
      }
      if (S.blackoutOn) {
        if (k === 'Escape' || k === 'b' || k === 'B' || k === '.' || k === 'Enter' || k === ' ') { e.preventDefault(); blackout(false); }
        return;
      }
      if (S.jump !== null) {
        if (/^\d$/.test(k)) { e.preventDefault(); jumpDigit(k); }
        else if (k === 'Enter') { e.preventDefault(); jumpCommit(); }
        else { if (k === 'Escape' || k === 'g' || k === 'G') e.preventDefault(); jumpCancel(); }
        return;
      }
      if (S.mapOpen) {
        if (k === 'Escape' || k === 'm' || k === 'M') { e.preventDefault(); openMap(false); }
        return;
      }
      if ((k === 'Enter' || k === ' ') && e.target.closest && e.target.closest('button,a')) return; // a focused control keeps its own activation
      if (['ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(k) || (k === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k) || (k === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
      else if (k === 'Home') go(0);
      else if (k === 'End') go(S.slides.length - 1);
      else if (k === 'm' || k === 'M') openMap(true);
      else if (k === 'f' || k === 'F') { if (doc.fullscreenElement) doc.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(() => {}); }
      else if (k === 'p' || k === 'P') openPresenter();
      else if (k === 'b' || k === 'B') blackout(true);
      else if (k === '.') ambient(!S.ambientOn);
      else if (k === '?' || k === 'h' || k === 'H') help(true);
      else if (k === 'g' || k === 'G') jumpStart();
    });
    let t0 = null;
    doc.addEventListener('touchstart', (e) => { t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
    doc.addEventListener('touchend', (e) => {
      if (!t0 || S.mapOpen || e.target.closest('button,a,#map')) return;
      const dx = e.changedTouches[0].clientX - t0.x;
      const dy = e.changedTouches[0].clientY - t0.y;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 90) (dx < 0 ? next : prev)();
      else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        const x = e.changedTouches[0].clientX / innerWidth;
        if (x > 0.7) next(); else if (x < 0.3) prev();
      }
      t0 = null;
    });
  }

  /* ---------- ambient layer ---------- */

  function sizeCanvas() {
    const a = S.amb;
    if (!a) return;
    a.dpr = Math.min(2, window.devicePixelRatio || 1);
    a.w = innerWidth;
    a.h = innerHeight;
    a.canvas.width = Math.round(a.w * a.dpr);
    a.canvas.height = Math.round(a.h * a.dpr);
    a.ctx.setTransform(a.dpr, 0, 0, a.dpr, 0, 0);
    const A = S.theme.ambient;
    if (A && A.resize) safe('ambient.resize', () => A.resize(a));
    if (!S.ambRun) paintAmbient();
  }

  function setupAmbient() {
    const canvas = $('#ambient');
    if (!canvas || !S.theme.ambient) return;
    const rand = mulberry32(hashStr(S.config.title || 'deck'));
    S.amb = {
      canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1, rand,
      accent: () => getComputedStyle(S.index >= 0 ? S.slides[S.index].el : root).getPropertyValue(S.index >= 0 ? '--acc' : '--a1').trim(),
      css: (name) => getComputedStyle(root).getPropertyValue(name).trim(),
    };
    sizeCanvas();
    if (S.theme.ambient.init) safe('ambient.init', () => S.theme.ambient.init(S.amb));
  }

  function paintAmbient() {
    const A = S.theme.ambient;
    if (!S.amb || !A) return;
    safe('ambient.paint', () => (A.paint ? A.paint(S.amb) : A.frame(S.amb, 0, 0)));
  }

  let ambLast = 0;
  let ambRaf = 0;
  function ambLoop(t) {
    if (!S.ambRun) return;
    ambRaf = requestAnimationFrame(ambLoop);
    const dt = clamp(t - ambLast, 0, 64);
    ambLast = t;
    safe('ambient.frame', () => S.theme.ambient.frame(S.amb, t, dt));
  }

  function syncAmbient() {
    if (!S.amb) return;
    const should = S.ambientOn && !doc.hidden && !reducedMQ.matches && !S.captureOn && !!S.theme.ambient.frame;
    if (should && !S.ambRun) { S.ambRun = true; ambLast = performance.now(); ambRaf = requestAnimationFrame(ambLoop); }
    else if (!should) { S.ambRun = false; cancelAnimationFrame(ambRaf); paintAmbient(); }
  }

  // Pause, stop and hide for the moving background and the looping art (WCAG 2.2.2). Off paints one static frame and pauses the art loops through html.still.
  function ambient(on) {
    if (on === undefined) return S.ambientOn;
    S.ambientOn = !!on;
    root.classList.toggle('still', !S.ambientOn);
    const b = $('#hud-amb');
    if (b) b.setAttribute('aria-pressed', String(S.ambientOn));
    syncAmbient();
    return S.ambientOn;
  }

  /* ---------- live keys: blackout, help, jump ---------- */

  function blackout(on) {
    if (on === undefined) return S.blackoutOn;
    S.blackoutOn = !!on;
    root.classList.toggle('blackout', S.blackoutOn);
    $('#blackout').hidden = !S.blackoutOn;
    return S.blackoutOn;
  }

  function help(on) {
    if (on === undefined) return S.helpOpen;
    S.helpOpen = !!on;
    root.classList.toggle('help-open', S.helpOpen);
    const el = $('#help');
    el.hidden = !S.helpOpen;
    if (S.helpOpen) {
      const v = S.vocab;
      const rows = [['← → ↑ ↓ Space', v.keyMove], ['M', v.keyMap], ['P', v.keyPresenter], ['F', v.keyFull], ['B', v.keyBlackout], ['.', v.keyAmbient], ['G', v.keyJump], ['?', v.keyHelp]];
      el.replaceChildren(h('div', { class: 'help-card' }, h('h2', { text: v.help }),
        h('dl', {}, rows.flatMap(([key, label]) => [h('dt', {}, h('kbd', { text: key })), h('dd', { text: label })])),
        h('p', { class: 'help-hint', text: v.helpClose })));
    }
    return S.helpOpen;
  }

  function jumpShow() {
    const el = $('#jump');
    el.hidden = S.jump === null;
    if (S.jump !== null) el.textContent = `${S.vocab.jump}: ${S.jump || '…'}`;
  }
  function jumpStart() { S.jump = ''; jumpShow(); clearTimeout(S.jumpTimer); S.jumpTimer = setTimeout(jumpCancel, 4000); }
  function jumpDigit(d) { S.jump = (S.jump + d).slice(0, 3); jumpShow(); clearTimeout(S.jumpTimer); S.jumpTimer = setTimeout(jumpCommit, 1500); }
  function jumpCancel() { clearTimeout(S.jumpTimer); S.jump = null; jumpShow(); }
  function jumpCommit() {
    const n = parseInt(S.jump, 10);
    jumpCancel();
    if (n >= 1) go(clamp(n, 1, Math.max(1, S.normalCount)) - 1);
  }

  /* ---------- capture, print ---------- */

  function finalizeAll() {
    S.slides.forEach((s) => {
      applySteps(s.el, s.steps, false);
      $$('[data-count]', s.el).forEach((el) => { cancelAnimationFrame(el.__raf); if (el.dataset.final !== undefined) el.textContent = el.dataset.final; });
      updateDiagrams(s, { step: s.steps, capture: true });
    });
    S.printing = true;
  }

  function restoreAfterPrint() {
    if (!S.printing) return;
    S.printing = false;
    const s = S.slides[S.index];
    if (s) { applySteps(s.el, S.step, false); updateDiagrams(s); }
  }

  function capture(on) {
    if (on === undefined) return S.captureOn;
    S.captureOn = !!on;
    root.classList.toggle('capture', S.captureOn);
    if (S.captureOn) {
      finishTransition();
      finalizeAll();
      restoreAfterPrint();
    } else if (S.slides[S.index]) {
      updateDiagrams(S.slides[S.index], { replay: true });
    }
    syncAmbient();
    return S.captureOn;
  }

  /* ---------- presenter (contract 11) ---------- */

  const PRESENTER_HTML = (token, v) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(v.presenter)} — loading</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}html,body{height:100%;margin:0}
body{background:#0b0d12;color:#e7eaf2;font:16px/1.4 system-ui,sans-serif;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);gap:14px;padding:14px}
header{grid-column:1/3;display:flex;align-items:center;gap:14px}
#p-title{font-weight:650;font-size:18px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#p-count{font:14px ui-monospace,Consolas,monospace;color:#9aa3b5}
#p-timer{font:600 30px/1 ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}
#p-pace{font:600 14px/1 ui-monospace,Consolas,monospace;min-width:12ch;text-align:right;color:#9aa3b5}#p-pace[data-state=behind]{color:#ff7a7a}#p-pace[data-state=ahead]{color:#7ee0a0}
#p-bar{grid-column:1/3;position:relative;height:8px;border-radius:99px;background:#1a1f2b}#p-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:99px;background:#3a7bd5}#p-mark{position:absolute;top:-4px;bottom:-4px;left:0;width:3px;border-radius:2px;background:#e7eaf2}#p-mark[hidden]{display:none}
button{font:inherit;color:inherit;background:#1a1f2b;border:1px solid #2b3345;border-radius:8px;padding:8px 14px;cursor:pointer}button:hover{background:#232a3a}
main,aside{display:flex;flex-direction:column;gap:10px;min-height:0}
h2{margin:0;font:600 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#9aa3b5}
.p-frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border:1px solid #2b3345;border-radius:10px;background:#000}
.p-frame>div{position:absolute;inset:0}
#p-notes{flex:1;min-height:0;overflow:auto;background:#10141d;border:1px solid #2b3345;border-radius:10px;padding:14px 16px;font-size:19px;line-height:1.5}
#p-notes:empty::before{content:"—";color:#5b657a}
</style></head><body data-md="${token}">
<header><div id="p-title"></div><div id="p-count"></div><div id="p-timer" data-seconds="0">00:00</div><div id="p-pace" data-state="" data-seconds="0"></div><button id="p-prev" type="button">←</button><button id="p-next-btn" type="button">→</button><button id="p-reset" type="button">${esc(v.timer)} ↺</button></header>
<div id="p-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-pct="0"><i id="p-fill"></i><b id="p-mark" hidden></b></div>
<main><h2>${esc(v.now)}</h2><div class="p-frame"><div id="p-current"></div></div><h2>${esc(v.notes)}</h2><div id="p-notes"></div></main>
<aside><h2>${esc(v.next)}</h2><div class="p-frame"><div id="p-next"></div></div></aside>
</body></html>`;

  // Runs inside the popup (it is stringified): draws both previews in iframes, runs the timer, sends commands to the opener.
  function presenterScript(token, timerMin) {
    const $ = (s) => document.querySelector(s);
    const post = (m) => { if (window.opener) window.opener.postMessage(Object.assign({ md: token }, m), '*'); };
    const pad = (n) => String(n).padStart(2, '0');
    let secs = 0;
    let cssText = '';
    let plan = null;
    let at = 0;
    let words = {};
    const frames = {};
    const showTime = () => {
      const t = $('#p-timer');
      t.dataset.seconds = String(secs);
      t.textContent = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
      t.style.color = secs >= (plan ? plan.total : timerMin * 60) ? '#ff7a7a' : '';
      showPace();
    };
    // Progress against the planned total and ahead or behind against the planned time of the current slide (contract 11).
    function showPace() {
      const total = plan ? plan.total : timerMin * 60;
      const pct = Math.min(100, (secs / total) * 100);
      const bar = $('#p-bar');
      $('#p-fill').style.width = pct + '%';
      bar.dataset.pct = String(Math.round(pct));
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      const mark = $('#p-mark');
      const pace = $('#p-pace');
      const a = plan ? plan.starts[at] : null;
      const b = plan ? plan.ends[at] : null;
      if (a === null || a === undefined || b === null || b === undefined) {
        mark.hidden = true;
        pace.dataset.state = '';
        pace.dataset.seconds = '0';
        pace.textContent = '';
        return;
      }
      mark.hidden = false;
      mark.style.left = (a / total) * 100 + '%';
      const grace = Math.min(30, Math.max(5, total * 0.02));
      let state = 'ontime';
      let delta = 0;
      if (secs > b + grace) { state = 'behind'; delta = secs - b; } else if (secs < a - grace) { state = 'ahead'; delta = a - secs; }
      pace.dataset.state = state;
      pace.dataset.seconds = String(delta);
      pace.textContent = state === 'ontime' ? words.onTime : words[state] + ' ' + pad(Math.floor(delta / 60)) + ':' + pad(delta % 60);
    }
    const timer = setInterval(() => { secs += 1; showTime(); }, 1000);
    const scale = () => document.querySelectorAll('.p-frame').forEach((box) => {
      const f = box.querySelector('iframe');
      if (f) f.style.transform = 'scale(' + box.clientWidth / 1600 + ')';
    });
    const paint = (fr) => { if (fr.ready && fr.html !== null) fr.f.contentDocument.getElementById('stage').innerHTML = fr.html; };
    const make = (sel) => {
      const f = document.createElement('iframe');
      f.title = sel.slice(1);
      f.style.cssText = 'position:absolute;left:0;top:0;width:1600px;height:900px;border:0;transform-origin:0 0;pointer-events:none';
      const fr = { f, ready: false, html: null };
      f.addEventListener('load', () => { fr.ready = true; paint(fr); scale(); });
      f.srcdoc = '<!doctype html><html class="capture"><head><meta charset="utf-8"><style>' + cssText + '</style><style>html,body{overflow:hidden!important}</style></head><body class="deck"><div id="viewport"><div id="stage"></div></div></body></html>';
      $(sel).appendChild(f);
      return fr;
    };
    window.addEventListener('message', (e) => {
      const m = e.data;
      if (!m || m.md !== token || e.source !== window.opener || m.type !== 'state') return;
      if (m.css && !frames.cur) { cssText = m.css; frames.cur = make('#p-current'); frames.next = make('#p-next'); }
      if (!frames.cur) { post({ type: 'request' }); return; }
      plan = m.plan || null;
      at = m.index;
      words = { ahead: 'Ahead', behind: 'Behind', onTime: 'On pace', ...(m.vocabulary || {}) };
      showPace();
      document.title = 'Presenter — ' + m.title;
      $('#p-title').textContent = m.title;
      $('#p-count').textContent = m.label + (m.steps ? ' · ' + m.step + '/' + m.steps : '');
      $('#p-current').dataset.index = String(m.index);
      $('#p-current').dataset.step = String(m.step);
      $('#p-next').dataset.index = String(m.nextIndex);
      $('#p-notes').innerHTML = m.notes || '';
      frames.cur.html = m.currentHtml;
      frames.next.html = m.nextHtml;
      paint(frames.cur);
      paint(frames.next);
      scale();
    });
    window.addEventListener('resize', scale);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); post({ type: 'cmd', cmd: 'next' }); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); post({ type: 'cmd', cmd: 'prev' }); }
    });
    $('#p-prev').onclick = () => post({ type: 'cmd', cmd: 'prev' });
    $('#p-next-btn').onclick = () => post({ type: 'cmd', cmd: 'next' });
    $('#p-reset').onclick = () => { secs = 0; showTime(); };
    window.addEventListener('pagehide', () => clearInterval(timer));
    post({ type: 'ready' });
  }

  function openPresenter() {
    if (S.presenter && !S.presenter.closed) { S.presenter.focus(); syncPresenter(true); return S.presenter; }
    const win = window.open('', `md-presenter-${S.token}`, 'popup,width=1280,height=760');
    if (!win) return null;
    S.presenter = win;
    win.document.open();
    win.document.write(PRESENTER_HTML(S.token, S.vocab));
    win.document.close();
    const script = win.document.createElement('script');
    script.textContent = `(${presenterScript.toString()})(${JSON.stringify(S.token)}, ${planMinutes()})`;
    win.document.body.append(script);
    return win;
  }

  // Planned time per slide in seconds (contract 11): data-minutes where set, the rest of the duration shared equally among the other normal slides; backup slides have none.
  function planMinutes() { return +S.config.duration || +S.config.timer || 20; }
  function plan() {
    const dur = planMinutes() * 60;
    const normal = S.slides.filter((s) => !s.backup);
    const fixed = normal.reduce((n, s) => n + (s.minutes ? s.minutes * 60 : 0), 0);
    const free = normal.filter((s) => !s.minutes).length;
    const share = free ? Math.max(0, dur - fixed) / free : 0;
    let t = 0;
    const starts = [];
    const ends = [];
    S.slides.forEach((s) => {
      if (s.backup) { starts.push(null); ends.push(null); return; }
      starts.push(Math.round(t));
      t += s.minutes ? s.minutes * 60 : share;
      ends.push(Math.round(t));
    });
    return { total: Math.max(Math.round(t), dur), starts, ends };
  }

  function presenterState() {
    const s = S.slides[S.index];
    const stepNext = S.step < s.steps;
    const nextIndex = stepNext ? S.index : Math.min(S.index + 1, S.slides.length - 1);
    const nextSlide = S.slides[nextIndex];
    const htmlOf = (slide, step) => {
      const clone = slide.el.cloneNode(true);
      clone.classList.remove('leaving', 'entering', 'play', 'measuring');
      clone.classList.add('active', 'complete');
      $$('[data-step]', clone).forEach((e) => { e.classList.remove('anim'); e.classList.toggle('on', step >= (parseInt(e.dataset.step, 10) || 0)); });
      $$('[data-step-out]', clone).forEach((e) => e.classList.toggle('off', step >= (parseInt(e.dataset.stepOut, 10) || 0)));
      // The diagram's builds live in classes, not in data-step: redraw them from the step marks the diagram writes on each element.
      $$('svg[data-diagram] [data-ds]', clone).forEach((g) => {
        const vis = step >= +g.dataset.ds && !(g.dataset.do !== undefined && step >= +g.dataset.do);
        g.classList.toggle('md-hid', !vis);
        const ov = g.dataset.dh ? $('.md-hl', g) : null;
        if (ov) ov.classList.toggle('md-on', vis && step === +g.dataset.dh);
      });
      return clone.outerHTML;
    };
    if (nextSlide !== s) updateDiagrams(nextSlide, { step: nextSlide.steps, capture: true });
    const hasNext = stepNext || S.index < S.slides.length - 1;
    return {
      type: 'state', index: S.index, step: S.step, steps: s.steps, count: S.slides.length, label: $('.hud-count').textContent, title: s.title, notes: s.notes,
      currentHtml: htmlOf(s, S.step), nextHtml: hasNext ? htmlOf(nextSlide, stepNext ? S.step + 1 : nextSlide.steps) : '',
      nextIndex, nextTitle: nextSlide.title, theme: S.theme.name, vocabulary: S.vocab, timer: planMinutes(), duration: planMinutes(), plan: plan(),
    };
  }

  function syncPresenter(full) {
    const win = S.presenter;
    if (!win || win.closed) { S.presenter = null; return; }
    const msg = Object.assign({ md: S.token }, presenterState());
    if (full) msg.css = $$('style').map((st) => st.textContent).join('\n');
    win.postMessage(msg, '*');
  }

  addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.md !== S.token || !S.presenter || e.source !== S.presenter) return;
    if (m.type === 'ready' || m.type === 'request') syncPresenter(true);
    else if (m.type === 'cmd') {
      if (m.cmd === 'next') next();
      else if (m.cmd === 'prev') prev();
      else if (m.cmd === 'go') go(+m.index, { step: m.step });
      else if (m.cmd === 'setStep') setStep(+m.step);
    }
  });

  /* ---------- public surface ---------- */

  function computeFeatures() {
    const f = ['map', 'hash', 'back', 'step-out', 'reduced-motion', 'capture', 'counters', 'code', 'art', 'pdf', 'presenter', 'ambient', 'blackout', 'help', 'jump'];
    if (window.MotionDiagram) f.push('diagram');
    if (morphSupported()) f.push('morph');
    return f;
  }

  D.steps = (i) => (S.slides[i === undefined ? S.index : i] || { steps: 0 }).steps;
  D.go = go;
  D.next = next;
  D.prev = prev;
  D.setStep = setStep;
  D.capture = capture;
  D.openMap = openMap;
  D.ambient = ambient;
  D.blackout = blackout;
  D.help = help;
  D.openPresenter = openPresenter;
  D.registerTheme = (t) => { S.theme = t; };
  D.info = () => ({
    title: S.config.title, theme: S.theme.name, lang: S.config.lang || 'en', duration: planMinutes(),
    sections: S.sections.map(({ id, label, accent }) => ({ id, label, accent })),
    slides: S.slides.map((s) => ({ index: s.index, id: s.id, title: s.title, sec: s.sec, layout: s.layout, steps: s.steps, backup: s.backup, notes: s.notes, morph: s.morph.slice(), minutes: s.minutes })),
  });

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
