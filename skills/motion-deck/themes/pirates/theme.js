/* Pirates theme: a parchment map with rolling waves, drifting clouds and a small ship on the ambient canvas; ink-and-watercolor line art. */
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

  const S = { bg: cv(2, 2), clouds: [cv(420, 150), cv(420, 150), cv(420, 150)] };
  let C = { bg: [236, 220, 182], bg2: [214, 191, 140], paper: [247, 236, 208], ink: [44, 26, 14], a1: [27, 93, 143], a5: [15, 110, 112], acc: [27, 93, 143] };
  let clouds = [];
  let layers = [];
  let ship = { x: 0, parts: null };
  let surge = 0;
  let dirSign = 1;
  let shipX = 0;

  const rs = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  const readColors = (api) => {
    C.bg = rgb(api.css('--bg'), C.bg);
    C.bg2 = rgb(api.css('--bg-2'), C.bg2);
    C.paper = rgb(api.css('--on-acc'), C.paper);
    C.ink = rgb(api.css('--text'), C.ink);
    C.a1 = rgb(api.css('--a1'), C.a1);
    C.a5 = rgb(api.css('--a5'), C.a5);
    C.acc = rgb(api.accent(), C.acc);
  };

  // parchment grain, stains and burnt edges: drawn once per size, blitted every frame
  const buildStatic = (api) => {
    const W = Math.max(2, Math.round(api.w));
    const H = Math.max(2, Math.round(api.h));
    S.bg.width = W; S.bg.height = H;
    const g = S.bg.getContext('2d');
    const area = W * H;
    g.fillStyle = rs(C.bg, 1);
    g.fillRect(0, 0, W, H);
    let gr = g.createRadialGradient(W * 0.46, H * 0.4, 0, W * 0.46, H * 0.4, Math.hypot(W, H) * 0.55);
    gr.addColorStop(0, rs(C.paper, 0.42));
    gr.addColorStop(1, rs(C.paper, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // stains
    const ns = Math.max(10, Math.min(30, Math.round(area / 60000)));
    for (let i = 0; i < ns; i++) {
      const x = api.rand() * W, y = api.rand() * H, r = 60 + api.rand() * 200;
      const dark = api.rand() < 0.6;
      gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rs(dark ? C.bg2 : C.paper, dark ? 0.1 + api.rand() * 0.2 : 0.12 + api.rand() * 0.18));
      gr.addColorStop(1, rs(dark ? C.bg2 : C.paper, 0));
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // fibres
    g.lineWidth = 0.7;
    const nf = Math.max(300, Math.min(2000, Math.round(area / 800)));
    for (let i = 0; i < nf; i++) {
      const x = api.rand() * W, y = api.rand() * H, a = api.rand() * 6.283, l = 5 + api.rand() * 16;
      g.strokeStyle = rs(api.rand() < 0.7 ? C.ink : C.bg2, 0.03 + api.rand() * 0.06);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 2, y + Math.sin(a) * l * 0.5 - 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // speckles
    const np = Math.max(2000, Math.min(20000, Math.round(area / 80)));
    for (let i = 0; i < np; i++) {
      g.fillStyle = rs(api.rand() < 0.75 ? C.ink : C.paper, 0.04 + api.rand() * 0.1);
      const z = api.rand() < 0.12 ? 2 : 1;
      g.fillRect(api.rand() * W, api.rand() * H, z, z);
    }
    // burnt edge
    const burn = mix(C.ink, C.bg2, 0.35);
    gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    gr.addColorStop(0, rs(burn, 0));
    gr.addColorStop(0.7, rs(burn, 0.12));
    gr.addColorStop(1, rs(burn, 0.42));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const nb = Math.max(50, Math.min(150, Math.round(area / 12000)));
    for (let i = 0; i < nb; i++) {
      const side = Math.floor(api.rand() * 4);
      const along = api.rand();
      const inset = api.rand() * 26;
      const x = side === 0 ? inset : side === 1 ? W - inset : along * W;
      const y = side === 2 ? inset : side === 3 ? H - inset : along * H;
      const r = 30 + api.rand() * 70;
      gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rs(burn, side === 3 ? 0.06 : 0.12));
      gr.addColorStop(1, rs(burn, 0));
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };

  const buildClouds = () => {
    const cc = mix(C.paper, [255, 255, 255], 0.55);
    S.clouds.forEach((c, k) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, 420, 150);
      const n = 7 + k;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = 70 + t * 280 + ((i * 37 + k * 11) % 23) - 11;
        const r = 30 + 26 * Math.sin(t * Math.PI) + ((i * 53 + k * 7) % 17);
        const y = 92 - 30 * Math.sin(t * Math.PI) + (i % 2 ? 8 : -2) + k * 3;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rs(cc, 0.95));
        gr.addColorStop(0.55, rs(cc, 0.5));
        gr.addColorStop(1, rs(cc, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
  };

  const populate = (api) => {
    const { w, h } = api;
    const nc = Math.max(4, Math.min(9, Math.round((w * h) / 200000)));
    clouds = Array.from({ length: nc }, () => ({ x: api.rand() * (w + 400) - 200, y: h * (0.03 + api.rand() * 0.26), s: 0.6 + api.rand() * 0.9, v: 0.004 + api.rand() * 0.009, a: 0.5 + api.rand() * 0.4, k: Math.floor(api.rand() * 3) }));
    const defs = [
      { base: 0.71, a1: 0.012, a2: 0.006, k1: 0.55, k2: 0.17, w1: 0.00045, fill: mix(C.a5, [255, 255, 255], 0.3), alpha: 0.2 },
      { base: 0.78, a1: 0.016, a2: 0.008, k1: 0.38, k2: 0.11, w1: 0.00072, fill: mix(C.a1, [255, 255, 255], 0.28), alpha: 0.24 },
      { base: 0.86, a1: 0.022, a2: 0.01, k1: 0.27, k2: 0.08, w1: 0.0011, fill: mix(C.a1, [255, 255, 255], 0.1), alpha: 0.28 },
    ];
    layers = defs.map((d, i) => {
      const L = { base: h * d.base, a1: h * d.a1, a2: h * d.a2, k1: (6.2832 / (w * d.k1)) * 1, k2: (6.2832 / (w * d.k2)) * 1, w1: d.w1, ph: api.rand() * 6.283, grad: null, gr: null };
      L.grad = api.ctx.createLinearGradient(0, L.base - L.a1 * 3, 0, h);
      L.grad.addColorStop(0, rs(d.fill, d.alpha));
      L.grad.addColorStop(1, rs(d.fill, d.alpha * 0.3));
      L.i = i;
      return L;
    });
    shipX = w * (0.12 + api.rand() * 0.2);
    if (!ship.parts) {
      ship.parts = [
        new Path2D('M-32 -2L34 -2L27 10L-25 10Z'),
        new Path2D('M-1.5 -2L1.5 -2L1.5 -74L-1.5 -74Z'),
        new Path2D('M-24 -62Q-2 -54 20 -62L17 -30Q-2 -24 -21 -30Z'),
        new Path2D('M-18 -27Q-2 -21 14 -27L12 -6L-16 -6Z'),
        new Path2D('M24 -4L7 -68L7 -4Z'),
        new Path2D('M0 -74L17 -70L0 -66Z'),
      ];
    }
  };

  const waveY = (L, x, sc) => L.base + sc * (L.a1 * Math.sin(x * L.k1 + L.ph) + L.a2 * Math.sin(x * L.k2 - L.ph * 1.7 + 1.3));

  const trace = (ctx, L, w, sc, step) => {
    ctx.beginPath();
    ctx.moveTo(0, waveY(L, 0, sc));
    for (let x = step; x < w + step; x += step) ctx.lineTo(x, waveY(L, x, sc));
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    ctx.globalAlpha = 1;
    ctx.drawImage(S.bg, 0, 0, w, h);

    if (!still) surge = Math.max(0, surge - dt / 1500);
    const sg = still ? 0 : surge;
    const sc = (1 + 1.2 * sg) * (h / 900);

    // clouds
    for (const c of clouds) {
      if (!still) {
        c.x -= c.v * dt * (1 + sg * 6 * dirSign);
        const cw = 420 * c.s;
        if (c.x > w + cw * 0.5) c.x = -cw; else if (c.x < -cw) c.x = w + cw * 0.5;
      }
      ctx.globalAlpha = c.a;
      ctx.drawImage(S.clouds[c.k], c.x, c.y, 420 * c.s, 150 * c.s);
    }
    ctx.globalAlpha = 1;

    // waves, back to front; the ship sails on the back one
    for (const L of layers) {
      if (!still) L.ph += (L.w1 + dirSign * sg * 0.004) * dt;
      trace(ctx, L, w, sc, 12);
      if (L.i === 2) { ctx.strokeStyle = rs(C.acc, 0.5); ctx.lineWidth = 2.5; ctx.stroke(); }
      else if (L.i === 1) { ctx.strokeStyle = rs(C.paper, 0.55); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.lineTo(w + 12, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = L.grad;
      ctx.fill();
      if (L.i === 0) {
        if (!still) { shipX += (0.012 + sg * 0.05 * dirSign) * dt * (w / 1600); if (shipX > w + 80) shipX = -80; else if (shipX < -80) shipX = w + 80; }
        const sx = still ? w * 0.93 : shipX;
        const y = waveY(L, sx, sc) + 2;
        const sl = (waveY(L, sx + 12, sc) - waveY(L, sx - 12, sc)) / 24;
        const k = (h / 900) * 0.6;
        ctx.save();
        ctx.translate(sx, y);
        ctx.rotate(Math.atan(sl) * 0.7 + (still ? 0 : Math.sin(t * 0.0013) * 0.025));
        ctx.scale(k, k);
        ctx.fillStyle = rs(C.ink, 0.42);
        for (const p of ship.parts) ctx.fill(p);
        ctx.restore();
      }
    }
  };

  const refresh = (api) => { readColors(api); buildStatic(api); buildClouds(); populate(api); };

  // ---- art -------------------------------------------------------------------------------------
  const spark = (x, y, r) => `M${x} ${y - r}L${x + r * 0.22} ${y - r * 0.22}L${x + r} ${y}L${x + r * 0.22} ${y + r * 0.22}L${x} ${y + r}L${x - r * 0.22} ${y + r * 0.22}L${x - r} ${y}L${x - r * 0.22} ${y - r * 0.22}Z`;
  const twinkle = (pts, col) => pts.map(([x, y, r]) => `<path class="twinkle" d="${spark(x, y, r)}" style="fill:${col};stroke:none"/>`).join('');
  const wv = (x, y, n, w, a) => `M${x} ${y}q${w / 2} ${-a} ${w} 0${`t${w} 0`.repeat(n - 1)}`;
  const wash = (c, p) => `fill:color-mix(in srgb,var(${c}) ${p}%,transparent);stroke:none`;
  const paper = 'color-mix(in srgb,var(--on-acc) 78%,var(--bg))';
  const wood = 'color-mix(in srgb,var(--a3) 42%,var(--bg))';

  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="296" cy="104" r="58" style="${wash('--a3', 26)}"/><circle cx="289" cy="109" r="50" style="${wash('--a3', 18)}"/>
<path d="M34 112q8-20 30-12q10-18 32-4q24-4 22 14Z" style="${wash('--a1', 14)}"/><path d="M34 112q8-20 30-12q10-18 32-4q24-4 22 14Z" stroke-width="1.6" opacity=".7"/>
<path d="M330 66q7-8 14 0q7-8 14 0M352 92q5-6 10 0q5-6 10 0" stroke-width="2" opacity=".75"/>
<g class="rock">
<path d="M92 262H308C300 296 270 318 236 322H164C130 318 100 296 92 262Z" style="fill:${wood}"/>
<path d="M98 274H302M110 296H290" opacity=".55"/><g style="fill:var(--bg)" stroke-width="1.8"><circle cx="140" cy="286" r="5"/><circle cx="180" cy="290" r="5"/><circle cx="220" cy="290" r="5"/><circle cx="260" cy="286" r="5"/></g>
<path d="M92 262V240H132V262M96 240L112 226H132" style="fill:${wood}"/><path d="M308 262L364 230" stroke-width="3"/>
<path d="M200 262V30M272 262V96M140 262V122" stroke-width="3.6"/>
<path d="M158 90H242" stroke-width="4"/><path d="M162 90Q200 80 238 90Q250 142 242 196Q200 214 158 196Q150 142 162 90Z" style="fill:${paper}"/>
<path d="M176 40H224" stroke-width="3.4"/><path d="M178 40Q200 34 222 40Q228 62 224 82Q200 90 176 82Q172 62 178 40Z" style="fill:${paper}"/>
<path d="M244 100Q272 94 300 100Q306 142 300 190Q272 202 244 190Q238 142 244 100Z" style="fill:${paper}"/><path d="M242 100H302" stroke-width="3.4"/>
<path d="M140 122L140 238L98 238Q110 170 140 122Z" style="fill:${paper}"/>
<path d="M182 124L218 164M218 124L182 164" stroke-width="5" style="stroke:var(--a2)"/>
<path d="M200 30V12M200 14L240 23L200 32" stroke-width="2"/><path class="flag" d="M200 14L240 23L200 32Z" style="fill:var(--a2);stroke:var(--text)"/>
<path d="M200 34L362 230M200 34L92 240M272 98L338 234" stroke-width="1.2" opacity=".6"/>
<path d="M176 118Q200 126 224 118M168 148Q200 158 232 148" stroke-width="1.2" opacity=".4"/>
</g>
<ellipse class="wave" cx="200" cy="344" rx="196" ry="20" style="${wash('--a1', 26)}"/>
<path class="wave" d="${wv(10, 322, 7, 54, 24)}" style="stroke:var(--a1)"/>
<ellipse class="wave2" cx="200" cy="368" rx="180" ry="17" style="${wash('--a5', 26)}"/>
<path class="wave2" d="${wv(16, 350, 6, 61, 20)}" style="stroke:var(--a5)"/>
<path d="M60 380q20-12 40 0M300 376q18-10 36 0" stroke-width="1.6" style="stroke:var(--a1)" opacity=".6"/>
</svg>`;

  const compass = (() => {
    const pt = (a, len, wd) => `<path d="M0 ${-len}L${wd} 0L0 0Z" style="fill:color-mix(in srgb,var(--acc) 45%,var(--bg))" transform="rotate(${a})"/><path d="M0 ${-len}L${-wd} 0L0 0Z" style="fill:${paper}" transform="rotate(${a})"/>`;
    const tk = Array.from({ length: 32 }, (_, i) => { const a = (i / 32) * 6.2832; const r1 = 78, r2 = i % 4 === 0 ? 70 : 74; return `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2).toFixed(1)}`; }).join('');
    return `<svg viewBox="0 0 200 200" fill="none" stroke="var(--text)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
<g transform="translate(100 100)">
<circle r="86" style="${wash('--a3', 12)}"/><circle r="86" stroke-width="2.4"/><circle r="80" stroke-width="1.2" stroke-dasharray="2 4" opacity=".8"/><path d="${tk}" stroke-width="1.4"/>
<g stroke-width="1.6">${pt(45, 52, 11)}${pt(135, 52, 11)}${pt(225, 52, 11)}${pt(315, 52, 11)}</g>
<g stroke-width="1.8">${pt(90, 74, 14)}${pt(180, 74, 14)}${pt(270, 74, 14)}</g>
<g class="needle"><path d="M0 -74L14 0L-14 0Z" style="fill:var(--a2);stroke:var(--text)"/><path d="M0 0L14 0" opacity="0"/></g>
<circle r="9" style="fill:var(--bg)"/><circle r="3.5" style="fill:var(--text);stroke:none"/>
</g>
<path d="M93 17V4L107 17V4" stroke-width="2.6"/>
</svg>`;
  })();

  const coins = [[150, 210], [200, 198], [248, 208], [176, 216], [224, 216], [124, 218], [272, 220], [200, 222]]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="5.5" style="fill:color-mix(in srgb,var(--a3) 42%,var(--bg))"/>`).join('');

  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<ellipse cx="200" cy="318" rx="130" ry="18" style="${wash('--text', 14)}"/>
<path d="M104 222L120 140Q200 114 280 140L296 222Z" style="fill:${wood}"/>
<path d="M122 142Q200 116 278 142L282 164Q200 140 118 164Z" style="fill:color-mix(in srgb,var(--text) 52%,var(--bg))" stroke-width="1.6"/>
<path d="M148 138V218M252 138V218" stroke-width="5" opacity=".7"/>
<path d="M100 222Q200 156 300 222Z" style="fill:color-mix(in srgb,var(--a3) 34%,var(--bg))"/>
${coins}
<path d="M168 186l9-12 9 12-9 10ZM234 190l8-10 8 10-8 8Z" style="fill:var(--a2)" stroke-width="1.6"/><path d="M204 176l7-9 7 9-7 8Z" style="fill:var(--a5)" stroke-width="1.6"/>
<path d="M100 222H300V298Q300 310 288 310H112Q100 310 100 298Z" style="fill:${wood}"/>
<path d="M126 222V310M274 222V310" stroke-width="6" opacity=".75"/><path d="M104 244H296" opacity=".5"/>
<rect x="184" y="216" width="32" height="40" rx="4" style="fill:var(--a3)"/><circle cx="200" cy="233" r="5" style="fill:var(--bg)"/><path d="M200 235V246" stroke-width="3"/>
${twinkle([[112, 100, 8], [292, 92, 6], [200, 70, 7], [330, 150, 4.5], [66, 150, 4.5], [250, 120, 3.5]], 'var(--a3)')}
<path d="M356 354C320 326 258 360 196 340S104 352 82 348" stroke-dasharray="3 9" style="stroke:var(--a2)" stroke-width="2.6"/>
<path d="M58 332L82 360M82 332L58 360" stroke-width="7" style="stroke:var(--a2)"/>
</svg>`;

  const rope = (x0, x1, flip) => {
    let d = '';
    for (let x = x0; x < x1; x += 9) d += `M${x} ${flip ? 26 : 14}L${x + 7} ${flip ? 14 : 26}`;
    return d;
  };
  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M6 14H258M6 26H258M342 14H594M342 26H594" opacity=".9"/><path d="${rope(8, 254, false)}${rope(344, 590, true)}" stroke-width="1.8" opacity=".75"/>
<path d="M6 14Q0 20 6 26M594 14Q600 20 594 26" stroke-width="2.2"/>
<ellipse cx="278" cy="20" rx="24" ry="11" transform="rotate(-18 278 20)" style="fill:color-mix(in srgb,var(--a3) 26%,transparent)"/>
<ellipse cx="322" cy="20" rx="24" ry="11" transform="rotate(18 322 20)" style="fill:color-mix(in srgb,var(--a3) 26%,transparent)"/>
<ellipse cx="300" cy="20" rx="14" ry="9" style="fill:var(--bg)"/><path d="M286 14L314 26M286 26L314 14" stroke-width="2.4" style="stroke:var(--a2)"/>
</svg>`;

  Deck.registerTheme({
    name: 'pirates',
    defaultTransition: 'sail',
    vocabulary: {
      map: 'The treasure map', mapHint: 'Pick a landmark to sail there. Esc closes.', counter: 'Port {n} of {N}', backupCounter: 'Hold {L}',
      now: 'On deck', next: 'Next port', notes: "Captain's log", timer: 'Hourglass', presenter: "Captain's quarters",
      hint: "← → set sail · M treasure map · P captain's quarters · F full screen · ? rules",
      ambient: 'Waves', help: 'Ship rules',
    },
    art: { hero, chapter: compass, closing, divider },
    ambient: {
      init(api) { refresh(api); },
      resize(api) { refresh(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { C.acc = rgb(api.accent(), C.acc); draw(api, 0, 0, true); },
      change(api, info) {
        C.acc = rgb(api.accent(), C.acc);
        dirSign = info.dir === 'back' ? -1 : 1;
        if (info.from >= 0) surge = 1;
      },
    },
  });
})();
