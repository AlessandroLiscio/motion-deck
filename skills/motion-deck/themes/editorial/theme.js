/* Editorial theme: paper grain, drifting ink-wash light and dust on the ambient canvas, engraving line art (book and nib, folio frame, wax seal, fleuron rule). */
(() => {
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const pctx = px.getContext('2d', { willReadFrequently: true });
  // any css color (hex, rgb, color-mix, oklch) to [r, g, b]; called on init and on slide change only
  const rgb = (c, fb) => {
    try {
      pctx.clearRect(0, 0, 1, 1);
      pctx.fillStyle = '#000';
      pctx.fillStyle = (c || '').trim() || '#000';
      pctx.fillRect(0, 0, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return fb || [31, 79, 163]; }
  };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  const S = 256;
  let paper = null; // vignette and grain, pre-rendered at the window size
  let sweepSprite = null;
  const washes = []; // { x, y, r, sp, ph, a, accent, cur, prev }
  let motes = [];
  let ink = [27, 32, 48];
  let tintTo = [31, 79, 163];
  let mix = 1;
  let sweep = 0;
  let sweepDir = 1;

  const blob = (cv, c) => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, S, S);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.55)`);
    gr.addColorStop(0.45, `rgba(${c[0]},${c[1]},${c[2]},.2)`);
    gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  };

  const buildPaper = (api) => {
    const { w, h, dpr } = api;
    // noise tile, rendered once from the seeded random source
    const T = 192;
    const tile = mk(T, T);
    const tg = tile.getContext('2d');
    const img = tg.createImageData(T, T);
    const d = img.data;
    for (let i = 0; i < T * T; i++) {
      const r = api.rand();
      const dark = api.rand() < 0.62;
      const a = Math.pow(r, 3) * (dark ? 30 : 85);
      d[i * 4] = dark ? ink[0] : 255;
      d[i * 4 + 1] = dark ? ink[1] : 253;
      d[i * 4 + 2] = dark ? ink[2] : 246;
      d[i * 4 + 3] = a;
    }
    tg.putImageData(img, 0, 0);
    paper = mk(w * dpr, h * dpr);
    const g = paper.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.fillRect(0, 0, w, h);
    // soft vignette so the page edges sit a little darker than the middle
    const v = g.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    v.addColorStop(0, `rgba(${ink[0]},${ink[1]},${ink[2]},0)`);
    v.addColorStop(1, `rgba(${ink[0]},${ink[1]},${ink[2]},.07)`);
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  };

  const populate = (api) => {
    ink = rgb(api.css('--text'), ink);
    washes.length = 0;
    const warm = rgb(api.css('--a4'), [152, 101, 15]);
    const cfg = [
      { x: 0.2, y: 0.18, r: 0.62, sp: 0.00011, ph: 0.4, a: 0.11, accent: true },
      { x: 0.86, y: 0.8, r: 0.56, sp: 0.00008, ph: 2.1, a: 0.2, accent: false },
      { x: 0.7, y: 0.12, r: 0.4, sp: 0.00014, ph: 4.2, a: 0.08, accent: true },
    ];
    cfg.forEach((c) => {
      const cur = mk(S, S);
      const prev = mk(S, S);
      blob(cur, c.accent ? tintTo : warm);
      blob(prev, c.accent ? tintTo : warm);
      washes.push(Object.assign({ cur, prev }, c));
    });
    const n = Math.max(24, Math.min(70, Math.round((api.w * api.h) / 26000)));
    motes = Array.from({ length: n }, () => ({
      x: api.rand() * api.w, y: api.rand() * api.h, r: 0.7 + api.rand() * 1.7, a: 0.12 + api.rand() * 0.3,
      vx: 0.003 + api.rand() * 0.007, vy: -0.0015 - api.rand() * 0.004, ph: api.rand() * 6.28,
    }));
    sweepSprite = mk(256, 4);
    const sg = sweepSprite.getContext('2d');
    const gr = sg.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(255,252,242,0)');
    gr.addColorStop(0.5, 'rgba(255,252,242,.5)');
    gr.addColorStop(1, 'rgba(255,252,242,0)');
    sg.fillStyle = gr;
    sg.fillRect(0, 0, 256, 4);
    buildPaper(api);
  };

  const setTint = (api, c) => {
    tintTo = c;
    washes.forEach((x) => {
      if (!x.accent) return;
      const tmp = x.prev; x.prev = x.cur; x.cur = tmp;
      // prev keeps the old look: copy the old sprite, then paint the new tint into cur
      blob(x.cur, c);
    });
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    ctx.clearRect(0, 0, w, h);
    if (still) { mix = 1; sweep = 0; } else { mix = Math.min(1, mix + dt / 800); sweep = Math.max(0, sweep - dt / 1100); }
    const R = Math.max(w, h);
    for (let i = 0; i < washes.length; i++) {
      const x = washes[i];
      const cx = (x.x + (still ? 0 : Math.sin(t * x.sp + x.ph) * 0.07)) * w;
      const cy = (x.y + (still ? 0 : Math.cos(t * x.sp * 0.8 + x.ph) * 0.06)) * h;
      const r = x.r * R;
      if (x.accent && mix < 1) {
        ctx.globalAlpha = x.a * (1 - mix);
        ctx.drawImage(x.prev, cx - r, cy - r, r * 2, r * 2);
        ctx.globalAlpha = x.a * mix;
      } else ctx.globalAlpha = x.a;
      ctx.drawImage(x.cur, cx - r, cy - r, r * 2, r * 2);
    }
    // dust in the light
    ctx.fillStyle = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      if (!still) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x > w + 8) m.x = -8;
        if (m.y < -8) m.y = h + 8;
      }
      ctx.globalAlpha = m.a * (still ? 0.7 : 0.55 + 0.45 * Math.sin(t * 0.0006 + m.ph));
      ctx.beginPath();
      ctx.arc(m.x + (still ? 0 : Math.sin(t * 0.0004 + m.ph) * 6), m.y, m.r, 0, 6.283);
      ctx.fill();
    }
    // a glint of light passes over the page when it turns
    if (sweep > 0) {
      const p = 1 - sweep;
      const bw = w * 0.5;
      const x = sweepDir > 0 ? -bw + p * (w + bw) : w - p * (w + bw);
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      ctx.drawImage(sweepSprite, x, 0, bw, h);
    }
    ctx.globalAlpha = 1;
    if (paper) ctx.drawImage(paper, 0, 0, w, h);
  };

  // ---------- art ----------
  const star = (x, y, s) => `<path d="M${x} ${y - s}V${y + s}M${x - s} ${y}H${x + s}M${x - s * 0.5} ${y - s * 0.5}L${x + s * 0.5} ${y + s * 0.5}M${x + s * 0.5} ${y - s * 0.5}L${x - s * 0.5} ${y + s * 0.5}" style="stroke:var(--acc)" stroke-width="1.5"/>`;
  const lines = (n, x0, y0, dy, f) => Array.from({ length: n }, (_, i) => f(x0, y0 + i * dy, i)).join('');
  const f1 = (v) => Math.round(v * 10) / 10;

  const flourish = `<path class="draw" pathLength="1" d="M200 356C182 342 160 340 140 350C122 359 104 362 88 352C76 345 72 333 82 329C91 326 97 333 91 338" stroke-width="2.6"/>
<path class="draw" pathLength="1" d="M200 356C218 342 240 340 260 350C278 359 296 362 312 352C324 345 328 333 318 329C309 326 303 333 309 338" stroke-width="2.6"/>
<path class="draw2" pathLength="1" d="M200 362C184 350 164 349 146 357C130 364 114 366 100 360M200 362C216 350 236 349 254 357C270 364 286 366 300 360" stroke-width="1" opacity=".7"/>
<path d="M200 346L206 356L200 366L194 356Z" style="fill:var(--acc);stroke:none"/>`;

  const leafL = 'M284 20C274 8 262 10 258 20C262 30 274 32 284 20Z';

  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${star(62, 88, 9)}${star(104, 54, 6)}${star(34, 132, 5)}
<path d="M44 154V308C108 292 170 300 200 330C230 300 292 292 356 308V154" stroke-width="2.6" opacity=".9"/>
<path d="M50 296C110 282 170 290 200 314C230 290 290 282 350 296M50 304C110 290 170 298 200 322C230 298 290 290 350 304" stroke-width="1" opacity=".5"/>
<path d="M200 176C170 152 110 144 50 158V288C110 274 170 282 200 306Z" style="fill:color-mix(in srgb,var(--bg) 40%,var(--paper-hi))"/>
<path d="M200 176C230 152 290 144 350 158V288C290 274 230 282 200 306Z" style="fill:color-mix(in srgb,var(--bg) 40%,var(--paper-hi))"/>
<path d="M200 176V306" stroke-width="1.6" opacity=".75"/>
<path d="M194 186L184 184M194 202L180 199M194 218L178 214M194 234L176 229M194 250L176 244M194 266L178 259M194 282L184 275" stroke-width="1" opacity=".45"/>
<path d="M206 186L216 184M206 202L220 199M206 218L222 214M206 234L224 229" stroke-width="1" opacity=".45"/>
${lines(6, 0, 0, 18, (a, y, i) => `<path d="M66 ${184 + y}C112 ${174 + y} 156 ${180 + y} ${i === 5 ? 140 : 184} ${(i === 5 ? 190 : 198) + y}" stroke-width="1.3" opacity=".55"/>`)}
<rect x="66" y="176" width="18" height="18" rx="1" style="fill:var(--acc);stroke:none" transform="rotate(-6 75 185)"/>
<path d="M222 186C246 172 288 168 332 178V232C288 222 246 226 222 240Z" stroke-width="1.6"/>
<circle cx="290" cy="200" r="10" style="stroke:var(--acc)" stroke-width="2"/>
<path d="M290 182V176M274 188L270 184M306 188L310 184M270 200H264M310 200H316" style="stroke:var(--acc)" stroke-width="1.2"/>
<path d="M224 232C248 214 268 222 290 214S318 212 332 220M226 224C248 208 266 214 290 208M232 238C252 226 270 232 290 226" stroke-width="1.1" opacity=".7"/>
<path d="M222 256C250 244 290 242 332 252M222 272C250 260 290 258 316 266" stroke-width="1.3" opacity=".55"/>
${flourish}
<g class="nib"><g transform="translate(250 252) rotate(36)">
<path d="M0 0C-5 -14 -16 -34 -17 -62C-17 -74 -10 -84 0 -86C10 -84 17 -74 17 -62C16 -34 5 -14 0 0Z" style="fill:color-mix(in srgb,var(--bg) 35%,var(--paper-hi))" stroke-width="2.4"/>
<path d="M0 0V-54" stroke-width="1.5"/><circle cx="0" cy="-60" r="4.6" style="fill:currentColor;stroke:none"/>
<path d="M-11 -26L-6 -46M11 -26L6 -46M-14 -40L-9 -58M14 -40L9 -58" stroke-width="1" opacity=".6"/>
<path d="M-17 -88L-14 -112H14L17 -88Z" style="fill:color-mix(in srgb,var(--acc) 22%,var(--bg))" stroke-width="2"/>
<path d="M-15 -120H15M-16 -126H16" style="stroke:var(--acc)" stroke-width="1.6"/>
<path d="M-14 -112C-18 -150 -20 -184 -18 -222H18C20 -184 18 -150 14 -112Z" style="fill:color-mix(in srgb,var(--text) 84%,var(--bg))" stroke-width="2"/>
<path d="M-8 -128C-10 -160 -11 -190 -10 -216" style="stroke:var(--bg)" stroke-width="2" opacity=".55"/>
</g></g>
<circle class="drop" cx="264" cy="282" r="3.4" style="fill:var(--acc);stroke:none"/><circle class="drop" cx="276" cy="296" r="2" style="fill:var(--acc);stroke:none"/>
</svg>`;

  // folio frame with notched corners and an ink blot
  const chapter = `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M38 22H162A16 16 0 0 0 178 38V162A16 16 0 0 0 162 178H38A16 16 0 0 0 22 162V38A16 16 0 0 0 38 22Z" stroke-width="2.8"/>
<path d="M34 34H166V166H34Z" stroke-width="1" opacity=".7"/>
<path d="M44 44H156M44 156H156" stroke-width="1" opacity=".35"/>
<path class="draw" pathLength="1" d="M100 66C120 62 138 76 134 96C144 110 136 132 118 132C108 146 88 142 82 128C66 126 60 106 72 94C66 80 82 68 100 66Z" style="fill:color-mix(in srgb,var(--text) 90%,var(--acc));stroke:var(--text)" stroke-width="1.6"/>
<path d="M88 88C92 82 100 80 108 82" style="stroke:var(--bg)" stroke-width="2.2" opacity=".45"/><path d="M110 70C120 68 128 72 132 80" style="stroke:var(--bg)" stroke-width="1.6" opacity=".3"/>
<g style="fill:var(--acc);stroke:none"><circle cx="146" cy="66" r="3.4"/><circle cx="156" cy="80" r="1.8"/><circle cx="52" cy="140" r="2.8"/><circle cx="62" cy="152" r="1.5"/><circle cx="144" cy="150" r="2.2"/><circle cx="58" cy="64" r="1.6"/></g>
</svg>`;

  // wax seal on ribbon tails, with engraved rays
  const sealPts = (() => {
    const out = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * 6.2832;
      const r = 112 + 6 * Math.sin(a * 11) + 3 * Math.sin(a * 5 + 1);
      out.push(`${f1(200 + r * Math.cos(a))} ${f1(170 + r * Math.sin(a))}`);
    }
    return 'M' + out.join('L') + 'Z';
  })();
  const rays = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * 6.2832;
    const r1 = 136;
    const r2 = 142 + (i % 2) * 10;
    return `M${f1(200 + r1 * Math.cos(a))} ${f1(170 + r1 * Math.sin(a))}L${f1(200 + r2 * Math.cos(a))} ${f1(170 + r2 * Math.sin(a))}`;
  }).join('');
  const petals = Array.from({ length: 8 }, (_, i) => `<ellipse cx="200" cy="138" rx="12" ry="30" transform="rotate(${i * 45} 200 170)"/>`).join('');
  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="${rays}" stroke-width="1.1" opacity=".5"/>
