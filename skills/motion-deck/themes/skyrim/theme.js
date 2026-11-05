/* Skyrim theme: aurora bands that take the section accent, three depths of falling snow that a gust sweeps on every slide change, two mountain ridges that shift a little, and original line art. An unofficial homage; nothing here comes from the game. */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const pctx = px.getContext('2d', { willReadFrequently: true });
  // any css color to [r, g, b]; used on build and slide change only
  const rgb = (c, fb) => {
    try {
      pctx.clearRect(0, 0, 1, 1);
      pctx.fillStyle = '#000';
      pctx.fillStyle = (c || '').trim() || '#000';
      pctx.fillRect(0, 0, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return fb; }
  };
  const mix = (a, b, k) => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
  const str = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h)); return c; };
  // a small deterministic generator, so the ridges keep their shape on every resize
  const prng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let cBg = [11, 16, 22], cBg2 = [19, 29, 41], cText = [238, 243, 248], cIce = [126, 200, 240];
  let tint = [126, 200, 240], tintKey = '', starStyle = '#fff';
  let auroraA = null, auroraB = null, fade = 1; // the old and the new tinted aurora; fade 0 to 1 crossfades them
  let sky = null, mist = null, ridgeFar = null, ridgeNear = null, flake = [];
  let stars = new Float32Array(0);
  let flakes = null; // x, y, size, speed, phase, sway, depth per flake, in one typed array
  let nFlakes = 0;
  const aur = [0, 0, 0], aurSpeed = [0.006, -0.0045, 0.0034];
  let farX = 0, farT = 0, nearX = 0, nearT = 0, stepSign = 1;
  let gust = 0, boost = 0;
  let ready = false;
  const MARGIN = 160;
  const BAND_SCALE = [1, 0.78, 1.18], BAND_LIFT = [0, 0.1, -0.12], BAND_ALPHA = [0.8, 0.55, 0.45];

  // ---------- sprites, built once (the aurora again on each slide change) ----------
  const paintAurora = (c, col) => {
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    for (let x = 0; x < W; x++) {
      const u = (x / W) * TAU;
      const body = 0.52 + 0.3 * Math.sin(u * 2 + 0.7) + 0.2 * Math.sin(u * 5 + 2.1) + 0.1 * Math.sin(u * 9 + 4.2) - 0.08;
      const ray = 0.8 + 0.2 * Math.sin(u * 41 + 1.3) * Math.sin(u * 23 + 0.4);
      const a = clamp(body, 0, 1) * ray;
      if (a < 0.04) continue;
      const hh = H * (0.5 + 0.46 * (0.5 + 0.5 * Math.sin(u * 3 + 1.9)));
      const grd = g.createLinearGradient(0, 0, 0, hh);
      grd.addColorStop(0, str(col, 0));
      grd.addColorStop(0.3, str(col, 0.4 * a));
      grd.addColorStop(0.55, str(col, 0.2 * a));
      grd.addColorStop(1, str(col, 0));
      g.fillStyle = grd;
      g.fillRect(x, 0, 1, hh);
    }
  };

  const makeRidge = (w, h, seed, scale, floor, top, bot, edge) => {
    const rnd = prng(seed);
    const tbl = Float32Array.from({ length: 256 }, rnd);
    const noise = (x) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return tbl[i & 255] + (tbl[(i + 1) & 255] - tbl[i & 255]) * s; };
    const height = (x) => {
      let v = 0, amp = 1, sum = 0, fr = 1 / scale;
      for (let o = 0; o < 3; o++) { v += (1 - Math.abs(noise(x * fr + o * 17.3) * 2 - 1)) * amp; sum += amp; amp *= 0.42; fr *= 2.3; }
      return v / sum;
    };
    const c = cv(w, h);
    const g = c.getContext('2d');
    const pts = [];
    for (let x = 0; x <= c.width + 8; x += 8) pts.push([x, c.height * (1 - (floor + (1 - floor) * Math.pow(height(x), 1.5)))]);
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, str(top));
    grd.addColorStop(1, str(bot));
    g.beginPath();
    g.moveTo(0, c.height);
    pts.forEach((p) => g.lineTo(p[0], p[1]));
    g.lineTo(c.width, c.height);
    g.closePath();
    g.fillStyle = grd;
    g.fill();
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.strokeStyle = str(edge, 0.22);
    g.lineWidth = 1.5;
    g.stroke();
    return c;
  };

  const softDot = (size, core) => {
    const c = cv(size, size);
    const g = c.getContext('2d');
    const r = size / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, str(cText, 1));
    gr.addColorStop(core, str(cText, 0.85));
    gr.addColorStop(1, str(cText, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  };
  const DEPTH = [
    { sprite: null, core: 0.45, size: [2.5, 5], speed: [0.016, 0.028], wind: 0.35, alpha: 0.7, share: 0.58 },
    { sprite: null, core: 0.3, size: [6, 11], speed: [0.03, 0.05], wind: 0.75, alpha: 0.55, share: 0.30 },
    { sprite: null, core: 0.1, size: [18, 34], speed: [0.06, 0.09], wind: 1.5, alpha: 0.15, share: 0.12 },
  ];

  const build = (api) => {
    const { w, h } = api;
    cBg = rgb(api.css('--bg'), cBg);
    cBg2 = rgb(api.css('--bg-2'), cBg2);
    cText = rgb(api.css('--text'), cText);
    cIce = rgb(api.css('--a1'), cIce);
    starStyle = str(cText);
    sky = null;
    mist = null;
    // aurora: half resolution, one sprite wide enough to wrap
    const sw = Math.ceil(w / 2);
    const sh = Math.ceil(h * 0.22);
    if (!auroraA || auroraA.width !== sw || auroraA.height !== sh) { auroraA = cv(sw, sh); auroraB = cv(sw, sh); }
    paintAurora(auroraB, tint);
    fade = 1;
    tintKey = tint.join(',');
    // ridges: the far one pale and cold, the near one a dark silhouette
    ridgeFar = makeRidge(w + MARGIN * 2, h * 0.4, 7, 380, 0.2, mix(cBg2, cIce, 0.09), mix(cBg, cBg2, 0.4), cText);
    ridgeNear = makeRidge(w + MARGIN * 2, h * 0.26, 31, 260, 0.14, mix(cBg, cBg2, 0.55), cBg.map((v) => Math.round(v * 0.6)), cText);
    // snow: three depths in one typed array
    const area = w * h;
    nFlakes = clamp(Math.round(area / 5200), 60, 300);
    flakes = new Float32Array(nFlakes * 7);
    let d = 0, left = Math.round(nFlakes * DEPTH[0].share);
    for (let i = 0; i < nFlakes; i++) {
      if (i >= left && d < 2) { d++; left += Math.round(nFlakes * DEPTH[d].share); }
      const D = DEPTH[d];
      const o = i * 7;
      flakes[o] = api.rand() * w; flakes[o + 1] = api.rand() * h;
      flakes[o + 2] = D.size[0] + api.rand() * (D.size[1] - D.size[0]);
      flakes[o + 3] = D.speed[0] + api.rand() * (D.speed[1] - D.speed[0]);
      flakes[o + 4] = api.rand() * TAU; flakes[o + 5] = 6 + api.rand() * 22; flakes[o + 6] = d;
    }
    DEPTH.forEach((D) => { D.sprite = softDot(D.core < 0.2 ? 64 : 32, D.core); });
    // stars
    stars = new Float32Array(90 * 4);
    for (let i = 0; i < 90; i++) { stars[i * 4] = api.rand() * w; stars[i * 4 + 1] = Math.pow(api.rand(), 1.4) * h * 0.5; stars[i * 4 + 2] = 0.25 + api.rand() * 0.6; stars[i * 4 + 3] = api.rand() * TAU; }
    ready = true;
  };

  // gradients belong to the context, so they are made on the first frame after a build
  const makeGradients = (ctx, h) => {
    sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, str(cBg));
    sky.addColorStop(0.55, str(mix(cBg, cBg2, 0.8)));
    sky.addColorStop(1, str(mix(cBg2, cBg, 0.4)));
    mist = ctx.createLinearGradient(0, h * 0.62, 0, h * 0.86);
    mist.addColorStop(0, str(cIce, 0));
    mist.addColorStop(0.7, str(mix(cBg2, cIce, 0.18), 0.22));
    mist.addColorStop(1, str(cBg, 0));
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    if (!ready) return; // the engine paints once on resize, before init has built the layers
    if (!sky) makeGradients(ctx, h);
    if (still) { fade = 1; gust = 0; boost = 0.2; farX = farT; nearX = nearT; }
    else {
      fade = Math.min(1, fade + dt / 900);
      gust *= Math.exp(-dt / 800);
      boost = Math.max(0, boost - dt / 1400);
      const k = Math.min(1, dt / 650);
      farX += (farT - farX) * k;
      nearX += (nearT - nearX) * k;
      for (let i = 0; i < 3; i++) { aur[i] += aurSpeed[i] * dt; }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // stars
    ctx.fillStyle = starStyle;
    for (let i = 0; i < 90; i++) {
      const o = i * 4;
      ctx.globalAlpha = stars[o + 2] * (still ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0009 + stars[o + 3])));
      ctx.fillRect(stars[o], stars[o + 1], 1.4, 1.4);
    }

    // aurora: three drifting copies of one curtain, old tint crossing over to the new one
    const aw = auroraB.width * 2;
    const ah = auroraB.height * 2;
    const lift = 1 + boost * 0.35;
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      const breathe = still ? 0.8 : 0.72 + 0.28 * Math.sin(t * 0.00035 + b * 2.1);
      const x = ((aur[b] % aw) + aw) % aw;
      const sc = BAND_SCALE[b];
      const y = BAND_LIFT[b] * ah;
      const a = BAND_ALPHA[b] * breathe * lift;
      if (fade < 1 && auroraA !== auroraB) {
        ctx.globalAlpha = a * (1 - fade);
        ctx.drawImage(auroraA, x - aw, y, aw, ah * sc);
        ctx.drawImage(auroraA, x, y, aw, ah * sc);
      }
      ctx.globalAlpha = a * fade;
      ctx.drawImage(auroraB, x - aw, y, aw, ah * sc);
      ctx.drawImage(auroraB, x, y, aw, ah * sc);
    }
    ctx.globalCompositeOperation = 'source-over';

    // ridges and the mist between them
    ctx.globalAlpha = 1;
    ctx.drawImage(ridgeFar, -MARGIN - farX, h - ridgeFar.height);
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.62, w, h * 0.24);
    ctx.drawImage(ridgeNear, -MARGIN - nearX, h - ridgeNear.height);

    // snow, far to near
    const o2 = still ? 0 : t;
    for (let i = 0; i < nFlakes; i++) {
      const o = i * 7;
      const D = DEPTH[flakes[o + 6]];
      if (!still) {
        flakes[o + 1] += flakes[o + 3] * dt * (1 + Math.abs(gust) * 0.5);
        flakes[o] += (gust * D.wind - 0.012 * D.wind) * dt;
        const s = flakes[o + 2];
        if (flakes[o + 1] > h + s) { flakes[o + 1] = -s; flakes[o] = api.rand() * w; }
        if (flakes[o] > w + s) flakes[o] -= w + 2 * s;
        else if (flakes[o] < -s) flakes[o] += w + 2 * s;
      }
      const s = flakes[o + 2];
      ctx.globalAlpha = D.alpha;
      ctx.drawImage(D.sprite, flakes[o] + Math.sin(o2 * 0.0006 + flakes[o + 4]) * flakes[o + 5] - s / 2, flakes[o + 1] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- art: original line drawings ----------
  const f1 = (v) => Math.round(v * 10) / 10;
  const spark = (x, y, s, cls = 'twinkle') => `<path class="${cls}" d="M${x} ${y - s}L${x + s * 0.18} ${y - s * 0.18}L${x + s} ${y}L${x + s * 0.18} ${y + s * 0.18}L${x} ${y + s}L${x - s * 0.18} ${y + s * 0.18}L${x - s} ${y}L${x - s * 0.18} ${y - s * 0.18}Z" style="fill:currentColor;stroke:none"/>`;

  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
<defs><linearGradient id="sk-h-au" x1="0" x2="1" y1="0" y2="0"><stop offset="0" style="stop-color:var(--acc);stop-opacity:0"/><stop offset=".5" style="stop-color:var(--acc);stop-opacity:.9"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient></defs>
<g class="spin"><circle cx="292" cy="110" r="68" style="stroke:var(--acc)" stroke-width="1" stroke-dasharray="2 9" opacity=".7"/></g>
<g class="spin-r"><circle cx="292" cy="110" r="88" style="stroke:var(--acc)" stroke-width="1" stroke-dasharray="1 14" opacity=".5"/></g>
<circle cx="292" cy="110" r="42" stroke-width="2.5"/>
<path d="M270 84C288 78 308 88 316 108C322 126 312 144 296 150C316 130 308 98 270 84Z" style="fill:currentColor;stroke:none" opacity=".85"/>
<path class="wave" d="M20 74C70 50 120 94 176 66S262 40 332 62" stroke="url(#sk-h-au)" stroke-width="10" opacity=".8"/>
<path class="wave2" d="M10 98C74 78 124 118 190 92S284 74 330 86" stroke="url(#sk-h-au)" stroke-width="5" opacity=".6"/>
${spark(70, 150, 7)}${spark(190, 40, 5)}${spark(350, 200, 5)}${spark(36, 36, 4)}${spark(140, 118, 3.5)}
<path d="M24 316L112 170L146 218L190 140L282 316L282 352L24 352Z" style="fill:var(--bg);stroke:none"/>
<path d="M24 316L112 170L146 218L190 140L282 316" stroke-width="3"/>
<path d="M90 206L100 218L112 204L124 220L138 206M172 172L181 184L190 170L199 188L207 172" style="stroke:var(--acc)" stroke-width="2.4"/>
<path d="M0 346L70 268L104 304L150 254L210 322L268 272L316 326L360 290L400 346L400 372L0 372Z" style="fill:var(--bg);stroke:none"/>
<path d="M0 346L70 268L104 304L150 254L210 322L268 272L316 326L360 290L400 346" stroke-width="3"/>
<path d="M62 280L70 292L78 282M138 270L150 282L160 270M258 288L268 298L280 288" style="stroke:var(--acc)" stroke-width="2"/>
<path d="M0 366H400" opacity=".5"/>
<path d="M84 380H170M214 380H316M120 392H196M236 392H284" style="stroke:var(--acc)" stroke-width="1.5" opacity=".5"/>
<path d="M30 366L40 342L34 342L44 318L38 318L48 292L58 318L52 318L62 342L56 342L66 366ZM356 366L364 346L359 346L367 326L363 326L371 304L379 326L375 326L383 346L378 346L386 366Z" style="fill:var(--bg)" stroke-width="2.4"/>
</svg>`;

  // an interlace ring: two closed strands that cross over and under each other
  const ringPath = (cx, cy, R, a, n, sign, from, to) => {
    let d = '';
    for (let th = from; th <= to + 0.0001; th += 0.02) {
      const r = R + sign * a * Math.sin(n * th);
      d += `${d ? 'L' : 'M'}${f1(cx + r * Math.cos(th))} ${f1(cy + r * Math.sin(th))}`;
    }
    return d;
  };
  const knot = () => {
    const n = 6, R = 62, a = 15;
    const A = ringPath(100, 100, R, a, n, 1, 0, TAU);
    const B = ringPath(100, 100, R, a, n, -1, 0, TAU);
    let seg = '';
    for (let k = 1; k < 2 * n; k += 2) seg += `<path d="${ringPath(100, 100, R, a, n, 1, (k * Math.PI) / n - 0.17, (k * Math.PI) / n + 0.17)}"/>`;
    return { A, B, seg };
  };
  const kn = knot();
  const chapter = `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round">
<g class="spin"><circle cx="100" cy="100" r="95" style="stroke:var(--acc)" stroke-width="1" stroke-dasharray="1 7" opacity=".75"/></g>
<circle cx="100" cy="100" r="88" stroke="currentColor" stroke-width="1" opacity=".55"/>
<circle cx="100" cy="100" r="40" stroke="currentColor" stroke-width="1" opacity=".55"/>
<g class="spin-r"><path d="${kn.A}" stroke="currentColor" stroke-width="5"/>
<path d="${kn.B}" style="stroke:var(--bg)" stroke-width="10"/><path d="${kn.B}" style="stroke:var(--acc)" stroke-width="5"/>
<g style="stroke:var(--bg)" stroke-width="10">${kn.seg}</g><g stroke="currentColor" stroke-width="5">${kn.seg}</g></g>
<path d="M100 4L106 12L100 20L94 12ZM100 180L106 188L100 196L94 188ZM4 100L12 94L20 100L12 106ZM180 100L188 94L196 100L188 106Z" style="fill:var(--a2);stroke:none"/>
</svg>`;

  // standing stones in a ring, seen from the side, under an aurora
  const stones = (() => {
    const list = [];
    for (let k = 0; k < 9; k++) {
      const th = (k / 9) * TAU + 1.22;
      const x = 200 + 150 * Math.cos(th);
      const y = 300 + 40 * Math.sin(th);
      const s = 0.55 + 0.45 * ((Math.sin(th) + 1) / 2);
      const hh = (50 + ((k * 37) % 23)) * s;
      const w = (17 + ((k * 11) % 6)) * s;
      list.push({ x, y, hh, w, s, k });
    }
    return list.sort((p, q) => p.y - q.y).map((p) => {
      const { x, y, hh, w, s, k } = p;
      const lean = ((k % 3) - 1) * 2 * s;
      const d = `M${f1(x - w / 2)} ${f1(y)}L${f1(x - w * 0.42 + lean)} ${f1(y - hh)}L${f1(x - w * 0.1 + lean)} ${f1(y - hh - 6 * s)}L${f1(x + w * 0.32 + lean)} ${f1(y - hh - 2 * s)}L${f1(x + w * 0.44 + lean)} ${f1(y - hh + 3 * s)}L${f1(x + w / 2)} ${f1(y)}Z`;
      return `<path d="${d}" style="fill:var(--bg)" stroke="currentColor" stroke-width="${f1(2.4 * s)}"/>`;
    }).join('');
  })();
  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
<defs><linearGradient id="sk-c-au" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--acc);stop-opacity:0"/><stop offset=".5" style="stop-color:var(--acc);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient></defs>
<path class="wave" d="M30 168C70 70 130 44 186 78C236 108 276 36 340 70C362 82 372 100 380 128C340 112 320 150 270 136C220 122 190 190 130 160C90 140 60 190 30 168Z" style="fill:url(#sk-c-au);stroke:none"/>
<path class="wave2" d="M60 120C110 40 170 52 214 28C256 6 310 38 360 76C320 62 280 66 224 78C170 90 110 78 60 120Z" style="fill:url(#sk-c-au);stroke:none" opacity=".75"/>
<path class="wave" d="M34 166C74 84 124 66 176 96C226 124 270 50 336 84C358 96 370 110 378 128" style="stroke:var(--acc)" stroke-width="2" opacity=".9"/>
${spark(48, 40, 6)}${spark(330, 28, 5)}${spark(220, 14, 3.5)}${spark(372, 150, 4)}${spark(110, 12, 3)}
<ellipse cx="200" cy="302" rx="168" ry="48" opacity=".35"/>
<ellipse cx="200" cy="302" rx="120" ry="32" opacity=".2"/>
${stones}
<path class="flame" d="M200 318C186 306 190 290 200 276C204 288 216 292 214 306C212 314 206 318 200 318Z" style="fill:var(--a2);stroke:var(--a2)" stroke-width="1.5"/>
<path d="M0 372H400" opacity=".4"/>
</svg>`;

  const braid = () => {
    let a = '', b = '';
    for (let x = 250; x <= 350.01; x += 2) {
      const y = 8 * Math.sin(((x - 250) / 100) * TAU * 2);
      a += `${a ? 'L' : 'M'}${x} ${f1(20 + y)}`;
      b += `${b ? 'L' : 'M'}${x} ${f1(20 - y)}`;
    }
    const over = [275, 325].map((cx) => { let s = ''; for (let x = cx - 9; x <= cx + 9.01; x += 2) s += `${s ? 'L' : 'M'}${x} ${f1(20 + 8 * Math.sin(((x - 250) / 100) * TAU * 2))}`; return s; });
    return { a, b, over };
  };
  const br = braid();
  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke-linecap="round" stroke-linejoin="round">
<defs><linearGradient id="sk-d-fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" style="stop-color:var(--acc);stop-opacity:0"/><stop offset=".3" style="stop-color:var(--acc)"/><stop offset=".7" style="stop-color:var(--acc)"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient></defs>
<path d="M0 20H238M362 20H600" stroke="url(#sk-d-fade)" stroke-width="1.5"/>
<path d="M238 20L246 14L254 20L246 26ZM346 20L354 14L362 20L354 26Z" style="fill:var(--a2);stroke:none"/>
<path d="${br.a}" stroke="currentColor" stroke-width="3"/>
<path d="${br.b}" style="stroke:var(--bg)" stroke-width="7"/><path d="${br.b}" style="stroke:var(--acc)" stroke-width="3"/>
${br.over.map((d) => `<path d="${d}" style="stroke:var(--bg)" stroke-width="7"/><path d="${d}" stroke="currentColor" stroke-width="3"/>`).join('')}
</svg>`;

  Deck.registerTheme({
    name: 'skyrim',
    defaultTransition: 'frost',
    vocabulary: {
      map: 'The journal', mapHint: 'Choose an entry to read it. Esc closes the journal.', counter: 'Entry {n} of {N}', backupCounter: 'Appendix {L}', section: 'Region:',
      now: 'Reading now', next: 'Next entry', notes: 'Marginalia', timer: 'Time on the road', presenter: 'The skald’s lectern',
      rotate: 'Turn your device sideways to read the journal.',
      hint: '← → travel · M journal · P lectern · F full screen · ? keys',
      ambient: 'Snowfall', help: 'A traveller’s keys', helpClose: 'Esc or ? closes.', jump: 'Fast travel to',
      keyMove: 'Travel on, travel back', keyMap: 'Open the journal', keyPresenter: 'The skald’s lectern', keyFull: 'Full screen', keyBlackout: 'Sleep (blackout)',
      keyAmbient: 'Pause or resume the snowfall and the aurora', keyJump: 'Fast travel: G, a number, Enter', keyHelp: 'This list',
    },
    art: { hero, chapter, closing, divider },
    ambient: {
      init(api) { tint = rgb(api.accent(), tint); build(api); },
      resize(api) { if (ready) build(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { draw(api, 0, 0, true); },
      change(api, info) {
        if (!ready || info.from < 0) return;
        const next = rgb(api.accent(), tint);
        if (next.join(',') !== tintKey) {
          const old = auroraA; auroraA = auroraB; auroraB = old; // the finished curtain fades out while the new one fades in
          tint = next;
          tintKey = next.join(',');
          paintAurora(auroraB, tint);
          fade = 0;
        }
        const dir = info.dir === 'back' ? -1 : 1;
        gust = -dir * 0.55; // a gust sweeps the snow against the direction of travel
        boost = 1;
        // the ridges drift a little with the travel and turn round at the edge of their margin
        const lim = MARGIN * 0.9;
        let nf = farT + dir * stepSign * 26;
        if (Math.abs(nf) > lim) { stepSign = -stepSign; nf = farT + dir * stepSign * 26; }
        farT = nf;
        nearT = clamp(nearT + dir * stepSign * 64, -lim, lim);
      },
    },
  });
})();
