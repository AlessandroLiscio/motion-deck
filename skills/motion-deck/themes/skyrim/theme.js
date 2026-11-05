/* Skyrim theme: an adventurer's road. The regions of a deck walk from snowy mountains (blue) through a misty rain forest (green) to a burning canyon (red). Each region has its own sky, land drawn in plain lines and weather, and the compass, the kickers and the ticks take its color. A gust sweeps the weather on every slide change. Original line art; an unofficial homage, nothing here comes from the game. */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
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
  // a small deterministic generator, so the land keeps its shape on every resize
  const prng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- the road: the first region is in the snow, the last in the canyon, the ones between in the rain forest ----------
  const STOPS = [[126, 200, 240], [82, 214, 160], [229, 84, 75]]; // sky blue, jade, ember red
  const toHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
  };
  const fromHsl = ([h, s, l]) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
  };
  const HSL = STOPS.map(toHsl);
  // the color at a place p (0 to 1) of the road: the hue walks from blue through green and yellow to red
  const journeyColor = (p) => {
    const k = clamp(p, 0, 1) * 2, i = Math.min(1, Math.floor(k)), t = k - i, a = HSL[i], b = HSL[i + 1];
    return fromHsl([0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * t));
  };
  const biomeAt = (p) => (p < 0.25 ? 0 : p <= 0.75 ? 1 : 2); // 0 snow, 1 rain forest, 2 canyon
  const road = { of: [], color: [], biome: [] }; // of[slide index] = region index
  const mapRoad = () => {
    const info = Deck.info();
    const ids = info.sections.map((s) => s.id).filter((id) => info.slides.some((s) => s.sec === id && !s.backup));
    const place = (i) => (ids.length > 1 ? i / (ids.length - 1) : 0);
    road.color = ids.map((_, i) => journeyColor(place(i)));
    road.biome = ids.map((_, i) => biomeAt(place(i)));
    road.of = [];
    info.slides.forEach((s, i) => { const k = ids.indexOf(s.sec); road.of.push(k < 0 ? road.of[i - 1] || 0 : k); }); // a slide that belongs to no region (a backup slide) stays where the road already is
    return road;
  };

  // ---------- state ----------
  let cBg = [11, 16, 22], cBg2 = [19, 29, 41], cText = [238, 243, 248];
  let tint = STOPS[0], tintC = STOPS[0].slice(), tintKey = ''; // the color of the region, and the color the sky has eased to
  let scene = 0, blend = 1; // the biome on show, and how far it has faded in over the picture of the one that left
  let snap = null, hasSnap = false;
  let W = 0, H = 0, starStyle = '#fff';
  let stars = new Float32Array(0);
  const aur = [0, 0, 0], aurSpeed = [0.006, -0.0045, 0.0034];
  let farX = 0, farT = 0, nearX = 0, nearT = 0, stepSign = 1;
  let gust = 0, boost = 0;
  let ready = false;
  const MARGIN = 160;
  const SC = [{}, {}, {}]; // per biome: built, feat {a, b, fade}, layers, weather

  // ---------- sprites ----------
  const paintAurora = (c, col) => {
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const u = (x / w) * TAU;
      const body = 0.52 + 0.3 * Math.sin(u * 2 + 0.7) + 0.2 * Math.sin(u * 5 + 2.1) + 0.1 * Math.sin(u * 9 + 4.2) - 0.08;
      const ray = 0.8 + 0.2 * Math.sin(u * 41 + 1.3) * Math.sin(u * 23 + 0.4);
      const a = clamp(body, 0, 1) * ray;
      if (a < 0.04) continue;
      const hh = h * (0.5 + 0.46 * (0.5 + 0.5 * Math.sin(u * 3 + 1.9)));
      const grd = g.createLinearGradient(0, 0, 0, hh);
      grd.addColorStop(0, str(col, 0));
      grd.addColorStop(0.3, str(col, 0.4 * a));
      grd.addColorStop(0.55, str(col, 0.2 * a));
      grd.addColorStop(1, str(col, 0));
      g.fillStyle = grd;
      g.fillRect(x, 0, 1, hh);
    }
  };

  // value noise that wraps along x, so a sprite of clouds can drift sideways for ever
  const lat = (G, x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % G.nx) + G.nx) % G.nx, x1 = (x0 + 1) % G.nx, y0 = clamp(yi, 0, G.ny - 1), y1 = clamp(yi + 1, 0, G.ny - 1);
    const a = G.d[y0 * G.nx + x0], b = G.d[y0 * G.nx + x1], c = G.d[y1 * G.nx + x0], d = G.d[y1 * G.nx + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const paintClouds = (c, col, o) => {
    const g = c.getContext('2d'), w = c.width, h = c.height, rnd = prng(o.seed);
    const grids = [0, 1, 2, 3].map((k) => { const nx = o.cells * 2 ** k, ny = o.rows * 2 ** k; return { nx, ny, d: Float32Array.from({ length: nx * ny }, rnd) }; });
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const fy = y / h, env = o.shape(fy);
      for (let x = 0; x < w; x++) {
        let v = 0, amp = 1, sum = 0;
        for (let k = 0; k < 4; k++) { v += lat(grids[k], (x / w) * grids[k].nx, fy * grids[k].ny) * amp; sum += amp; amp *= 0.5; }
        const i = (y * w + x) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
        img.data[i + 3] = Math.round(255 * sstep(o.lo, o.hi, v / sum) * env * o.alpha);
      }
    }
    g.putImageData(img, 0, 0);
  };

  // ---------- land: one silhouette per layer on a sprite a little wider than the screen, a pale thin line along its edge ----------
  const noise1 = (seed, scale, ridged) => {
    const rnd = prng(seed);
    const tbl = Float32Array.from({ length: 256 }, rnd);
    const at = (x) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return tbl[i & 255] + (tbl[(i + 1) & 255] - tbl[i & 255]) * s; };
    return (x) => {
      let v = 0, amp = 1, sum = 0, fr = 1 / scale;
      for (let o = 0; o < 3; o++) { const n = at(x * fr + o * 17.3); v += (ridged ? 1 - Math.abs(n * 2 - 1) : n) * amp; sum += amp; amp *= 0.42; fr *= 2.3; }
      return v / sum;
    };
  };
  const fillLand = (c, pts, top, bot, edgeA) => {
    const g = c.getContext('2d');
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
    g.strokeStyle = str(cText, edgeA);
    g.lineWidth = 1.5;
    g.stroke();
    return g;
  };
  // peaks (snow) and rolling hills
  const makeRidge = (w, h, seed, scale, floor, top, bot, ridged = true, edgeA = 0.22) => {
    const height = noise1(seed, scale, ridged);
    const c = cv(w, h);
    const pts = [];
    for (let x = 0; x <= c.width + 8; x += 8) pts.push([x, c.height * (1 - (floor + (1 - floor) * Math.pow(height(x), ridged ? 1.5 : 1.15)))]);
    fillLand(c, pts, top, bot, edgeA);
    return c;
  };
  // a canopy: a ridge of round crowns, and a few tall trees that stand out of it
  const makeCanopy = (w, h, seed, floor, rad, fill, trees) => {
    const rnd = prng(seed), height = noise1(seed + 3, 420, false);
    const c = cv(w, h), g = c.getContext('2d');
    const base = (x) => c.height * (1 - (floor + (1 - floor) * 0.7 * height(x)));
    const crowns = [];
    for (let x = -rad[1]; x < c.width + rad[1]; x += 7 + rnd() * 13) { const r = rad[0] + rnd() * (rad[1] - rad[0]); crowns.push([x, base(x) + rnd() * 8 - 2, r]); }
    const tall = [];
    for (let x = 60 + rnd() * 120; x < c.width - 40; x += 150 + rnd() * 260) if (rnd() < trees) tall.push([x, base(x), 0.3 + rnd() * 0.5, 34 + rnd() * 30]);
    g.lineWidth = 3;
    g.strokeStyle = str(cText, 0.2);
    g.fillStyle = str(fill[1]);
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, str(fill[0]));
    grd.addColorStop(1, str(fill[1]));
    const trunk = (x, y0, hh, k) => { g.beginPath(); g.moveTo(x - 5 * k, y0 + 6); g.lineTo(x - 2 * k, y0 - hh); g.lineTo(x + 2 * k, y0 - hh); g.lineTo(x + 5 * k, y0 + 6); g.closePath(); };
    const crownOf = (x, y, rx) => { g.beginPath(); [[-0.74, 0.06, 0.3], [-0.4, 0.16, 0.3], [-0.38, -0.12, 0.4], [0, -0.2, 0.46], [0.4, -0.1, 0.4], [0.44, 0.18, 0.3], [0.78, 0.04, 0.3], [-0.2, -0.5, 0.32], [0.22, -0.46, 0.34]].forEach(([dx, dy, r]) => { g.moveTo(x + (dx + r) * rx, y + dy * rx); g.arc(x + dx * rx, y + dy * rx, r * rx, 0, TAU); }); };
    // the edge first (a thick line), the fill over it leaves a thin line on the outside only
    crowns.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); });
    const limbs = (x, y, rx) => { g.beginPath(); g.moveTo(x, y + rx * 0.05); g.lineTo(x - rx * 0.5, y - rx * 0.02); g.moveTo(x, y + rx * 0.05); g.lineTo(x + rx * 0.5, y - rx * 0.02); };
    const grow = ([x, y, k, rx]) => Math.max(0, Math.min(c.height * k, y - rx * 0.75 - 4));
    tall.forEach((t) => { const hh = grow(t); trunk(t[0], t[1], hh, 1.6); g.stroke(); crownOf(t[0], t[1] - hh, t[3]); g.stroke(); });
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, c.height);
    for (let x = 0; x <= c.width + 8; x += 8) g.lineTo(x, base(x));
    g.lineTo(c.width, c.height);
    g.closePath();
    g.fill();
    crowns.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 4.5;
    tall.forEach((t) => { const hh = grow(t); trunk(t[0], t[1], hh, 1.6); g.fill(); crownOf(t[0], t[1] - hh, t[3]); g.fill(); limbs(t[0], t[1] - hh, t[3]); g.stroke(); });
    return c;
  };
  // flat-topped mesas with steep stepped sides, and the same strata across all of them
  const makeMesas = (w, h, seed, lo, hi, top, bot, strata, jag) => {
    const rnd = prng(seed);
    const c = cv(w, h);
    const pts = [];
    let x = -50, y = c.height * (1 - (lo + rnd() * (hi - lo)));
    pts.push([x, y]);
    while (x < c.width + 60) {
      const pw = jag ? 14 + rnd() * 60 : 60 + rnd() * 200;
      pts.push([x + pw * 0.45, y - rnd() * (jag ? 10 : 3)], [x + pw, y + (rnd() - 0.5) * (jag ? 8 : 3)]);
      x += pw;
      const ny = c.height * (1 - (lo + rnd() * (hi - lo))), run = (jag ? 6 : 10) + rnd() * 20;
      pts.push([x + run * 0.2, y + (ny - y) * 0.3], [x + run * 0.55, y + (ny - y) * 0.62], [x + run, ny]);
      x += run;
      y = ny;
    }
    const g = fillLand(c, pts, top, bot, 0.26);
    g.save();
    g.beginPath();
    g.moveTo(0, c.height);
    pts.forEach((p) => g.lineTo(p[0], p[1]));
    g.lineTo(c.width, c.height);
    g.closePath();
    g.clip();
    g.strokeStyle = str(cText, 0.1);
    g.lineWidth = 1;
    for (let k = 1; k <= strata; k++) { const yy = Math.round(c.height * (k / (strata + 1)) * 1.1 + 4) + 0.5; g.beginPath(); g.moveTo(0, yy); g.lineTo(c.width, yy); g.stroke(); }
    g.restore();
    return c;
  };

  const glow = (size, col, core) => {
    const c = cv(size, size);
    const g = c.getContext('2d');
    const r = size / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, str(col, 1));
    gr.addColorStop(core, str(col, 0.85));
    gr.addColorStop(1, str(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  };

  // ---------- the three biomes ----------
  // each has: sky(t) stops of the sky for a color t; stars; feat (the moving stuff in the sky); make(w, h) the land layers; weather
  const DEPTH = [
    { sprite: null, core: 0.45, size: [2.5, 5], speed: [0.016, 0.028], wind: 0.35, alpha: 0.7, share: 0.58 },
    { sprite: null, core: 0.3, size: [6, 11], speed: [0.03, 0.05], wind: 0.75, alpha: 0.55, share: 0.30 },
    { sprite: null, core: 0.1, size: [18, 34], speed: [0.06, 0.09], wind: 1.5, alpha: 0.15, share: 0.12 },
  ];
  const BANDS = [{ s: 1, lift: 0, a: 0.8 }, { s: 0.78, lift: 0.1, a: 0.55 }, { s: 1.18, lift: -0.12, a: 0.45 }];
  const CLOUD_BANDS = [{ s: 1, lift: 0, a: 0.65 }, { s: 0.8, lift: 0.14, a: 0.5 }];
  const BIOME = [
    { // snow: aurora over two ridges and falling snow
      sky: () => [[0, cBg], [0.55, mix(cBg, cBg2, 0.8)], [1, mix(cBg2, cBg, 0.4)]],
      stars: [90, 0.5, 1],
      feat: { w: (w) => Math.ceil(w / 2), h: (h) => Math.ceil(h * 0.22), scale: 2, bands: BANDS, paint: paintAurora },
      make: (w, h) => [
        { c: makeRidge(w + MARGIN * 2, h * 0.4, 7, 380, 0.2, mix(cBg2, STOPS[0], 0.09), mix(cBg, cBg2, 0.4)), par: 0, mist: [0.62, 0.86, 0.22, 0] },
        { c: makeRidge(w + MARGIN * 2, h * 0.26, 31, 260, 0.14, mix(cBg, cBg2, 0.55), cBg.map((v) => Math.round(v * 0.6))), par: 2 },
      ],
    },
    { // rain forest: green clouds, rolling hills, two canopies under a drifting mist, fireflies and a light rain
      sky: (t) => [[0, mix(cBg, t, 0.1)], [0.5, mix(cBg2, t, 0.15)], [1, mix(cBg2, t, 0.27)]],
      stars: [40, 0.36, 0.55],
      feat: { w: () => 288, h: () => 112, scale: 0, bands: CLOUD_BANDS, paint: (c, t) => paintClouds(c, mix(t, [230, 255, 235], 0.25), { seed: 5, cells: 5, rows: 3, lo: 0.46, hi: 0.8, alpha: 0.4, shape: (f) => Math.sin(Math.PI * f) ** 1.4 }) },
      make: (w, h) => [
        { c: makeRidge(w + MARGIN * 2, h * 0.4, 13, 460, 0.3, [46, 100, 88], [14, 34, 32], false, 0.24), par: 0, mist: [0.42, 0.74, 0.5, 1] },
        { c: makeCanopy(w + MARGIN * 2, h * 0.3, 29, 0.36, [14, 30], [[20, 56, 50], [9, 24, 24]], 0), par: 1, mist: [0.58, 0.88, 0.5, -1] },
        { c: makeCanopy(w + MARGIN * 2, h * 0.36, 53, 0.3, [20, 40], [[9, 30, 27], [5, 14, 15]], 0.9), par: 2, mist: [0.8, 1, 0.3, -1] },
      ],
    },
    { // canyon: smoke, a low sun, three depths of mesas, heat and embers
      sky: (t) => [[0, mix(cBg, t, 0.12)], [0.5, mix(cBg2, t, 0.34)], [1, mix(mix(cBg2, t, 0.75), [255, 140, 60], 0.42)]],
      stars: [34, 0.3, 0.5],
      feat: { w: () => 288, h: () => 112, scale: 0, bands: CLOUD_BANDS, paint: (c, t) => paintClouds(c, mix(t, [255, 170, 90], 0.35), { seed: 9, cells: 4, rows: 3, lo: 0.42, hi: 0.78, alpha: 0.5, shape: (f) => Math.sin(Math.PI * f) ** 1.2 }) },
      make: (w, h) => [
        { c: makeMesas(w + MARGIN * 2, h * 0.4, 17, 0.22, 0.66, [160, 74, 50], [64, 26, 24], 5, false), par: 0, mist: [0.5, 0.78, 0.42, 2] },
        { c: makeMesas(w + MARGIN * 2, h * 0.3, 41, 0.18, 0.7, [100, 42, 34], [38, 15, 17], 4, false), par: 1 },
        { c: makeMesas(w + MARGIN * 2, h * 0.2, 67, 0.2, 0.82, [44, 17, 17], [16, 7, 9], 2, true), par: 2 },
      ],
    },
  ];

  // the weather of each biome: arrays of particles in typed arrays, x y size speed phase sway depth
  const sprites = { fly: null, ember: null };
  const paintSprites = () => {
    DEPTH.forEach((D) => { D.sprite = glow(D.core < 0.2 ? 64 : 32, cText, D.core); });
    sprites.fly = glow(32, mix(tint, [235, 255, 150], 0.55), 0.25);
    sprites.ember = glow(32, mix(tint, [255, 190, 90], 0.6), 0.2);
  };
  const seedWeather = (i, api) => {
    const area = W * H, n = (v) => clamp(Math.round(area / v), 1, 400);
    const S = SC[i];
    const make = (count, fn) => { const a = new Float32Array(count * 7); for (let k = 0; k < count; k++) fn(a, k * 7); return a; };
    if (i === 0) {
      S.n = clamp(Math.round(area / 5200), 60, 300);
      let d = 0, left = Math.round(S.n * DEPTH[0].share);
      S.p = make(S.n, (a, o) => {
        if (o / 7 >= left && d < 2) { d++; left += Math.round(S.n * DEPTH[d].share); }
        const D = DEPTH[d];
        a[o] = api.rand() * W; a[o + 1] = api.rand() * H; a[o + 2] = D.size[0] + api.rand() * (D.size[1] - D.size[0]);
        a[o + 3] = D.speed[0] + api.rand() * (D.speed[1] - D.speed[0]); a[o + 4] = api.rand() * TAU; a[o + 5] = 6 + api.rand() * 22; a[o + 6] = d;
      });
    } else if (i === 1) {
      S.n = clamp(n(36000), 12, 34);
      S.p = make(S.n, (a, o) => { a[o] = api.rand() * W; a[o + 1] = H * (0.4 + api.rand() * 0.6); a[o + 2] = 5 + api.rand() * 9; a[o + 3] = 0.004 + api.rand() * 0.012; a[o + 4] = api.rand() * TAU; a[o + 5] = 10 + api.rand() * 26; });
      S.rn = clamp(n(22000), 24, 70);
      S.r = make(S.rn, (a, o) => { a[o] = api.rand() * W; a[o + 1] = api.rand() * H; a[o + 2] = 10 + api.rand() * 16; a[o + 3] = 0.5 + api.rand() * 0.45; });
    } else {
      S.n = clamp(n(15000), 26, 90);
      S.p = make(S.n, (a, o) => { a[o] = api.rand() * W; a[o + 1] = H * (0.25 + api.rand() * 0.8); a[o + 2] = (api.rand() < 0.8 ? 4 : 9) + api.rand() * 5; a[o + 3] = 0.02 + api.rand() * 0.05; a[o + 4] = api.rand() * TAU; a[o + 5] = 8 + api.rand() * 34; });
    }
  };

  // build what a biome needs, when it first comes on show (and again after a resize)
  const ensure = (i, api) => {
    const S = SC[i];
    if (S.built) return;
    const B = BIOME[i];
    S.layers = B.make(W, H);
    const fw = B.feat.w(W), fh = B.feat.h(H);
    S.feat = { a: cv(fw, fh), b: cv(fw, fh), fade: 1, key: null };
    S.pos = [0, 0, 0];
    S.mistC = i === 1 ? cv(288, 112) : null;
    seedWeather(i, api);
    S.built = true;
    tintFeature(i, true);
  };
  // the sky stuff takes the color of the region: the finished picture fades out while the new one fades in
  const tintFeature = (i, instant) => {
    const S = SC[i];
    if (!S.built || S.feat.key === tintKey) return;
    const f = S.feat;
    [f.a, f.b] = [f.b, f.a];
    BIOME[i].feat.paint(f.b, tint);
    if (i === 1) paintClouds(S.mistC, mix(tint, [235, 250, 240], 0.45), { seed: 21, cells: 3, rows: 6, lo: 0.3, hi: 0.62, alpha: 0.85, shape: (v) => Math.sin(Math.PI * v) ** 1.6 });
    f.fade = instant ? 1 : 0;
    f.key = tintKey;
  };

  const build = (api) => {
    W = api.w; H = api.h;
    cBg = rgb(api.css('--bg'), cBg);
    cBg2 = rgb(api.css('--bg-2'), cBg2);
    cText = rgb(api.css('--text'), cText);
    starStyle = str(cText);
    SC.forEach((S) => { S.built = false; S.layers = null; S.feat = null; S.mistC = null; });
    stars = new Float32Array(90 * 4);
    for (let i = 0; i < 90; i++) { stars[i * 4] = api.rand() * W; stars[i * 4 + 1] = Math.pow(api.rand(), 1.4); stars[i * 4 + 2] = 0.25 + api.rand() * 0.6; stars[i * 4 + 3] = api.rand() * TAU; }
    paintSprites();
    snap = null; hasSnap = false;
    ensure(scene, api);
    ready = true;
  };

  // ---------- drawing ----------
  const drift = (ctx, spr, x0, y, dw, dh, a) => {
    const x = ((x0 % dw) + dw) % dw;
    ctx.globalAlpha = a;
    ctx.drawImage(spr, x - dw, y, dw, dh);
    ctx.drawImage(spr, x, y, dw, dh);
  };
  const paintScene = (api, i, t, dt, still, alpha) => {
    const { ctx } = api;
    ensure(i, api);
    const S = SC[i], B = BIOME[i];
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    B.sky(tintC).forEach(([p, c]) => g.addColorStop(p, str(c)));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // stars
    ctx.fillStyle = starStyle;
    for (let k = 0; k < B.stars[0]; k++) {
      const o = k * 4;
      ctx.globalAlpha = alpha * B.stars[2] * stars[o + 2] * (still ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0009 + stars[o + 3])));
      ctx.fillRect(stars[o], stars[o + 1] * H * B.stars[1], 1.4, 1.4);
    }
    // the sun of the canyon: a soft glow and two thin rings
    if (i === 2) {
      const sx = W * 0.62, sy = H * 0.74, r = H * 0.11;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4.2);
      sg.addColorStop(0, str(mix(tintC, [255, 200, 120], 0.5), 0.55));
      sg.addColorStop(0.25, str(mix(tintC, [255, 150, 70], 0.3), 0.26));
      sg.addColorStop(1, str(tintC, 0));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = sg;
      ctx.fillRect(sx - r * 4.2, sy - r * 4.2, r * 8.4, r * 8.4); // the glow ends at 4.2 radii: no need to fill the rest of the screen
      ctx.strokeStyle = str(mix(tintC, [255, 220, 170], 0.5));
      ctx.lineWidth = 1.2;
      [[r, 0.55], [r * 1.55, 0.26]].forEach(([rr, a]) => { ctx.globalAlpha = alpha * a; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.stroke(); });
    }
    // the moving stuff of the sky: three drifting copies of one curtain, the old color crossing over to the new one
    const F = B.feat, f = S.feat;
    if (!still) { f.fade = Math.min(1, f.fade + dt / 900); for (let b = 0; b < 3; b++) S.pos[b] += aurSpeed[b] * dt; }
    else f.fade = 1;
    const dw = F.scale ? f.b.width * F.scale : W, dh = F.scale ? f.b.height * F.scale : H * 0.52;
    const lift = 1 + boost * 0.35;
    ctx.globalCompositeOperation = 'lighter';
    F.bands.forEach((bd, b) => {
      const breathe = still ? 0.8 : 0.72 + 0.28 * Math.sin(t * 0.00035 + b * 2.1);
      const a = alpha * bd.a * breathe * lift, y = bd.lift * dh * (F.scale ? 1 : 0.5);
      if (f.fade < 1) drift(ctx, f.a, S.pos[b], y, dw, dh * bd.s, a * (1 - f.fade));
      drift(ctx, f.b, S.pos[b], y, dw, dh * bd.s, a * f.fade);
    });
    ctx.globalCompositeOperation = 'source-over';
    // the land, far to near, with the mist or the haze after the layers that have it
    S.layers.forEach((L) => {
      const x = L.par === 0 ? farX : L.par === 2 ? nearX : (farX + nearX) / 2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(L.c, -MARGIN - x, H - L.c.height);
      if (L.mist) mist(ctx, i, S, L.mist, t, still, alpha);
    });
    if (i === 2) { // the floor of the canyon glows and flickers
      const fl = still ? 0.8 : 0.72 + 0.28 * Math.sin(t * 0.0021) * Math.sin(t * 0.0013 + 1);
      const gg = ctx.createLinearGradient(0, H * 0.8, 0, H);
      gg.addColorStop(0, str(tintC, 0));
      gg.addColorStop(1, str(mix(tintC, [255, 150, 60], 0.5), 0.32 * fl));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gg;
      ctx.fillRect(0, H * 0.8, W, H * 0.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = alpha;
    weather(api, i, t, dt, still, alpha);
  };
  // the mist between layers: a band of the region's color; in the forest it also drifts, in the canyon the air shimmers
  const mist = (ctx, i, S, [y0, y1, a, kind], t, still, alpha) => {
    const g = ctx.createLinearGradient(0, H * y0, 0, H * y1);
    const col = i === 2 ? mix(tintC, [255, 150, 80], 0.4) : tintC;
    g.addColorStop(0, str(col, 0));
    g.addColorStop(0.7, str(mix(cBg2, col, 0.18), a));
    g.addColorStop(1, str(cBg, 0));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, H * y0, W, H * (y1 - y0));
    if (kind === 1 || kind === -1) {
      const off = still ? 0 : t * 0.006;
      drift(ctx, S.mistC, kind === 1 ? off + 200 : 500 - off * 0.7, H * y0, W * 1.2, H * (y1 - y0) * 1.1, alpha * (kind === 1 ? 0.7 : 0.55));
    }
    if (kind === 2) { // the air over the canyon shimmers: a few thin lines that wave
      ctx.strokeStyle = str(mix(tintC, [255, 200, 130], 0.5));
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = alpha * (0.12 - k * 0.02);
        ctx.beginPath();
        const y = H * (y0 + (y1 - y0) * (0.2 + k * 0.17));
        for (let x = 0; x <= W; x += 24) { const yy = y + Math.sin(x * 0.012 + (still ? 0 : t * 0.0011) + k * 1.7) * 2.2; if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
        ctx.stroke();
      }
    }
  };
  const weather = (api, i, t, dt, still, alpha) => {
    const { ctx } = api;
    const S = SC[i], p = S.p, o2 = still ? 0 : t;
    if (i === 0) { // snow, far to near
      for (let k = 0; k < S.n; k++) {
        const o = k * 7, D = DEPTH[p[o + 6]];
        if (!still) {
          p[o + 1] += p[o + 3] * dt * (1 + Math.abs(gust) * 0.5);
          p[o] += (gust * D.wind - 0.012 * D.wind) * dt;
          const s = p[o + 2];
          if (p[o + 1] > H + s) { p[o + 1] = -s; p[o] = api.rand() * W; }
          if (p[o] > W + s) p[o] -= W + 2 * s;
          else if (p[o] < -s) p[o] += W + 2 * s;
        }
        const s = p[o + 2];
        ctx.globalAlpha = alpha * D.alpha;
        ctx.drawImage(D.sprite, p[o] + Math.sin(o2 * 0.0006 + p[o + 4]) * p[o + 5] - s / 2, p[o + 1] - s / 2, s, s);
      }
      return;
    }
    if (i === 1) { // rain, thin and slanted
      ctx.strokeStyle = str(mix(tintC, [220, 245, 240], 0.5));
      ctx.lineWidth = 1;
      ctx.globalAlpha = alpha * 0.16;
      ctx.beginPath();
      for (let k = 0; k < S.rn; k++) {
        const o = k * 7, r = S.r;
        if (!still) {
          r[o + 1] += r[o + 3] * dt * 1.3; r[o] -= (0.12 + gust * 0.5) * dt * 0.6;
          if (r[o + 1] > H + 30) { r[o + 1] = -30; r[o] = api.rand() * W; }
          if (r[o] < -30) r[o] += W + 60; else if (r[o] > W + 30) r[o] -= W + 60;
        }
        ctx.moveTo(r[o], r[o + 1]);
        ctx.lineTo(r[o] - r[o + 2] * 0.25, r[o + 1] + r[o + 2]);
      }
      ctx.stroke();
    }
    // fireflies drift and blink; embers rise and flicker
    const spr = i === 1 ? sprites.fly : sprites.ember;
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < S.n; k++) {
      const o = k * 7;
      if (!still) {
        if (i === 1) { p[o + 1] -= p[o + 3] * dt * 0.5; p[o] += (gust * 0.6 + Math.sin(t * 0.0004 + p[o + 4]) * 0.01) * dt; if (p[o + 1] < H * 0.3) p[o + 1] = H + 10; }
        else { p[o + 1] -= p[o + 3] * dt * (1 + boost); p[o] += (gust * 1.4 + 0.012) * dt; if (p[o + 1] < -10) { p[o + 1] = H + 10; p[o] = api.rand() * W; } }
        if (p[o] > W + 20) p[o] -= W + 40; else if (p[o] < -20) p[o] += W + 40;
      }
      const s = p[o + 2], fl = still ? 0.8 : i === 1 ? 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.0013 + p[o + 4] * 3), 2) : 0.55 + 0.45 * Math.sin(t * 0.004 + p[o + 4] * 5);
      ctx.globalAlpha = alpha * fl * (i === 1 ? 0.85 : 0.9);
      ctx.drawImage(spr, p[o] + Math.sin(o2 * 0.0007 + p[o + 4]) * p[o + 5] - s / 2, p[o + 1] - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const draw = (api, t, dt, still) => {
    if (!ready) return; // the engine paints once on resize, before init has built the layers
    if (still) { blend = 1; gust = 0; boost = 0.2; tintC = tint.slice(); farX = farT; nearX = nearT; }
    else {
      blend = Math.min(1, blend + dt / 1400);
      const k = Math.min(1, dt / 650), e = 1 - Math.exp(-dt / 500);
      gust *= Math.exp(-dt / 800);
      boost = Math.max(0, boost - dt / 1400);
      farX += (farT - farX) * k;
      nearX += (nearT - nearX) * k;
      tintC = tintC.map((v, j) => v + (tint[j] - v) * e);
    }
    if (blend >= 1 && hasSnap) { hasSnap = false; snap = null; } // the old picture is done with: give its memory back
    if (hasSnap) { api.ctx.save(); api.ctx.setTransform(1, 0, 0, 1, 0, 0); api.ctx.globalAlpha = 1; api.ctx.drawImage(snap, 0, 0); api.ctx.restore(); }
    paintScene(api, scene, t, dt, still, blend);
    api.ctx.globalAlpha = 1;
  };
  const setTint = (next, instant) => {
    const key = next.join(',');
    if (key === tintKey) return;
    tint = next;
    tintKey = key;
    if (instant) tintC = next.slice();
    paintSprites();
    SC.forEach((S, i) => tintFeature(i, instant));
  };
  // a new biome fades in over the last picture of the old one
  const setScene = (next, instant, api) => {
    if (next === scene) return;
    hasSnap = !instant;
    if (hasSnap) {
      const c = api.canvas;
      if (!snap || snap.width !== c.width || snap.height !== c.height) snap = cv(c.width, c.height);
      const g = snap.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, snap.width, snap.height);
      g.drawImage(c, 0, 0);
    }
    scene = next;
    blend = instant ? 1 : 0;
  };

  // ---------- art: original line drawings ----------
  const f1 = (v) => Math.round(v * 10) / 10;
  const spark = (x, y, s, cls = 'twinkle') => `<path class="${cls}" d="M${x} ${y - s}L${x + s * 0.18} ${y - s * 0.18}L${x + s} ${y}L${x + s * 0.18} ${y + s * 0.18}L${x} ${y + s}L${x - s * 0.18} ${y + s * 0.18}L${x - s} ${y}L${x - s * 0.18} ${y - s * 0.18}Z" style="fill:currentColor;stroke:none"/>`;
  const dust = (x, y, r = 1.6) => `<circle class="twinkle" cx="${x}" cy="${y}" r="${r}" style="fill:currentColor;stroke:none"/>`;

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

  // ----- the horned helmet as a star sign, in the manner of the game's constellations: a pale glowing drawing of the thing itself, a few stars joined by thin lines, dust around -----
  const flipPath = (d) => d.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (m, x, y) => `${f1(400 - x)} ${y}`);
  const helmet = (() => {
    // the left half of the drawing; the right half is its mirror image (paths use plain "x y" pairs, so they can be flipped)
    const half = [
      'M110 214C106 150 140 90 200 80', // the dome
      'M200 98C168 114 150 158 146 214', // a rib of the dome
      'M112 198C70 208 34 172 30 120C28 88 46 60 76 40C64 68 60 94 68 120C78 150 100 166 118 170', // the horn
      'M52 152C44 130 46 106 56 84', // a line along the horn
      'M108 240C112 292 142 332 200 364', // the cheek guard
      'M136 268C142 300 164 328 200 346', // its inner edge
      'M128 246L178 241L173 264L134 268Z', // the eye
    ];
    const whole = ['M200 80V214', 'M104 216C150 226 250 226 296 216', 'M106 238C150 248 250 248 294 238', 'M190 244L193 296L200 318L207 296L210 244'];
    const ghost = [...half, ...half.map(flipPath), ...whole].join('');
    // the stars of the left half; the ones on the middle line are not mirrored; a third entry names the big ones
    const N = {
      apex: [200, 80, 9], d1: [146, 102], d2: [116, 150], brow: [107, 216, 6], rib: [150, 178], cr: [200, 150], bc: [200, 224],
      eo: [128, 246], ei: [178, 241], el: [173, 264], ch: [124, 300], jw: [152, 336], nose: [200, 318, 9], chin: [200, 364, 9],
      h1: [50, 172], h2: [30, 120, 6], h3: [46, 64], tip: [76, 40, 9],
    };
    const E = [['tip', 'h3'], ['h3', 'h2'], ['h2', 'h1'], ['h1', 'brow'], ['brow', 'd2'], ['d2', 'd1'], ['d1', 'apex'], ['apex', 'cr'], ['cr', 'bc'], ['bc', 'nose'], ['nose', 'chin'],
      ['brow', 'bc'], ['brow', 'ch'], ['ch', 'jw'], ['jw', 'chin'], ['eo', 'ei'], ['ei', 'el'], ['el', 'eo'], ['d2', 'rib'], ['rib', 'cr']];
    const mid = new Set(['apex', 'cr', 'bc', 'nose', 'chin']);
    const keys = Object.keys(N);
    // the right half is a little off the mirror, as stars are
    const at = (k, side) => { const [x, y] = N[k]; if (!side || mid.has(k)) return [x, y]; const j = ((keys.indexOf(k) * 7919) % 11) - 5; return [f1(400 - x + j * 0.5), y + (j % 3)]; };
    const sides = (...ks) => (ks.every((k) => mid.has(k)) ? [0] : [0, 1]);
    const lines = E.flatMap(([a, b]) => sides(a, b).map((s) => `M${at(a, s).join(' ')}L${at(b, s).join(' ')}`)).join('');
    const list = keys.flatMap((k) => sides(k).map((s) => [k, s]));
    const halos = list.map(([k, s]) => `<circle cx="${at(k, s)[0]}" cy="${at(k, s)[1]}" r="${N[k][2] ? 13 : 6}"/>`).join('');
    const sparks = list.map(([k, s]) => { const [x, y] = at(k, s); return N[k][2] ? spark(x, y, N[k][2]) : dust(x, y, 2.1); }).join('');
    // dust: small stars all around, a third of them blinking
    const rnd = prng(11);
    const grains = Array.from({ length: 44 }, (_, i) => { const x = f1(-24 + rnd() * 448), y = f1(10 + rnd() * 380), r = f1(0.6 + rnd() * 1.1); return `<circle ${i % 3 ? '' : 'class="twinkle" '}cx="${x}" cy="${y}" r="${r}" opacity="${f1(0.35 + rnd() * 0.55)}" style="fill:currentColor;stroke:none"/>`; }).join('');
    return `<defs><filter id="skgl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter><filter id="skhl" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter><filter id="sknb" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30"/></filter></defs>
<g style="fill:var(--acc);stroke:none" filter="url(#sknb)"><ellipse cx="200" cy="210" rx="150" ry="170" opacity=".13"/><ellipse cx="96" cy="120" rx="64" ry="52" opacity=".16"/><ellipse cx="312" cy="300" rx="70" ry="56" opacity=".14"/></g>
${grains}
<g fill="none"><path d="${ghost}" style="stroke:var(--acc)" stroke-width="9" opacity=".24" filter="url(#skgl)"/><path d="${ghost}" style="stroke:var(--acc)" stroke-width="2.6" opacity=".55"/><path d="${ghost}" stroke="currentColor" stroke-width=".8" opacity=".6"/></g>
<path d="${lines}" stroke="currentColor" stroke-width="1.1" opacity=".9"/>
<g style="fill:currentColor;stroke:none" opacity=".45" filter="url(#skhl)">${halos}</g>
${sparks}`;
  })();
  const hero = `<svg viewBox="0 0 400 450" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
${helmet}
<path d="M70 388H330" stroke-width="1" style="stroke:var(--frame-2)"/>
${runeRow(200, 398, 1.15, 34)}
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

  // ----- the compass frame: the caps and the two lines of the band are one drawing, so they always meet -----
  // P: band height B, how far the caps stand out of the band o, line width sw, gap of the double line rg, cap width cw
  const BAR = { B: 30, o: 3, sw: 1.3, rg: 2.6, cw: 54 };
  const PLATE = { B: 20, o: 2, sw: 1.1, rg: 2, cw: 36 };
  const frameSvg = (P, uid, W) => {
    const { B, o, sw, rg, cw } = P;
    const f = (v) => Math.round(v * 100) / 100;
    const H = B + 2 * o, cy = H / 2, yt = o + sw / 2, yb = H - o - sw / 2;
    // two interlaced diamonds: the small one touches both lines, the big one carries the tip and stands out of the band
    const hh2 = (yb - yt) / 2, hw2 = cw * 0.273, c2 = cw - hw2;
    const hh1 = cy - sw / 2, hw1 = cw * 0.36, c1 = hw1 + 1.5;
    const dia = (cx, hw, hh, k = 1) => `M${f(cx - hw * k)} ${f(cy)}L${f(cx)} ${f(cy - hh * k)}L${f(cx + hw * k)} ${f(cy)}L${f(cx)} ${f(cy + hh * k)}Z`;
    const inset = (hw, hh) => 1 - rg / ((hw * hh) / Math.hypot(hw, hh)); // scale of the inner line of the ribbon
    const ribbon = (cx, hw, hh) => `${dia(cx, hw, hh)}${dia(cx, hw, hh, inset(hw, hh))}`;
    // the upper crossing: the big diamond's upper right edge against the small one's upper left edge
    const q = (hw2 * hh1) / hh2;
    const t = (c2 - hw2 - c1 + q) / (hw1 + q);
    const X = [c1 + t * hw1, cy - hh1 + t * hh1];
    const L1 = Math.hypot(hw1, hh1), L2 = Math.hypot(hw2, hh2);
    const cutW = f(sw + rg + 2.4), run = 4.2;
    // a short stroke along the ribbon that passes over, wiping the ribbon that passes under
    const cut = (px, py, ux, uy, nx, ny) => `M${f(px + nx * rg / 2 - ux * run)} ${f(py + ny * rg / 2 - uy * run)}L${f(px + nx * rg / 2 + ux * run)} ${f(py + ny * rg / 2 + uy * run)}`;
    const over1 = cut(X[0], X[1], hw1 / L1, hh1 / L1, -hh1 / L1, hw1 / L1); // the big diamond over the small one, above
    const over2 = cut(X[0], H - X[1], hw2 / L2, hh2 / L2, hh2 / L2, -hw2 / L2); // the small one over the big one, below
    const mask = (id, d) => `<mask id="${uid}${id}" maskUnits="userSpaceOnUse" x="-2" y="-2" width="${cw + 4}" height="${H + 4}"><rect x="-2" y="-2" width="${cw + 4}" height="${H + 4}" fill="#fff"/><path d="${d}" stroke="#000" stroke-width="${cutW}" fill="none"/></mask>`;
    const capG = `<g stroke-width="${sw}" stroke-linejoin="miter"><path d="${ribbon(c1, hw1, hh1)}" mask="url(#${uid}b)"/><path d="${ribbon(c2, hw2, hh2)}" mask="url(#${uid}a)"/><path d="M${f(cw)} ${f(yt)}V${f(yb)}" opacity=".7"/></g>`;
    const fill = `${dia(c1, hw1, hh1)}${dia(c2, hw2, hh2)}M${f(c2)} ${f(yt)}H${f(W - c2)}V${f(yb)}H${f(c2)}Z${dia(W - c2, hw2, hh2)}${dia(W - c1, hw1, hh1)}`;
    return `<defs>${mask('a', over1)}${mask('b', over2)}</defs><path class="bar-fill" d="${fill}"/><path d="M${f(c2)} ${f(yt)}H${f(W - c2)}M${f(c2)} ${f(yb)}H${f(W - c2)}" stroke-width="${sw}"/>${capG}<g transform="translate(${f(W)} 0) scale(-1 1)">${capG}</g>`;
  };
  // an svg frame behind an element that follows the element's width: the compass band and the plate above it
  const frameFor = (el, P, uid, place) => {
    const H = P.B + 2 * P.o, svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'cmp-frame');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('height', H);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    let last = 0;
    const render = () => {
      const W = Math.round((el.getBoundingClientRect().width + 2 * P.cw) * 100) / 100;
      if (!W || W === last) return;
      last = W;
      svg.setAttribute('width', W);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = frameSvg(P, uid, W);
    };
    place(svg);
    render();
    if (window.ResizeObserver) new ResizeObserver(render).observe(el); else addEventListener('resize', render);
  };

  // ----- icons of the special stops, silhouettes on a 24 by 36 field: a dragon head for the title, a keep for a chapter, a tent for the closing -----
  const ICONS = {
    title: 'M12 9L9.6 8.2C6.6 7.4 3.6 5 2 1.2C1.4 6.6 3 11 7 13.2L3 15L6.4 17.6L3.4 21L7 23L8.4 30.6L10.4 33.4L12 35.4L13.6 33.4L15.6 30.6L17 23L20.6 21L17.6 17.6L21 15L17 13.2C21 11 22.6 6.6 22 1.2C20.4 5 17.4 7.4 14.4 8.2ZM7.6 15.6L10.8 17L10.6 18.8ZM16.4 15.6L13.2 17L13.4 18.8ZM10.1 31.4m-.8 0a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0ZM13.9 31.4m-.8 0a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0Z',
    chapter: 'M1 2H7V5.5H9V2H15V5.5H17V2H23V12H19.5V30.5L22.5 34V36H1.5V34L4.5 30.5V12H1ZM9.4 36V27C9.4 24.5 10.6 22.6 12 21C13.4 22.6 14.6 24.5 14.6 27V36ZM11.1 15H12.9V19.5H11.1Z',
    closing: 'M12 3.4L22.2 31H17.4L12 17.5L6.6 31H1.8ZM11.3 0.6H12.7V3.4H11.3ZM0.6 32.6H23.4V35H0.6Z',
  };
  const icon = (kind) => `<svg class="ico" viewBox="0 0 24 36" aria-hidden="true"><path fill-rule="evenodd" d="${ICONS[kind]}"/></svg>`;

  // the button hints at the bottom left, the compass letters and the compass in the map are built after boot, from the vocabulary
  const vocabulary = {
    map: 'Map', mapHint: 'Choose a place to travel to. Esc closes the map.', counter: 'Stop {n} of {N}', backupCounter: 'Side road {L}', section: 'Region:',
    now: 'Reading now', next: 'Next stop', notes: 'Marginalia', timer: 'Time on the road', presenter: 'The skald’s lectern',
    rotate: 'Turn your device sideways to read the map.',
    hint: '← → Turn · M Map · P Lectern · F Full screen · ? Keys',
    ambient: 'Weather', help: 'A traveller’s keys', helpClose: 'Esc or ? closes.', jump: 'Fast travel to',
    keyMove: 'Travel on, travel back', keyMap: 'Open the map', keyPresenter: 'The skald’s lectern', keyFull: 'Full screen', keyBlackout: 'Sleep (blackout)',
    keyAmbient: 'Pause or resume the weather and the sky', keyJump: 'Fast travel: G, a number, Enter', keyHelp: 'This list',
    btnMove: 'Turn', btnMap: 'Map', btnHelp: 'Keys',
  };
  // every region takes the color of its place on the road: the runtime hands out the six palette accents in turn, here the regions walk from blue to red instead
  const roadColor = (i) => { const c = road.color[i]; return c ? str(c) : ''; };
  const paintRoad = (track) => {
    document.querySelectorAll('#stage > .slide').forEach((el, i) => { const c = roadColor(road.of[i]); if (c) el.style.setProperty('--acc', c); });
    if (track) track.querySelectorAll('.seg').forEach((seg, i) => { const c = roadColor(i); if (c && i < road.color.length) seg.style.setProperty('--acc', c); });
    const chrome = document.getElementById('chrome');
    if (chrome) chrome.style.setProperty('--acc', roadColor(road.of[Deck.index]));
  };
  const paintMap = (map) => map.querySelectorAll('.map-sec').forEach((sec, i) => { const c = roadColor(i); if (c && i < road.color.length) sec.style.setProperty('--acc', c); });
  Deck.ready.then(() => {
    const V = Object.assign({}, vocabulary, Deck.config && Deck.config.vocabulary);
    const chrome = document.getElementById('chrome');
    const map = document.getElementById('map');
    if (!road.color.length) mapRoad();
    paintRoad(document.getElementById('track'));
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
        const dots = seg.querySelectorAll('.dot');
        dots.forEach((dot) => {
          const kind = info.slides[+dot.dataset.i].layout;
          if (ICONS[kind]) { dot.insertAdjacentHTML('beforeend', icon(kind)); dot.classList.add('has-ico'); }
        });
        // a region that begins with an icon shows no letter
        const first = info.slides[+dots[0].dataset.i];
        seg.dataset.l = dots[0].classList.contains('has-ico') ? '' : Array.from((first.backup ? 'Backup' : names.get(first.sec)) || '')[0] || '';
      });
      frameFor(track, BAR, 'skb', (svg) => { svg.id = 'cmp'; track.before(svg); });
      const hud = document.getElementById('hud');
      if (hud) frameFor(hud, PLATE, 'skh', (svg) => hud.prepend(svg));
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
      const star = () => {
        const head = map.querySelector('.map-head');
        if (head && !head.querySelector('.compass')) head.insertAdjacentHTML('afterbegin', compassMap);
        paintMap(map);
      };
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
      init(api) { mapRoad(); build(api); },
      resize(api) { if (ready) build(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { draw(api, 0, 0, true); },
      change(api, info) {
        if (!ready) return;
        // the first slide sets the scene at once; after that the new region's sky and land fade in
        const reg = road.of[info.to] || 0, first = info.from < 0;
        setTint(road.color[reg] || STOPS[0], first);
        setScene(road.biome[reg] || 0, first, api);
        if (first) return;
        const dir = info.dir === 'back' ? -1 : 1;
        gust = -dir * 0.55; // a gust sweeps the weather against the direction of travel
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