<path d="M172 270L146 380L168 364L182 384L196 282Z" style="fill:color-mix(in srgb,var(--acc) 22%,var(--bg))" stroke-width="2.2"/>
<path d="M228 270L254 380L232 364L218 384L204 282Z" style="fill:color-mix(in srgb,var(--acc) 22%,var(--bg))" stroke-width="2.2"/>
<g class="seal">
<path d="${sealPts}" style="fill:color-mix(in srgb,var(--acc) 88%,var(--text))" stroke-width="2.2"/>
<circle cx="200" cy="170" r="86" style="stroke:var(--bg)" stroke-width="3" opacity=".7"/>
<circle cx="200" cy="170" r="78" style="stroke:var(--bg)" stroke-width="1" stroke-dasharray="2 5" opacity=".7"/>
<g style="stroke:var(--bg)" stroke-width="2.2" opacity=".85">${petals}</g>
<circle cx="200" cy="170" r="11" style="fill:var(--bg);stroke:none"/>
<path d="M120 112C140 96 164 90 186 92" style="stroke:var(--bg)" stroke-width="3" opacity=".25"/>
</g>
${star(60, 300, 8)}${star(340, 76, 7)}${star(334, 330, 5)}
</svg>`;

  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
<path d="M0 20H238M362 20H600" style="stroke:var(--line)"/>
<path d="M0 25H210M390 25H600" style="stroke:var(--line)" stroke-width="1" opacity=".6"/>
<path d="M300 7L311 20L300 33L289 20Z" style="fill:var(--acc);stroke:none"/>
<path d="${leafL}" style="stroke:var(--acc)" transform="translate(-14 0)"/>
<path d="${leafL}" style="stroke:var(--acc)" transform="translate(600 0) scale(-1 1) translate(-14 0)"/>
<circle cx="236" cy="20" r="2.6" style="fill:var(--acc);stroke:none"/><circle cx="364" cy="20" r="2.6" style="fill:var(--acc);stroke:none"/>
</svg>`;

  // a roughening filter for diagram shapes, so they look drawn in ink; created once
  const addInk = () => {
    if (document.getElementById('md-ink')) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;width:0;height:0';
    s.innerHTML = '<filter id="md-ink" x="-6%" y="-12%" width="112%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(s);
  };

  Deck.registerTheme({
    name: 'editorial',
    defaultTransition: 'lift',
    vocabulary: {
      map: 'Contents', mapHint: 'Pick a page. Esc closes.', counter: '{n} of {N}', backupCounter: 'Appendix {L}',
      now: 'This page', next: 'Next page', notes: 'Margin notes', timer: 'Reading time', presenter: 'The desk',
      hint: '← → turn the page · M contents · P the desk · F full screen',
    },
    art: { hero, chapter, closing, divider },
    ambient: {
      init(api) { addInk(); tintTo = rgb(api.accent()); populate(api); },
      resize(api) { if (washes.length || paper) populate(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { const c = rgb(api.accent(), tintTo); if (c[0] !== tintTo[0] || c[1] !== tintTo[1] || c[2] !== tintTo[2]) setTint(api, c); draw(api, 0, 0, true); },
      change(api, info) {
        const c = rgb(api.accent(), tintTo);
        if (c[0] !== tintTo[0] || c[1] !== tintTo[1] || c[2] !== tintTo[2]) { setTint(api, c); mix = 0; }
        if (info.from >= 0) { sweep = 1; sweepDir = info.dir === 'back' ? -1 : 1; }
      },
    },
  });
})();
