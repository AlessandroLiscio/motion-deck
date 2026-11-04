/* Fantasy theme: fireflies, rising embers, low fog and a flickering candle vignette on the ambient canvas; engraved ink-and-gold line art. */
(() => {
  const rgb = (c, d) => {
    c = (c || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [...m[1]].map((x) => parseInt(x + x, 16));
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) return m[1].split(',').slice(0, 3).map((x) => Math.round(Number(x)));
    return d;
  };
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // pre-rendered sprites, built once (and the accent one again on each slide change)
  const S = { gold: cv(64, 64), acc: cv(64, 64), ember: cv(32, 32), star: cv(64, 64), fog: cv(256, 128), vig: cv(2, 2), glow: cv(2, 2) };
  let gold = [216, 169, 62], ember = [240, 136, 58], bg2 = [43, 15, 28], bgc = [18, 11, 13], text = [240, 228, 200];
  let flies = [], embers = [], fogs = [], sparks = [];
  let flickA = 1;
  let dirx = 1;

  const glowSprite = (c, col, core) => {
    const g = c.getContext('2d');
    const s = c.width / 2;
    g.clearRect(0, 0, c.width, c.height);
    const gr = g.createRadialGradient(s, s, 0, s, s, s);
    gr.addColorStop(0, `rgba(${core},1)`);
    gr.addColorStop(0.14, `rgba(${col},.9)`);
    gr.addColorStop(0.42, `rgba(${col},.22)`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
  };

  const buildSprites = (api) => {
    gold = rgb(api.css('--a1'), gold);
    ember = rgb(api.css('--a6'), ember);
    bg2 = rgb(api.css('--bg-2'), bg2);
    bgc = rgb(api.css('--bg'), bgc);
    text = rgb(api.css('--text'), text);
    glowSprite(S.gold, mix(gold, [255, 255, 255], 0.1).join(','), mix(gold, [255, 255, 255], 0.8).join(','));
    glowSprite(S.acc, gold.join(','), mix(gold, [255, 255, 255], 0.8).join(','));
    glowSprite(S.ember, ember.join(','), mix(ember, [255, 255, 255], 0.7).join(','));
    // four-point sparkle
    let g = S.star.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, `rgba(${mix(gold, [255, 255, 255], 0.6).join(',')},.55)`);
    gr.addColorStop(1, `rgba(${gold.join(',')},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    g.beginPath();
    g.moveTo(32, 2); g.quadraticCurveTo(34, 30, 62, 32); g.quadraticCurveTo(34, 34, 32, 62); g.quadraticCurveTo(30, 34, 2, 32); g.quadraticCurveTo(30, 30, 32, 2);
    g.fillStyle = `rgb(${mix(gold, [255, 255, 255], 0.5).join(',')})`;
    g.fill();
    // fog: a soft warm ellipse
    g = S.fog.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    const fc = mix(bg2, text, 0.3).join(',');
    const fg = g.createRadialGradient(128, 64, 0, 128, 64, 128);
    fg.addColorStop(0, `rgba(${fc},.7)`);
    fg.addColorStop(0.55, `rgba(${fc},.3)`);
    fg.addColorStop(1, `rgba(${fc},0)`);
    g.setTransform(1, 0, 0, 0.5, 0, 32);
    g.fillStyle = fg;
    g.fillRect(0, -64, 256, 256);
    g.setTransform(1, 0, 0, 1, 0, 0);
  };

  const buildLayers = (api) => {
    const w2 = Math.max(2, Math.ceil(api.w / 2));
    const h2 = Math.max(2, Math.ceil(api.h / 2));
    S.vig.width = w2; S.vig.height = h2; S.glow.width = w2; S.glow.height = h2;
    let g = S.vig.getContext('2d');
    const dark = mix(bgc, [0, 0, 0], 0.55).join(',');
    let gr = g.createRadialGradient(w2 / 2, h2 * 0.46, Math.min(w2, h2) * 0.3, w2 / 2, h2 * 0.46, Math.hypot(w2, h2) * 0.6);
    gr.addColorStop(0, `rgba(${dark},0)`);
    gr.addColorStop(0.62, `rgba(${dark},.34)`);
    gr.addColorStop(1, `rgba(${dark},.9)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w2, h2);
    g = S.glow.getContext('2d');
    const warm = mix(ember, gold, 0.4).join(',');
    gr = g.createRadialGradient(w2 / 2, h2 * 1.05, 0, w2 / 2, h2 * 1.05, h2 * 1.1);
    gr.addColorStop(0, `rgba(${warm},.2)`);
    gr.addColorStop(1, `rgba(${warm},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w2, h2);
  };

  const populate = (api) => {
    const area = api.w * api.h;
    const nf = Math.max(12, Math.min(40, Math.round(area / 56000)));
    const ne = Math.max(18, Math.min(90, Math.round(area / 22000)));
    flies = Array.from({ length: nf }, () => ({ x: api.rand() * api.w, y: api.h * (0.12 + api.rand() * 0.84), ang: api.rand() * 6.283, sp: 0.01 + api.rand() * 0.018, ph: api.rand() * 6.283, rate: 0.0005 + api.rand() * 0.0012, sz: 12 + api.rand() * 14, acc: api.rand() < 0.4 }));
    embers = Array.from({ length: ne }, () => ({ x: api.rand() * api.w, y: api.rand() * api.h, vy: 0.02 + api.rand() * 0.05, sw: 10 + api.rand() * 26, ph: api.rand() * 6.283, rate: 0.0006 + api.rand() * 0.001, sz: 5 + api.rand() * 9 }));
    fogs = Array.from({ length: 6 }, (_, i) => ({ x: api.rand() * api.w, y: api.h * (0.46 + 0.13 * i + api.rand() * 0.05), w: api.w * (0.7 + api.rand() * 0.5), h: api.h * (0.34 + api.rand() * 0.2), v: (0.004 + api.rand() * 0.007) * (i % 2 ? 1 : -1), a: 0.55 + api.rand() * 0.4 }));
    if (!sparks.length) sparks = Array.from({ length: 64 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, sz: 0, ph: 0 }));
    else sparks.forEach((s) => { s.life = 0; });
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    // candle flicker, plus or minus 3 percent
    const fl = still ? 0 : Math.sin(t * 0.0023) * 0.5 + Math.sin(t * 0.0057 + 1.3) * 0.3 + Math.sin(t * 0.0131 + 0.4) * 0.2;
    flickA = 0.94 + fl * 0.06;

    ctx.globalAlpha = 0.85 + fl * 0.15;
    ctx.drawImage(S.glow, 0, 0, w, h);

    // fog
    for (const f of fogs) {
      if (!still) { f.x += f.v * dt; if (f.x > w + f.w * 0.5) f.x = -f.w * 0.5; else if (f.x < -f.w * 0.5) f.x = w + f.w * 0.5; }
      ctx.globalAlpha = f.a * (still ? 1 : 0.85 + 0.15 * Math.sin(t * 0.0003 + f.y));
      ctx.drawImage(S.fog, f.x - f.w * 0.5, f.y - f.h * 0.5, f.w, f.h);
    }

    // embers rise
    for (const e of embers) {
      if (!still) {
        e.y -= e.vy * dt;
        if (e.y < -20) { e.y = h + 20; e.x = api.rand() * w; }
      }
      const k = Math.max(0, Math.min(1, e.y / h));
      const tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * e.rate * 3 + e.ph);
      ctx.globalAlpha = Math.min(1, (1 - k * 0.7)) * tw * (still ? 0.7 : 1);
      const x = e.x + (still ? 0 : Math.sin(t * e.rate + e.ph) * e.sw);
      const s = e.sz * (0.7 + 0.5 * (1 - k));
      ctx.drawImage(S.ember, x - s, e.y - s, s * 2, s * 2);
    }

    // fireflies drift and blink
    for (const f of flies) {
      if (!still) {
        f.ang += Math.sin(t * f.rate + f.ph) * dt * 0.0014;
        f.x += Math.cos(f.ang) * f.sp * dt;
        f.y += Math.sin(f.ang) * f.sp * dt;
        if (f.x < -30) f.x = w + 30; else if (f.x > w + 30) f.x = -30;
        if (f.y < h * 0.05) { f.y = h * 0.05; f.ang = -f.ang; } else if (f.y > h + 10) { f.y = h * 0.4; }
      }
      const p = still ? 0.75 : Math.max(0, Math.sin(t * f.rate * 2.2 + f.ph));
      const a = 0.12 + 0.88 * p * p;
      ctx.globalAlpha = a;
      const s = f.sz * (0.8 + 0.3 * p);
      ctx.drawImage(f.acc ? S.acc : S.gold, f.x - s, f.y - s, s * 2, s * 2);
    }

    // sparkles released by a slide change
    if (!still) {
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt / 1250;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= 0.992; s.vy *= 0.992;
        const tw = 0.6 + 0.4 * Math.sin(t * 0.02 + s.ph);
        ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 1.6)) * tw;
        const z = s.sz * (0.5 + 0.7 * Math.max(0, s.life));
        ctx.drawImage(S.star, s.x - z, s.y - z, z * 2, z * 2);
      }
    }

    // vignette on top
    ctx.globalAlpha = flickA;
    ctx.drawImage(S.vig, 0, 0, w, h);
    ctx.globalAlpha = 1;
  };

  const refresh = (api) => { buildSprites(api); buildLayers(api); };

  // ---- art -------------------------------------------------------------------------------------
  const spark = (x, y, r) => `M${x} ${y - r}L${x + r * 0.22} ${y - r * 0.22}L${x + r} ${y}L${x + r * 0.22} ${y + r * 0.22}L${x} ${y + r}L${x - r * 0.22} ${y + r * 0.22}L${x - r} ${y}L${x - r * 0.22} ${y - r * 0.22}Z`;
  const twinkle = (pts) => pts.map(([x, y, r]) => `<path class="twinkle" d="${spark(x, y, r)}" style="fill:var(--acc);stroke:none"/>`).join('');
  const ticks = (cx, cy, r1, r2, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 6.2832;
    const long = i % 3 === 0;
    const rr = long ? r2 + 4 : r2;
    return `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join('');
  // a little rune per position on a ring (four shapes in turn)
  const runes = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 360;
    const k = i % 4;
    const d = k === 0 ? 'M0 -9V9M0 -9L7 -3M0 0L7 6' : k === 1 ? 'M-6 -9L6 9M6 -9L-6 9M-6 0H6' : k === 2 ? 'M-5 -9V9L5 3M-5 -3L5 -9' : 'M0 -9L7 0L0 9L-7 0ZM0 -9V9';
    return `<path d="${d}" transform="rotate(${a} ${cx} ${cy}) translate(${cx} ${cy - r})"/>`;
  }).join('');
  const curl = '<path d="M256 20C246 20 240 12 246 7C252 3 259 9 255 14C252.5 17 248 15 249.5 12.5"/><path d="M256 20H226" opacity=".9"/><circle cx="218" cy="20" r="2.6" style="fill:var(--acc);stroke:none"/><path d="M210 20H70" style="stroke:var(--acc)" opacity=".55"/><path d="M62 20H0" style="stroke:var(--acc)" stroke-dasharray="1.5 7" opacity=".5"/>';

  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
<circle cx="200" cy="205" r="172" style="stroke:var(--acc)" opacity=".55"/>
<circle cx="200" cy="205" r="164" style="stroke:var(--acc)" stroke-dasharray="1.5 7" opacity=".6"/>
<g class="spin" style="stroke:var(--acc)" opacity=".5"><path d="${ticks(200, 205, 177, 181, 36)}"/></g>
${twinkle([[84, 120, 7], [128, 76, 5], [182, 52, 4], [236, 78, 3.5], [150, 144, 3], [88, 190, 4], [330, 170, 4], [270, 52, 3.5]])}
<path d="M319 52A38 38 0 1 0 319 118A33.5 33.5 0 0 1 319 52Z" style="fill:var(--acc);stroke:var(--acc)" opacity=".92"/>
<path d="M118 108q8-8 16 0q8-8 16 0M286 150q6-6 12 0q6-6 12 0" opacity=".7"/>
<path d="M185 170V118H215V170M181 118H219" style="fill:color-mix(in srgb,var(--acc) 12%,var(--bg))"/>
<path d="M183 118L200 66L217 118Z" style="fill:color-mix(in srgb,var(--acc) 22%,var(--bg));stroke:var(--acc)"/>
<path d="M200 66V42" style="stroke:var(--acc)"/><path d="M200 44L228 52L200 60Z" style="fill:var(--acc);stroke:var(--acc)"/>
<path d="M124 292V198H152V292M120 198H156" style="fill:color-mix(in srgb,var(--acc) 12%,var(--bg))"/>
<path d="M121 198L138 150L155 198Z" style="fill:color-mix(in srgb,var(--acc) 22%,var(--bg));stroke:var(--acc)"/>
<path d="M138 150V130" style="stroke:var(--acc)"/><path d="M138 131L154 136L138 141Z" style="fill:var(--acc);stroke:var(--acc)"/>
<path d="M248 292V198H276M248 198H276V292M244 198H280" style="fill:color-mix(in srgb,var(--acc) 12%,var(--bg))"/>
<path d="M245 198L262 150L279 198Z" style="fill:color-mix(in srgb,var(--acc) 22%,var(--bg));stroke:var(--acc)"/>
<path d="M262 150V130" style="stroke:var(--acc)"/><path d="M262 131L278 136L262 141Z" style="fill:var(--acc);stroke:var(--acc)"/>
<path d="M164 292V164h8v7h8v-7h8v7h8v-7h8v7h8v-7h8v7h8v-7h8v7h8v-7h8V292Z" style="fill:color-mix(in srgb,var(--acc) 12%,var(--bg))"/>
<path d="M164 190H236M164 207H236" opacity=".3"/><path d="M180 190V207M200 190V207M220 190V207M172 207V224M192 207V224M212 207V224M232 207V224" opacity=".22"/>
<g style="fill:var(--acc);stroke:none"><path d="M176 232V220a4.5 4.5 0 0 1 9 0V232Z"/><path d="M215 232V220a4.5 4.5 0 0 1 9 0V232Z"/><path class="flame" d="M198.5 136v12h3v-12Z"/><path d="M136.5 214v14h3v-14Z"/><path d="M260.5 214v14h3v-14Z"/></g>
<path d="M189 292V256a11 11 0 0 1 22 0V292Z" style="fill:var(--bg);stroke:var(--acc)"/><path d="M195 250V290M200 246V290M205 250V290M189 262H211" style="stroke:var(--acc)" opacity=".5"/>
<path d="M73 318C105 292 138 272 172 267H228C262 272 295 292 327 318A170 170 0 0 1 73 318Z" style="fill:color-mix(in srgb,var(--acc) 9%,var(--bg))"/>
<path d="M92 330C132 308 168 304 200 306M214 312C250 308 282 316 310 332M118 346C156 330 190 330 214 336M236 346C262 340 286 346 298 354M160 352C176 346 190 346 204 350" opacity=".4"/>
<path d="M199 274C196 298 170 312 152 336" stroke-dasharray="2 6" style="stroke:var(--acc)"/>
<path d="M96 316l8-22 8 22ZM108 310l7-19 7 19ZM284 312l7-19 7 19ZM296 318l8-22 8 22Z" style="fill:color-mix(in srgb,var(--acc) 14%,var(--bg))"/>
</svg>`;

  const chapter = `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
<circle cx="100" cy="100" r="94" style="stroke:var(--acc)" opacity=".7"/>
<circle cx="100" cy="100" r="88" style="stroke:var(--acc)" stroke-dasharray="1.5 5" opacity=".6"/>
<g class="spin" style="stroke:var(--acc)" transform-origin="100 100"><circle cx="100" cy="100" r="80"/><circle cx="100" cy="100" r="58"/><g stroke-width="1.5">${runes(100, 100, 69, 12)}</g></g>
<g class="spin-r" style="stroke:var(--acc)"><path d="M100 60L134.6 120H65.4Z" style="fill:color-mix(in srgb,var(--acc) 10%,var(--bg))"/><path d="M100 140L65.4 80H134.6Z" style="fill:color-mix(in srgb,var(--acc) 10%,var(--bg))"/></g>
<circle cx="100" cy="100" r="15" style="stroke:var(--acc);fill:var(--bg)"/>
<path class="flame" d="M100 91C96 97 94 100 100 108C106 100 104 97 100 91Z" style="fill:var(--acc);stroke:none"/>
<g style="fill:var(--acc);stroke:none">${twinkle([[18, 28, 4], [182, 30, 3], [186, 170, 4], [14, 172, 3]])}</g>
</svg>`;

  const blob = (cx, cy, r, n, amp) => `${Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * 6.2832; const rr = r + (i % 2 ? amp : -amp * 0.4); return (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }).join('')}Z`;
  const wavy = (x, y, n) => `M${x} ${y}q5-6 10 0${'t10 0'.repeat(n)}`;
  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
${twinkle([[52, 90, 6], [340, 70, 5], [356, 220, 4], [40, 270, 4], [306, 36, 3]])}
<g transform="rotate(-5 200 200)">
<path d="M104 118H296V296H104Z" style="fill:color-mix(in srgb,var(--text) 9%,var(--bg))"/>
<rect x="86" y="96" width="228" height="28" rx="14" style="fill:color-mix(in srgb,var(--acc) 16%,var(--bg));stroke:var(--acc)"/>
<ellipse cx="96" cy="110" rx="5" ry="9" style="stroke:var(--acc)"/><ellipse cx="304" cy="110" rx="5" ry="9" style="stroke:var(--acc)"/>
<rect x="86" y="290" width="228" height="28" rx="14" style="fill:color-mix(in srgb,var(--acc) 16%,var(--bg));stroke:var(--acc)"/>
<ellipse cx="96" cy="304" rx="5" ry="9" style="stroke:var(--acc)"/><ellipse cx="304" cy="304" rx="5" ry="9" style="stroke:var(--acc)"/>
<path d="${wavy(128, 150, 17)}" opacity=".75"/><path d="${wavy(128, 174, 16)}" opacity=".6"/><path d="${wavy(128, 198, 17)}" opacity=".75"/><path d="${wavy(128, 222, 11)}" opacity=".6"/><path d="${wavy(128, 246, 6)}" opacity=".5"/>
<path d="M124 134H276" style="stroke:var(--acc)" opacity=".5"/>
<g transform="translate(262 264)"><path d="M-6 24Q-10 50-4 62Q2 66 4 58Q8 44 6 24Z" style="fill:color-mix(in srgb,var(--a2) 70%,var(--bg));stroke:var(--a2)"/><path d="${blob(0, 0, 30, 18, 3.2)}" style="fill:color-mix(in srgb,var(--a2) 72%,var(--bg));stroke:var(--a2);stroke-width:2.2"/><circle r="21" stroke-dasharray="2.5 3.5" style="stroke:var(--text)" opacity=".6"/>
<path d="M0 -12L3.4 -4L12 -4L5 1.6L7.8 10L0 5L-7.8 10L-5 1.6L-12 -4L-3.4 -4Z" style="fill:var(--text);stroke:none" opacity=".92"/></g>
</g>
</svg>`;

  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
<g style="stroke:var(--acc)">${curl}</g>
<g transform="translate(600 0) scale(-1 1)" style="stroke:var(--acc)">${curl}</g>
<path d="M300 2L311 20L300 38L289 20Z" style="fill:var(--acc);stroke:none"/><circle cx="300" cy="20" r="3" style="fill:var(--bg);stroke:none"/>
<path d="M272 20L278 14L284 20L278 26ZM316 20L322 14L328 20L322 26Z" style="fill:var(--acc);stroke:none" opacity=".75"/>
<path d="M286 20H291M309 20H314" style="stroke:var(--acc)"/>
</svg>`;

  Deck.registerTheme({
    name: 'fantasy',
    defaultTransition: 'dissolve',
    vocabulary: {
      map: 'The atlas', mapHint: 'Choose a chapter of the tale. Esc closes.', counter: 'Folio {n} of {N}', backupCounter: 'Lore {L}',
      now: 'On the page', next: 'Next folio', notes: "Scribe's notes", timer: 'Hourglass', presenter: 'The scribe',
      hint: '← → turn the folio · M atlas · P scribe · F full screen · ? spells',
      ambient: 'Embers', help: 'Spellbook',
    },
    art: { hero, chapter, closing, divider },
    ambient: {
      init(api) { refresh(api); populate(api); },
      resize(api) { refresh(api); populate(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { draw(api, 0, 0, true); },
      change(api, info) {
        dirx = info.dir === 'back' ? -1 : 1;
        if (info.from < 0) return;
        const g = rgb(api.accent(), gold);
        glowSprite(S.acc, mix(g, gold, 0.25).join(','), mix(g, [255, 255, 255], 0.8).join(','));
        let n = 0;
        for (const s of sparks) {
          if (s.life > 0) continue;
          s.x = api.w * (0.2 + api.rand() * 0.6); s.y = api.h * (0.2 + api.rand() * 0.6);
          const a = api.rand() * 6.283, v = 0.03 + api.rand() * 0.16;
          s.vx = Math.cos(a) * v + dirx * 0.1; s.vy = Math.sin(a) * v - 0.04;
          s.life = 0.7 + api.rand() * 0.3; s.sz = 5 + api.rand() * 10; s.ph = api.rand() * 6.283;
          if (++n >= 44) break;
        }
      },
    },
  });
})();
