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
  const dust = (x, y, r = 1.6) => `<circle class="twinkle" cx="${x}" cy="${y}" r="${r}" style="fill:currentColor;stroke:none"/>`;
  const mirror = ([x, y]) => [400 - x, y];

  // ----- runes: an angular script of 12 letters of my own, each a few straight strokes on a 12 by 20 grid; a word is a cluster of runes with its transliteration under it -----
  const RUNE = {
    F: 'M3 19V1L10 6M3 9L9 12', R: 'M3 19V1H9L11 4L9 8H3M7 8L11 19', O: 'M6 1L11 10L6 19L1 10ZM6 7V13', S: 'M10 2L3 6L9 10L3 14L10 18',
    T: 'M1 4H11M6 4V19M2 13L6 19L10 13', E: 'M9 1L3 5V15L9 19M3 10H9', M: 'M1 19V3L6 11L11 3V19', B: 'M3 1V19M3 3L9 6L3 10L10 14L3 18',
    D: 'M10 1V19M10 4L3 10L10 16', A: 'M1 19L6 1L11 19M6 9V19', W: 'M1 2L3 18L6 8L9 18L11 2', N: 'M2 19V2L10 18V2',
  };
  const runeWord = (word, cx, top, k) => {
    const adv = 16 * k;
    const x0 = cx - ((word.length - 1) * adv + 12 * k) / 2;
    const glyphs = [...word].map((ch, i) => `<path d="${RUNE[ch]}" transform="translate(${f1(x0 + i * adv)} ${top}) scale(${k})"/>`).join('');
    return `<g stroke-width="${f1(2.2 / k)}" stroke-linecap="square" stroke-linejoin="miter">${glyphs}</g><text x="${cx}" y="${f1(top + 20 * k + 17)}" text-anchor="middle" style="font:500 10.5px var(--f-body);letter-spacing:.3em;fill:currentColor;stroke:none" opacity=".8">${word}</text>`;
  };
  const WORDS = ['FROST', 'EMBER', 'DAWN'];
  const runeRow = (cx, top, k, gap) => {
    const wd = WORDS.map((w) => ((w.length - 1) * 16 + 12) * k);
    let x = cx - (wd.reduce((a, b) => a + b, 0) + gap * (WORDS.length - 1)) / 2;
    return WORDS.map((w, i) => { const c = x + wd[i] / 2; x += wd[i] + gap; return runeWord(w, f1(c), top, k); }).join('');
  };

  // ----- the horned iron helmet as a constellation: stars joined by thin lines, drawn from the left half and mirrored -----
  const helmet = (() => {
    const N = {
      top: [200, 56], d1: [156, 68], d2: [122, 100], bi: [114, 132], d3: [109, 152], bo: [108, 172], d4: [107, 194], cr1: [200, 106], cr2: [200, 156],
      ho1: [72, 164], ho2: [44, 138], ho3: [34, 100], ho4: [44, 62], tip: [64, 30], hi1: [92, 132], hi2: [68, 112], hi3: [60, 84], hi4: [64, 54],
      b1: [152, 201], b2: [200, 206], n1: [194, 240], nt: [200, 266], e1: [140, 216], e2: [180, 220], e3: [172, 236], e4: [145, 232],
      c1: [115, 232], c2: [128, 270], c3: [156, 296], ch: [200, 310], j1: [174, 284],
    };
    const E = [['top', 'd1'], ['top', 'cr1'], ['cr1', 'cr2'], ['cr2', 'b2'], ['d1', 'd2'], ['d2', 'bi'], ['bi', 'd3'], ['d3', 'bo'], ['bo', 'd4'],
      ['bo', 'ho1'], ['ho1', 'ho2'], ['ho2', 'ho3'], ['ho3', 'ho4'], ['ho4', 'tip'], ['bi', 'hi1'], ['hi1', 'hi2'], ['hi2', 'hi3'], ['hi3', 'hi4'], ['hi4', 'tip'],
      ['d4', 'b1'], ['b1', 'b2'], ['d4', 'c1'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'ch'], ['e1', 'e2'], ['e2', 'e3'], ['e3', 'e4'], ['e4', 'e1'],
      ['b2', 'n1'], ['n1', 'nt'], ['nt', 'j1'], ['j1', 'ch']];
    const mid = new Set(['top', 'cr1', 'cr2', 'b2', 'nt', 'ch']);
    const at = (k, side) => (side && !mid.has(k) ? mirror(N[k]) : N[k]);
    const lines = [0, 1].flatMap((side) => E.map(([a, b]) => `M${at(a, side).join(' ')}L${at(b, side).join(' ')}`)).join('');
    const big = new Set(['top', 'tip', 'ch', 'nt', 'd4', 'ho3']);
    const stars = Object.keys(N).flatMap((k) => [0, 1].map((side) => [k, side]).filter(([kk, s]) => !(s && mid.has(kk)))
      .map(([kk, s]) => { const [x, y] = at(kk, s); return big.has(kk) ? spark(x, y, kk === 'top' || kk === 'ch' ? 8 : 6.5) : dust(x, y, 2.1); })).join('');
    return `<path d="${lines}" stroke="currentColor" stroke-width="1.3" opacity=".85"/>${stars}`;
  })();
  const hero = `<svg viewBox="0 0 400 450" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
<g class="spin"><circle cx="200" cy="190" r="178" style="stroke:var(--acc)" stroke-width="1" stroke-dasharray="1 11" opacity=".55"/></g>
${helmet}
${dust(30, 214)}${dust(372, 238)}${dust(76, 326, 1.4)}${dust(326, 332, 1.4)}${dust(200, 24, 1.4)}${dust(122, 38, 1.4)}${dust(284, 36, 1.4)}${dust(352, 120)}${dust(18, 166, 1.4)}${dust(380, 176, 1.4)}${spark(368, 300, 4)}${spark(36, 280, 3.5)}
<path d="M70 366H330" stroke-width="1" style="stroke:var(--frame-2)"/>
${runeRow(200, 380, 1.15, 34)}
</svg>`;

  // ----- the compass star: long thin needles with a knot in the middle -----
  const knotParts = (() => {
    const ring = (cx, cy, R, a, n, sign, from, to) => {
      let d = '';
      for (let th = from; th <= to + 0.0001; th += 0.02) {
        const r = R + sign * a * Math.sin(n * th);
        d += `${d ? 'L' : 'M'}${f1(cx + r * Math.cos(th))} ${f1(cy + r * Math.sin(th))}`;
      }
      return d;
    };
    const n = 6, R = 62, a = 15;
    let seg = '';
    for (let k = 1; k < 2 * n; k += 2) seg += `<path d="${ring(100, 100, R, a, n, 1, (k * Math.PI) / n - 0.17, (k * Math.PI) / n + 0.17)}"/>`;
    return { A: ring(100, 100, R, a, n, 1, 0, TAU), B: ring(100, 100, R, a, n, -1, 0, TAU), seg };
  })();
  // two closed strands that cross over and under each other, drawn at the origin, size s (radius of the ring in px)
  const knot = (s, sw) => {
    const k = s / 77, w = f1(sw / k);
    return `<g transform="scale(${f1(k * 1000) / 1000}) translate(-100 -100)"><path d="${knotParts.A}" stroke="currentColor" stroke-width="${w}"/>
<path d="${knotParts.B}" style="stroke:var(--bg)" stroke-width="${f1(w * 2)}"/><path d="${knotParts.B}" stroke="currentColor" stroke-width="${w}"/>
<g style="stroke:var(--bg)" stroke-width="${f1(w * 2)}">${knotParts.seg}</g><g stroke="currentColor" stroke-width="${w}">${knotParts.seg}</g></g>`;
  };
  const compass = (W, H, ax, ay, waist, ring, cls) => {
    const cx = W / 2, cy = H / 2;
    const star = (k) => `M${cx} ${cy - ay * k}L${cx + waist * k} ${cy - waist * k}L${cx + ax * k} ${cy}L${cx + waist * k} ${cy + waist * k}L${cx} ${cy + ay * k}L${cx - waist * k} ${cy + waist * k}L${cx - ax * k} ${cy}L${cx - waist * k} ${cy - waist * k}Z`;
    return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
<path d="${star(1)}" stroke-width="1.3"/><path d="${star(0.8)}" stroke-width="1" opacity=".5"/>
<circle cx="${cx}" cy="${cy}" r="${f1(ring * 1.5)}" style="fill:var(--bg)" stroke-width="1"/>
<g transform="translate(${cx} ${cy})">${knot(ring, Math.max(1, ring / 11))}</g>
${[[0, -ay], [ax, 0], [0, ay], [-ax, 0]].map(([x, y]) => `<circle cx="${cx + x}" cy="${cy + y}" r="2.6" style="fill:currentColor;stroke:none"/>`).join('')}
</svg>`;
  };
  const compassMap = compass(520, 130, 250, 58, 7, 19, 'compass');
  const chapter = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
<g class="spin"><circle cx="200" cy="200" r="150" style="stroke:var(--acc)" stroke-width="1" stroke-dasharray="1 10" opacity=".55"/></g>
<circle cx="200" cy="200" r="104" stroke-width="1" opacity=".35"/>
<path d="M200 6L214 186L394 200L214 214L200 394L186 214L6 200L186 186Z" stroke-width="1.5"/>
<path d="M200 56L210 190L344 200L210 210L200 344L190 210L56 200L190 190Z" stroke-width="1" opacity=".5"/>
<circle cx="200" cy="200" r="52" style="fill:var(--bg)" stroke-width="1"/>
<g class="spin-r"><g transform="translate(200 200)">${knot(36, 3)}</g></g>
${spark(200, 6, 7)}${spark(394, 200, 7)}${spark(200, 394, 7)}${spark(6, 200, 7)}${dust(112, 112)}${dust(288, 112)}${dust(112, 288)}${dust(288, 288)}${spark(330, 70, 4)}${spark(70, 330, 4)}
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
      return `<path d="${d}" style="fill:var(--bg)" stroke="currentColor" stroke-width="${f1(1.8 * s)}"/>`;
    }).join('');
  })();
  // an aurora curtain: thin rays of different lengths along a wave
  const rays = (() => {
    let d = '';
    for (let x = 36; x <= 364; x += 7) {
      const y0 = 78 + 26 * Math.sin(x / 38) + 10 * Math.sin(x / 15);
      d += `M${x} ${f1(y0)}V${f1(y0 + 46 + 30 * Math.sin(x / 21 + 1))}`;
    }
    return `<path class="wave" d="${d}" style="stroke:var(--acc)" stroke-width="1.3" opacity=".55"/><path class="wave2" d="${d.replace(/M(\d+)/g, (m, x) => `M${+x + 3}`)}" style="stroke:var(--acc)" stroke-width="1" opacity=".3"/>`;
  })();
  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
${rays}
${spark(48, 40, 6)}${spark(330, 28, 5)}${spark(220, 14, 3.5)}${spark(372, 150, 4)}${spark(110, 12, 3)}
<ellipse cx="200" cy="302" rx="168" ry="48" opacity=".3"/>
<ellipse cx="200" cy="302" rx="120" ry="32" opacity=".18"/>
${stones}
<path class="flame" d="M200 318C186 306 190 290 200 276C204 288 216 292 214 306C212 314 206 318 200 318Z" style="fill:var(--a2);stroke:var(--a2)" stroke-width="1.2"/>
<path d="M0 372H400" opacity=".35"/>
</svg>`;

  // divider: a hairline, a diamond at each end, and a row of runes with their transliteration
  const divider = `<svg viewBox="0 0 640 76" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
<path d="M0 19H118M522 19H640" style="stroke:var(--frame)" stroke-width="1"/>
<path d="M118 19L126 13L134 19L126 25ZM506 19L514 13L522 19L514 25Z" stroke-width="1"/>
${runeRow(320, 8, 1.1, 38)}
</svg>`;

  // the button hints at the bottom left, the compass letters and the compass in the map are built after boot, from the vocabulary
  const vocabulary = {
    map: 'Map', mapHint: 'Choose a place to travel to. Esc closes the map.', counter: 'Stop {n} of {N}', backupCounter: 'Side road {L}', section: 'Region:',
    now: 'Reading now', next: 'Next stop', notes: 'Marginalia', timer: 'Time on the road', presenter: 'The skald’s lectern',
    rotate: 'Turn your device sideways to read the map.',
    hint: '← → Turn · M Map · P Lectern · F Full screen · ? Keys',
    ambient: 'Snowfall', help: 'A traveller’s keys', helpClose: 'Esc or ? closes.', jump: 'Fast travel to',
    keyMove: 'Travel on, travel back', keyMap: 'Open the map', keyPresenter: 'The skald’s lectern', keyFull: 'Full screen', keyBlackout: 'Sleep (blackout)',
    keyAmbient: 'Pause or resume the snowfall and the aurora', keyJump: 'Fast travel: G, a number, Enter', keyHelp: 'This list',
    btnMove: 'Turn', btnMap: 'Map', btnHelp: 'Keys',
  };
  Deck.ready.then(() => {
    const V = Object.assign({}, vocabulary, Deck.config && Deck.config.vocabulary);
    const chrome = document.getElementById('chrome');
    const map = document.getElementById('map');
    if (chrome && !document.getElementById('keys')) {
      const keys = document.createElement('div');
      keys.id = 'keys';
      [['←→', V.btnMove], ['M', V.btnMap], ['?', V.btnHelp]].forEach(([k, word]) => {
        const s = document.createElement('span');
        s.className = 'key';
        s.dataset.k = k;
        s.textContent = word;
        keys.append(s);
      });
      chrome.append(keys);
    }
    // the compass: a letter at the start of every section, and the strip slides so that the current slide is under the middle
    const track = document.getElementById('track');
    if (track) {
      const info = Deck.info();
      const names = new Map(info.sections.map((sec) => [sec.id, sec.label]));
      track.querySelectorAll('.seg').forEach((seg) => {
        const first = info.slides[+seg.querySelector('.dot').dataset.i];
        seg.dataset.l = Array.from((first.backup ? 'Backup' : names.get(first.sec)) || '')[0] || '';
      });
      const center = (index, instant) => {
        const dot = track.querySelector(`.dot[data-i="${index}"]`);
        if (!dot) return;
        const d = dot.getBoundingClientRect(), t = track.getBoundingClientRect();
        if (instant) track.style.scrollBehavior = 'auto';
        track.scrollLeft += d.left + d.width / 2 - (t.left + t.width / 2);
        track.style.scrollBehavior = '';
      };
      center(Deck.index, true);
      document.addEventListener('deck:change', (e) => center(e.detail.index, e.detail.transition === 'none'));
      addEventListener('resize', () => center(Deck.index, true));
    }
    if (map) {
      // the map is rebuilt on every open: put the compass star back above its title
      const star = () => { const head = map.querySelector('.map-head'); if (head && !head.querySelector('.compass')) head.insertAdjacentHTML('afterbegin', compassMap); };
      new MutationObserver(star).observe(map, { childList: true });
      star();
    }
  }, () => {}); // a boot error is reported by the engine

  Deck.registerTheme({
    name: 'skyrim',
    defaultTransition: 'frost',
    vocabulary,
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
