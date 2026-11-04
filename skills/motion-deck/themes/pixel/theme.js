/*
 * Pixel theme for motion-deck: a night sky, hills and bursts of light drawn with pixelfx effects on the ambient canvas, a stepped wipe between slides, sprite art drawn on a pixel grid.
 *
 * Third-party code in this file (the section "pixelfx" below) is taken from pixelfx, https://github.com/patch-gg/pixelfx (version 0.3.0), and trimmed to the parts used here:
 * src/core/math.js, color.js, painter.js, sim.js (Lights and sparkle only), fx.js (createFrame, clearFrame, composite only), fx/weather/_lib.js (box, clip, rows only), fx/pickups/_lib.js (glint only),
 * fx/weather/shooting-stars.js and fx/pickups/collect-burst.js. Import and export lines were replaced by plain scopes; nothing else was changed in them.
 * Per the NOTICE.md of pixelfx, sim.js and the effects that say so at the top of their file adapt Sprite Fusion's open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
 *
 * The pixelfx license follows.
 *
 * MIT License
 *
 * Copyright (c) 2026 Patch
 * Copyright (c) 2026 Hugo Duprez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(() => {
  const pfx = {};

// ----- pixelfx: math -----
pfx.math = (() => {

// Numbers, easing, randomness and noise. Everything here is pure and deterministic,
// so an effect drawn at time t always looks the same.

const TAU = Math.PI * 2;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
const remap = (x, a0, a1, b0, b1) => lerp(b0, b1, invLerp(a0, a1, x));
const fract = (x) => x - Math.floor(x);
const wrap = (x, m) => ((x % m) + m) % m;
/** Progress 0..1 of t through the window [t0, t1]: 0 before it, 1 after it. */
const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
/** Hermite smoothstep of x between e0 and e1. */
const smooth = (e0, e1, x) => {
  const t = seg(x, e0, e1);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 → 0 over the window [t0, t1] (sine bump). */
const bump = (t, t0, t1) => (t <= t0 || t >= t1 ? 0 : Math.sin(Math.PI * seg(t, t0, t1)));
const pingpong = (x) => 1 - Math.abs(wrap(x, 2) - 1);
const dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
const angleTo = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

/** Easing curves: input 0..1, output 0..1 (back and elastic overshoot). */
const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inBack: (t, s = 1.70158) => (t <= 0 ? 0 : t >= 1 ? 1 : (s + 1) * t * t * t - s * t * t),
  outBack: (t, s = 1.70158) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

/** 32-bit integer hash of any number of integers. */
function hash(...ns) {
  let h = 0x9e3779b9;
  for (const n of ns) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
/** Deterministic random number in [0, 1) from integers (seed, particle index, which value...). */
const rand = (...ns) => hash(...ns) / 4294967296;

/** Seeded random generator (mulberry32). */
class Rng {
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  /** Roughly normal, mean 0, sd 1. */
  gauss() {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.732;
  }
}
/** A generator for one particle: rng(seed, i) gives the same numbers every frame. */
const rng = (...ns) => new Rng(hash(...ns));

/** Smooth 1D value noise in [-1, 1]. */
function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(rand(i, seed), rand(i + 1, seed), u) * 2 - 1;
}
/** Smooth 2D value noise in [-1, 1]. */
function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = rand(ix, iy, seed), b = rand(ix + 1, iy, seed), c = rand(ix, iy + 1, seed), d = rand(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
/** Fractal 2D noise in about [-1, 1]. */
function fbm(x, y, seed = 0, octaves = 3) {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < octaves; o++) {
    s += noise2(x, y, seed + o * 101) * a;
    n += a;
    x *= 2.03;
    y *= 2.03;
    a *= 0.5;
  }
  return s / n;
}
/**
 * 2D value noise whose lattice repeats every px cells in x and py cells in y (0: no repeat). Scroll it by
 * exactly py cells over a loop and the loop has no seam: tileNoise(x, y + phase * py, 0, py).
 */
function tileNoise(x, y, px = 0, py = 0, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = px ? wrap(ix, px) : ix, x1 = px ? wrap(ix + 1, px) : ix + 1;
  const y0 = py ? wrap(iy, py) : iy, y1 = py ? wrap(iy + 1, py) : iy + 1;
  const a = rand(x0, y0, seed), b = rand(x1, y0, seed), c = rand(x0, y1, seed), d = rand(x1, y1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
/** Fractal tileNoise: every octave keeps the repeat, so scrolled fields still loop. */
function tileFbm(x, y, px = 0, py = 0, seed = 0, octaves = 3) {
  let s = 0, a = 0.5, n = 0, k = 1;
  for (let o = 0; o < octaves; o++) {
    s += tileNoise(x * k, y * k, px * k, py * k, seed + o * 101) * a;
    n += a;
    a *= 0.5;
    k *= 2;
  }
  return s / n;
}
/** Noise that loops: the same value at phase 0 and phase 1 (for seamless loops). */
function loopNoise(phase, radius = 1, seed = 0) {
  const a = phase * TAU;
  return noise2(Math.cos(a) * radius + 50, Math.sin(a) * radius + 50, seed);
}
return { TAU, clamp, lerp, invLerp, remap, fract, wrap, seg, smooth, bump, pingpong, dist, angleTo, ease, hash, rand, Rng, rng, noise, noise2, fbm, tileNoise, tileFbm, loopNoise };
})();

// ----- pixelfx: color -----
pfx.color = (() => {
const { clamp } = pfx.math;
// Colors are 32-bit integers laid out like ImageData bytes (R, G, B, A in memory),
// so a frame's color buffer can be shown with new ImageData(new Uint8ClampedArray(buf.buffer), w, h).


const rgb = (r, g, b) => (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
const red = (c) => c & 255;
const green = (c) => (c >>> 8) & 255;
const blue = (c) => (c >>> 16) & 255;

/** "#rgb" or "#rrggbb" (or a color number, passed through) to a color number. */
function hex(h) {
  if (typeof h === "number") return h;
  let s = h.replace("#", "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const v = parseInt(s.slice(0, 6), 16);
  return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255);
}
const toHex = (c) => "#" + [red(c), green(c), blue(c)].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Linear mix of two colors. */
function mix(a, b, t) {
  t = clamp(t);
  return rgb(red(a) + (red(b) - red(a)) * t, green(a) + (green(b) - green(a)) * t, blue(a) + (blue(b) - blue(a)) * t);
}
/** Multiply a color's brightness by k. */
const scale = (c, k) => rgb(Math.min(255, red(c) * k), Math.min(255, green(c) * k), Math.min(255, blue(c) * k));
/** Perceived brightness 0..1. */
const luma = (c) => (0.299 * red(c) + 0.587 * green(c) + 0.114 * blue(c)) / 255;

/** A list of hex strings (dark to bright) to color numbers. */
const ramp = (list) => list.map(hex);
/**
 * Resample a ramp to exactly n steps, keeping its ends (the darkest and brightest stay put). Lets an effect
 * index steps by number (C[5]) whatever length of palette a caller passes.
 */
function fit(r, n) {
  r = r.map(hex);
  if (r.length === n) return r;
  return Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / Math.max(1, n - 1))]);
}
/** The ramp step for t in 0..1, no blending: pixel art picks a color, it doesn't fade between two. */
const at = (r, t) => r[clamp(Math.floor(t * r.length), 0, r.length - 1)];
/** Blended color along a ramp (for light, where smooth is right). */
function blend(r, t) {
  const x = clamp(t) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(x));
  return mix(r[i], r[i + 1], x - i);
}

const WHITE = hex("#ffffff");
const BLACK = hex("#000000");
const INK = hex("#0b0a10");
const PATCH = hex("#f53cd1");
return { rgb, red, green, blue, hex, toHex, mix, scale, luma, ramp, fit, at, blend, WHITE, BLACK, INK, PATCH };
})();

// ----- pixelfx: painter -----
pfx.painter = (() => {
const { clamp } = pfx.math;
const { hex } = pfx.color;
// The painter draws into a frame's two buffers: `color` (opaque pixels, faded with ordered dither, never
// blended) and `light` (additive glow, composited on top). Effects draw in local coordinates around their
// origin; the painter places, mirrors and rotates them, so an effect never needs to know where it is.


// 4x4 ordered (Bayer) thresholds: a pixel at alpha a is drawn when a is above its cell's threshold.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const OUT = { c: 0, a: 1, l: 0, k: 0 };
const sprites = new WeakMap();
const call = (v, ...args) => (typeof v === "function" ? v(...args) : v);

class Painter {
  constructor(frame) {
    this.frame = frame;
    this.reset();
  }

  /** Re-read the frame and clear placement, fade and light strength. */
  reset() {
    const f = this.frame;
    this.w = f.w; this.h = f.h; this.ox = f.ox | 0; this.oy = f.oy | 0; this.C = f.color; this.L = f.light;
    this.tx = 0; this.ty = 0; this.fx = 1; this.cs = 1; this.sn = 0;
    this.fade = 1; this.lightK = 1; this.layer = "front";
    return this;
  }

  /** Put the effect's origin at (x, y) in frame space, mirrored if flip, rotated by angle (radians). */
  place(x, y, flip = false, angle = 0) {
    this.tx = x; this.ty = y; this.fx = flip ? -1 : 1; this.cs = Math.cos(angle); this.sn = Math.sin(angle);
    return this;
  }

  // ---- transforms: local (effect) space <-> screen (frame) space
  toX(x, y) { return this.tx + x * this.fx * this.cs - y * this.sn; }
  toY(x, y) { return this.ty + x * this.fx * this.sn + y * this.cs; }
  fromX(sx, sy) { const dx = sx - this.tx, dy = sy - this.ty; return (dx * this.cs + dy * this.sn) * this.fx; }
  fromY(sx, sy) { const dx = sx - this.tx, dy = sy - this.ty; return -dx * this.sn + dy * this.cs; }
  // the screen pixel of the local pixel cell holding (x, y): mirrors and rotations land on whole cells
  cellX(x, y) { return Math.floor(this.toX(Math.floor(x) + 0.5, Math.floor(y) + 0.5)); }
  cellY(x, y) { return Math.floor(this.toY(Math.floor(x) + 0.5, Math.floor(y) + 0.5)); }

  // ---- raw writes, screen space, whole pixels. Color 0 means "nothing": it never erases what's there.
  put(sx, sy, c, a = 1) {
    if (!c) return;
    a *= this.fade;
    if (a < 1 && a <= BAYER[((sy & 3) << 2) | (sx & 3)]) return;
    const x = sx - this.ox, y = sy - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.C[y * this.w + x] = c;
  }
  add(sx, sy, c, k = 1) {
    k *= this.fade * this.lightK;
    if (k <= 0.004) return;
    const x = sx - this.ox, y = sy - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, d = this.L[i];
    const r = Math.min(255, (d & 255) + (c & 255) * k) | 0;
    const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k) | 0;
    const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k) | 0;
    this.L[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  /**
   * Blend a color over what's there at alpha a (0..1), keeping the result's own alpha: soft smoke, vapour and
   * mist. Use dithered dot() for hard pixel fades and blend() for translucent volumes.
   */
  blendPx(sx, sy, c, a) {
    a *= this.fade;
    if (!c || a <= 0.004) return;
    const x = sx - this.ox, y = sy - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, d = this.C[i], da = (d >>> 24) / 255, oa = a + da * (1 - a), k = a / oa;
    const ch = (s) => ((((c >>> s) & 255) * k + ((d >>> s) & 255) * (1 - k)) & 255);
    this.C[i] = (((oa * 255) & 255) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }
  /** Translucent pixel at a local point. */
  blend(x, y, c, a) { this.blendPx(this.cellX(x, y), this.cellY(x, y), c, a); }
  /** A translucent disc: puffs of smoke, vapour, dust. c and a may be functions of (d: 0 center..1 rim, angle). */
  disc(cx, cy, r, c, a) {
    if (r < 0.5) return this.blend(cx, cy, call(c, 0, 0), call(a, 0, 0));
    this.each(cx - r, cy - r, cx + r, cy + r, (x, y, sx, sy) => {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r) return;
      const d = Math.sqrt(d2) / r, ang = Math.atan2(dy, dx);
      this.blendPx(sx, sy, call(c, d, ang), call(a, d, ang));
    });
  }
  /** Read back the color under a local point (0 if empty). */
  get(x, y) {
    const sx = this.cellX(x, y) - this.ox, sy = this.cellY(x, y) - this.oy;
    return sx < 0 || sy < 0 || sx >= this.w || sy >= this.h ? 0 : this.C[sy * this.w + sx];
  }

  // ---- pixels
  /** One opaque pixel. */
  px(x, y, c) { this.put(this.cellX(x, y), this.cellY(x, y), c, 1); }
  /** One pixel at alpha a (0..1), faded by ordered dither. */
  dot(x, y, c, a = 1) { if (a > 0) this.put(this.cellX(x, y), this.cellY(x, y), c, a); }
  /** Add light to one pixel. */
  light(x, y, c, k = 1) { this.add(this.cellX(x, y), this.cellY(x, y), c, k); }

  /**
   * Visit every screen pixel whose center falls in the local box [x0, x1] x [y0, y1], with that center in
   * local space: fn(lx, ly, sx, sy). The basis of every filled shape, so shapes mirror and rotate exactly.
   */
  each(x0, y0, x1, y1, fn) {
    let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? x1 : x0, y = k & 2 ? y1 : y0, sx = this.toX(x, y), sy = this.toY(x, y);
      if (sx < ax) ax = sx; if (sx > bx) bx = sx; if (sy < ay) ay = sy; if (sy > by) by = sy;
    }
    const sx0 = Math.max(Math.floor(ax), this.ox), sx1 = Math.min(Math.ceil(bx), this.ox + this.w - 1);
    const sy0 = Math.max(Math.floor(ay), this.oy), sy1 = Math.min(Math.ceil(by), this.oy + this.h - 1);
    for (let sy = sy0; sy <= sy1; sy++)
      for (let sx = sx0; sx <= sx1; sx++) {
        const cx = sx + 0.5, cy = sy + 0.5;
        fn(this.fromX(cx, cy), this.fromY(cx, cy), sx, sy);
      }
  }

  /**
   * A pixel shader over a local box. fn(x, y, out) returns a color, or sets out.c (color), out.a (alpha),
   * out.l (light color, defaults to out.c) and out.k (light amount). Return nothing to leave the pixel alone.
   */
  shade(x0, y0, x1, y1, fn) {
    const o = OUT;
    this.each(x0, y0, x1, y1, (lx, ly, sx, sy) => {
      o.c = 0; o.a = 1; o.l = 0; o.k = 0;
      const c = fn(lx, ly, o) || o.c;
      if (c) this.put(sx, sy, c, o.a);
      if (o.k > 0) this.add(sx, sy, o.l || c, o.k);
    });
  }

  // ---- shapes. Colors (c) and alphas (a) can be numbers or functions of the shape's own coordinates.
  /** 1 px line. c and a may be functions of u (0 at the start, 1 at the end). */
  line(x0, y0, x1, y1, c, a = 1) {
    let sx = this.cellX(x0, y0), sy = this.cellY(x0, y0);
    const ex = this.cellX(x1, y1), ey = this.cellY(x1, y1);
    const dx = Math.abs(ex - sx), dy = -Math.abs(ey - sy), stepx = sx < ex ? 1 : -1, stepy = sy < ey ? 1 : -1;
    const n = Math.max(dx, -dy) || 1, fc = typeof c === "function", fa = typeof a === "function";
    let err = dx + dy, i = 0;
    for (;;) {
      const u = i++ / n;
      this.put(sx, sy, fc ? c(u) : c, fa ? a(u) : a);
      if (sx === ex && sy === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; sx += stepx; }
      if (e2 <= dx) { err += dx; sy += stepy; }
    }
  }
  /** Lines through a list of points [[x, y], ...]. */
  polyline(pts, c, a = 1) {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, a);
  }
  /** Thick segment with round ends. c and a may be functions of (u along, v across: 0 center, 1 edge). */
  beam(x0, y0, x1, y1, width, c, a = 1) {
    const r = width / 2, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    this.shade(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (x, y, o) => {
      const u = clamp(((x - x0) * dx + (y - y0) * dy) / L2), px = x0 + dx * u - x, py = y0 + dy * u - y;
      const d2 = px * px + py * py;
      if (d2 > r * r) return;
      const v = Math.sqrt(d2) / r;
      o.c = call(c, u, v);
      o.a = call(a, u, v);
    });
  }
  /** Filled disc. c and a may be functions of (d: 0 center to 1 rim, angle). */
  circle(cx, cy, r, c, a = 1) {
    if (r < 0.6) return this.dot(cx, cy, call(c, 0, 0), call(a, 0, 0));
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r) return;
      const d = Math.sqrt(d2) / r, ang = Math.atan2(dy, dx);
      o.c = call(c, d, ang);
      o.a = call(a, d, ang);
    });
  }
  /** Ellipse. c and a may be functions of (d: 0 center to 1 rim, angle). */
  ellipse(cx, cy, rx, ry, c, a = 1) {
    if (rx <= 0 || ry <= 0) return;
    this.shade(cx - rx, cy - ry, cx + rx, cy + ry, (x, y, o) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 > 1) return;
      const d = Math.sqrt(d2), ang = Math.atan2(dy, dx);
      o.c = call(c, d, ang);
      o.a = call(a, d, ang);
    });
  }
  /** Ring from radius r - w to r. c and a may be functions of (v: 0 inner to 1 outer, angle). */
  ring(cx, cy, r, w, c, a = 1) {
    const r0 = Math.max(0, r - w);
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r || d2 < r0 * r0) return;
      const v = w > 0 ? (Math.sqrt(d2) - r0) / (r - r0 || 1) : 1, ang = Math.atan2(dy, dx);
      o.c = call(c, v, ang);
      o.a = call(a, v, ang);
    });
  }
  /**
   * Band of a ring from angle a0 to a1 (radians, a1 > a0), radius r - w to r: the slash and smear shape.
   * c and a may be functions of (u: 0 at a0 to 1 at a1, v: 0 inner to 1 outer). w can be a function of u
   * for a crescent that tapers at both ends.
   */
  arc(cx, cy, r, w, a0, a1, c, a = 1) {
    const span = a1 - a0, wf = typeof w === "function";
    this.shade(cx - r, cy - r, cx + r, cy + r, (x, y, o) => {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) return;
      let ang = Math.atan2(dy, dx) - a0;
      ang -= Math.floor(ang / (Math.PI * 2)) * Math.PI * 2;
      if (ang > span) return;
      const u = ang / span, ww = wf ? w(u) : w;
      if (ww <= 0 || d < r - ww) return;
      const v = (d - (r - ww)) / ww;
      o.c = call(c, u, v);
      o.a = call(a, u, v);
    });
  }
  /** Filled rectangle. */
  rect(x, y, w, h, c, a = 1) {
    if (this.sn === 0) {
      const X0 = Math.round(x), Y0 = Math.round(y), X1 = Math.round(x + w), Y1 = Math.round(y + h);
      for (let yy = Y0; yy < Y1; yy++) for (let xx = X0; xx < X1; xx++) this.put(this.cellX(xx, yy), this.cellY(xx, yy), c, a);
      return;
    }
    this.shade(x, y, x + w, y + h, (lx, ly, o) => {
      if (lx < x || ly < y || lx >= x + w || ly >= y + h) return;
      o.c = c; o.a = a;
    });
  }
  /** Filled polygon from points [[x, y], ...] (even-odd rule). */
  poly(pts, c, a = 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const n = pts.length;
    this.shade(x0, y0, x1, y1, (x, y, o) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) return;
      o.c = call(c, x, y);
      o.a = call(a, x, y);
    });
  }
  tri(x0, y0, x1, y1, x2, y2, c, a = 1) { this.poly([[x0, y0], [x1, y1], [x2, y2]], c, a); }

  // ---- light
  /** Radial glow into the light buffer: k at the center, falling to 0 at radius r. */
  glow(x, y, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return;
    const cx = this.toX(x, y), cy = this.toY(x, y);
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    for (let sy = y0; sy <= y1; sy++) {
      const dy = (sy + 0.5 - cy) / r;
      for (let sx = x0; sx <= x1; sx++) {
        const dx = (sx + 0.5 - cx) / r, d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = 1 - Math.sqrt(d);
        this.add(sx, sy, c, f * f * k);
      }
    }
  }
  /** Glow around a segment (a soft beam of light). */
  glowLine(x0, y0, x1, y1, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return;
    const ax = this.toX(x0, y0), ay = this.toY(x0, y0), bx = this.toX(x1, y1), by = this.toY(x1, y1);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const X0 = Math.floor(Math.min(ax, bx) - r), X1 = Math.ceil(Math.max(ax, bx) + r);
    const Y0 = Math.floor(Math.min(ay, by) - r), Y1 = Math.ceil(Math.max(ay, by) + r);
    for (let sy = Y0; sy <= Y1; sy++)
      for (let sx = X0; sx <= X1; sx++) {
        const px = sx + 0.5, py = sy + 0.5, u = clamp(((px - ax) * dx + (py - ay) * dy) / L2);
        const ex = ax + dx * u - px, ey = ay + dy * u - py, d = Math.sqrt(ex * ex + ey * ey) / r;
        if (d >= 1) continue;
        const f = 1 - d;
        this.add(sx, sy, c, f * f * k);
      }
  }
  /** Glow hugging a circle of radius R (a shockwave's light), falling off over width r. */
  glowRing(x, y, R, r, c, k = 0.5) {
    if (r < 1 || k <= 0.004) return;
    const cx = this.toX(x, y), cy = this.toY(x, y), E = R + r;
    for (let sy = Math.floor(cy - E); sy <= Math.ceil(cy + E); sy++)
      for (let sx = Math.floor(cx - E); sx <= Math.ceil(cx + E); sx++) {
        const d = Math.abs(Math.hypot(sx + 0.5 - cx, sy + 0.5 - cy) - R) / r;
        if (d >= 1) continue;
        const f = 1 - d;
        this.add(sx, sy, c, f * f * k);
      }
  }

  // ---- sprites, text, masks
  /**
   * A little sprite from strings: rows like ["..##..", ".#oo#."], pal maps characters to colors
   * ({ "#": "#222034", o: 0xff... }); "." and " " are empty. Top-left at (x, y).
   * opts: { scale, a, flip (mirror left-right), flipY (upside down), tint (draw every pixel in one color) }.
   */
  sprite(rows, pal, x, y, opts = {}) {
    let s = sprites.get(rows);
    if (!s) sprites.set(rows, (s = rows.map((r) => [...r])));
    const k = opts.scale ?? 1, a = opts.a ?? 1, W = s[0]?.length ?? 0, cache = {};
    for (let r = 0; r < s.length; r++)
      for (let q = 0; q < s[r].length; q++) {
        const ch = s[r][q];
        if (ch === "." || ch === " ") continue;
        let c = opts.tint;
        if (c === undefined) {
          c = cache[ch];
          if (c === undefined) c = cache[ch] = pal[ch] === undefined ? 0 : hex(pal[ch]);
        }
        if (!c) continue;
        const col = opts.flip ? W - 1 - q : q, row = opts.flipY ? s.length - 1 - r : r;
        if (k === 1) this.dot(x + col, y + row, c, a);
        else this.rect(x + col * k, y + row * k, k, k, c, a);
      }
  }
  /** Fill a mask ({ w, h, data }) with its top-left at (x, y). c may be a function of (mx, my). */
  mask(m, x, y, c, a = 1) {
    for (let my = 0; my < m.h; my++)
      for (let mx = 0; mx < m.w; mx++) if (m.data[my * m.w + mx]) this.dot(x + mx, y + my, call(c, mx, my), call(a, mx, my));
  }
  /** The 1 px outline just outside a mask. */
  outline(m, x, y, c, a = 1) {
    const at = (mx, my) => mx >= 0 && my >= 0 && mx < m.w && my < m.h && m.data[my * m.w + mx];
    for (let my = -1; my <= m.h; my++)
      for (let mx = -1; mx <= m.w; mx++)
        if (!at(mx, my) && (at(mx - 1, my) || at(mx + 1, my) || at(mx, my - 1) || at(mx, my + 1)))
          this.dot(x + mx, y + my, call(c, mx, my), call(a, mx, my));
  }
}
return { Painter };
})();

// ----- pixelfx: sim -----
pfx.sim = (() => {
const { hex, WHITE } = pfx.color;
// Simulated particles, debris and lights, for effects that want real physics: sparks that streak and bounce
// off the floor, shards that tumble and settle, vapour and smoke that swell and thin, lights that flare and die.
// Adapted from Sprite Fusion's open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez. Units here are art pixels and seconds; draw through a Painter,
// so effects stay in local space and mirror or rotate like any other.

const CROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Lights that flare and die: add(x, y, r, color, k, life); update(dt); draw(p). */
class Lights {
  constructor() {
    this.list = [];
  }
  add(x, y, r, color, k, life) {
    this.list.push({ x, y, r, color: hex(color), k, life, max: life });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) if ((this.list[i].life -= dt) <= 0) this.list.splice(i, 1);
  }
  draw(p) {
    for (const l of this.list) {
      const k = l.life / l.max;
      p.glow(l.x, l.y, l.r * (0.55 + 0.45 * k), l.color, l.k * k * k);
    }
  }
}

/** A star glint: arms of length arm in color c with tips in tip, a white heart, light. */
function sparkle(p, x, y, arm, c, tip = c, k = 0.6) {
  const n = Math.round(arm);
  if (n < 1) return;
  const X = Math.floor(x), Y = Math.floor(y);
  for (let d = 1; d <= n; d++) {
    const cc = d > n * 0.6 ? tip : c;
    for (const [dx, dy] of CROSS) p.px(X + dx * d, Y + dy * d, cc);
  }
  if (n >= 3) for (const [dx, dy] of DIAG) p.px(X + dx, Y + dy, c);
  if (n >= 6) for (const [dx, dy] of DIAG) p.px(X + dx * 2, Y + dy * 2, tip);
  p.px(X, Y, WHITE);
  p.glow(x, y, 4 + n * 2, c, k);
}
return { Lights, sparkle };
})();

// ----- pixelfx: frame -----
pfx.frame = (() => {

/**
 * A frame: w x h pixels whose top-left sits at (ox, oy) in world space. `color` holds opaque pixels,
 * `light` additive glow; composite() puts them together. Same shape as Sprite Fusion's VFX frames.
 */
function createFrame(w, h, ox = 0, oy = 0) {
  return { w, h, ox, oy, color: new Uint32Array(w * h), light: new Uint32Array(w * h) };
}
function clearFrame(f) {
  f.color.fill(0);
  f.light.fill(0);
  return f;
}

/**
 * Color over a background, plus light, into RGBA bytes (a Uint8ClampedArray or Buffer, w * h * 4).
 * bg: null for transparent, a color number, or a Uint32Array of the frame's size. Over transparency, light
 * becomes color with alpha (its brightest channel), which reads as additive over dark backgrounds.
 */
function composite(f, out, bg = null, lightK = 1) {
  const n = f.w * f.h, C = f.color, L = f.light, flat = typeof bg === "number";
  for (let i = 0; i < n; i++) {
    const c = C[i], l = L[i] & 0xffffff;
    let r, g, b, a;
    const ca = c >>> 24;
    if (ca === 255) {
      r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; a = 255;
    } else if (bg === null) {
      // translucent color over nothing keeps its alpha
      r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; a = ca;
    } else {
      const k = flat ? bg : bg[i], f = ca / 255;
      r = (c & 255) * f + (k & 255) * (1 - f); g = ((c >>> 8) & 255) * f + ((k >>> 8) & 255) * (1 - f);
      b = ((c >>> 16) & 255) * f + ((k >>> 16) & 255) * (1 - f); a = 255;
    }
    if (l) {
      const lr = (l & 255) * lightK, lg = ((l >>> 8) & 255) * lightK, lb = ((l >>> 16) & 255) * lightK;
      if (a < 255) {
        // over transparency: premultiply what's there, add the light, divide by the new alpha
        const pa = a / 255, pr = r * pa + lr, pg = g * pa + lg, pb = b * pa + lb;
        const na = Math.min(1, Math.max(pa, Math.max(lr, lg, lb) / 255));
        if (na > 0) { r = Math.min(255, pr / na); g = Math.min(255, pg / na); b = Math.min(255, pb / na); a = na * 255; }
      } else {
        r = Math.min(255, r + lr); g = Math.min(255, g + lg); b = Math.min(255, b + lb);
      }
    }
    const j = i * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a;
  }
  return out;
}
return { createFrame, clearFrame, composite };
})();

// ----- pixelfx: weatherlib -----
pfx.weatherlib = (() => {

// Helpers shared by the weather loops. Weather fills its whole canvas edge to edge, so: clip() keeps every pixel
// and every bit of light inside the canvas; pass() is a fast per-pixel shader over the canvas; field() bakes a
// tiling noise that scrolls a whole tile a loop; trips() rains particles that fall a whole number of times a
// loop, somewhere new each time; tree() is a branching lightning path. All of it is a pure function of t.
// The noise bake and the branching bolt are adapted from Sprite Fusion's open-source fog and lightning
// (https://www.spritefusion.com/pixel-art-vfx/fog), MIT License, Copyright (c) 2026 Hugo Duprez.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** The canvas in local coordinates: x0 <= x < x1, y0 <= y < y1. */
function box(meta) {
  const [W, H] = meta.size, [OX, OY] = meta.origin;
  return { x0: -OX, y0: -OY, x1: W - OX, y1: H - OY, w: W, h: H };
}

/**
 * A painter that draws only inside the effect's canvas: the same API, with color, blends and light outside it
 * dropped. Exact under the painter's flip and rotation.
 */
function clip(p, meta) {
  const B = box(meta), q = Object.create(p);
  let ok;
  if (p.sn === 0) {
    const a = p.toX(B.x0, 0), b = p.toX(B.x1, 0), sx0 = Math.round(Math.min(a, b)), sx1 = Math.round(Math.max(a, b));
    const sy0 = Math.round(p.toY(0, B.y0)), sy1 = Math.round(p.toY(0, B.y1));
    ok = (sx, sy) => sx >= sx0 && sx < sx1 && sy >= sy0 && sy < sy1;
  } else
    ok = (sx, sy) => {
      const lx = p.fromX(sx + 0.5, sy + 0.5), ly = p.fromY(sx + 0.5, sy + 0.5);
      return lx >= B.x0 && lx < B.x1 && ly >= B.y0 && ly < B.y1;
    };
  q.put = (sx, sy, c, a) => ok(sx, sy) && p.put(sx, sy, c, a);
  q.add = (sx, sy, c, k) => ok(sx, sy) && p.add(sx, sy, c, k);
  q.blendPx = (sx, sy, c, a) => ok(sx, sy) && p.blendPx(sx, sy, c, a);
  q.glow = (x, y, r, c, k) => glow(q, B, x, y, r, c, k);
  return q;
}

// the painter's glow, with its box cut to the canvas first (big soft lights stay cheap)
function glow(q, B, x, y, r, c, k) {
  if (r < 1 || k <= 0.004) return;
  const x0 = Math.max(B.x0, Math.floor(x - r)), x1 = Math.min(B.x1 - 1, Math.ceil(x + r));
  const y0 = Math.max(B.y0, Math.floor(y - r)), y1 = Math.min(B.y1 - 1, Math.ceil(y + r));
  for (let py = y0; py <= y1; py++) {
    const dy = (py + 0.5 - y) / r;
    for (let px = x0; px <= x1; px++) {
      const dx = (px + 0.5 - x) / r, d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const f = 1 - Math.sqrt(d);
      q.light(px, py, c, f * f * k);
    }
  }
}

const ROW = { w: 0, c: null, a: null, b: null, l: null, k: null };
/**
 * The fastest whole-sky shader: fn(y, R) fills one canvas row at a time (y the row's pixel center), writing
 * R.c[i] (color, 0 for none), R.a[i] (alpha, default 1), R.b[i] (1: blend, 0: dither), R.l[i] / R.k[i] (light
 * color and amount) for column i = x - box.x0. One call a row, so the effect's inner loop stays tight.
 */
function rows(p, meta, y0, y1, fn) {
  const B = box(meta), w = B.w, R = ROW;
  if (R.w !== w) Object.assign(R, { w, c: new Uint32Array(w), a: new Float32Array(w), b: new Uint8Array(w), l: new Uint32Array(w), k: new Float32Array(w) });
  y0 = Math.max(B.y0, Math.floor(y0));
  y1 = Math.min(B.y1 - 1, Math.ceil(y1));
  const rot = p.sn !== 0, q = rot ? clip(p, meta) : null;
  const C = p.C, L = p.L, W = p.w, fade = p.fade, lk = p.lightK * fade, fx = p.fx;
  for (let y = y0; y <= y1; y++) {
    R.c.fill(0);
    R.k.fill(0);
    R.a.fill(1);
    R.b.fill(0);
    fn(y + 0.5, R);
    if (rot) {
      for (let i = 0; i < w; i++) {
        if (R.c[i]) R.b[i] ? q.blend(B.x0 + i, y, R.c[i], R.a[i]) : q.dot(B.x0 + i, y, R.c[i], R.a[i]);
        if (R.k[i] > 0) q.light(B.x0 + i, y, R.l[i] || R.c[i], R.k[i]);
      }
      continue;
    }
    const sy = Math.floor(p.ty + y + 0.5), ry = sy - p.oy;
    if (ry < 0 || ry >= p.h) continue;
    const row = ry * W, by = (sy & 3) << 2;
    let sxf = p.tx + (B.x0 + 0.5) * fx;
    for (let i = 0; i < w; i++, sxf += fx) {
      const c = R.c[i], kk = R.k[i];
      if (!c && !(kk > 0)) continue;
      const sx = Math.floor(sxf), rx = sx - p.ox;
      if (rx < 0 || rx >= W) continue;
      const j = row + rx;
      if (c) {
        const a = R.a[i] * fade;
        if (R.b[i]) {
          if (a > 0.004) {
            const d = C[j], da = (d >>> 24) / 255, oa = a + da * (1 - a), k = a / oa, m = 1 - k;
            const r = ((c & 255) * k + (d & 255) * m) & 255, g = (((c >>> 8) & 255) * k + ((d >>> 8) & 255) * m) & 255;
            const b = (((c >>> 16) & 255) * k + ((d >>> 16) & 255) * m) & 255;
            C[j] = (((oa * 255) & 255) << 24) | (b << 16) | (g << 8) | r;
          }
        } else if (a >= 1 || a > BAYER[by | (sx & 3)]) C[j] = c;
      }
      if (kk > 0) {
        const k = kk * lk;
        if (k > 0.004) {
          const lc = R.l[i] || c, d = L[j];
          const r = Math.min(255, (d & 255) + (lc & 255) * k) | 0, g = Math.min(255, ((d >>> 8) & 255) + ((lc >>> 8) & 255) * k) | 0;
          const b = Math.min(255, ((d >>> 16) & 255) + ((lc >>> 16) & 255) * k) | 0;
          L[j] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
      }
    }
  }
}
return { box, clip, rows };
})();

// ----- pixelfx: pickuplib -----
pfx.pickuplib = (() => {
const { scale, WHITE } = pfx.color;
/** A four-point star glint: arms of arm px in c, dimmer tips, a white heart, its own light. */
function glint(p, x, y, arm, c, k = 0.4, tip = scale(c, 0.8)) {
  const n = Math.round(arm), X = Math.floor(x), Y = Math.floor(y);
  if (n < 0) return;
  for (let d = 1; d <= n; d++) {
    const cc = d === n && n > 1 ? tip : c;
    p.px(X + d, Y, cc), p.px(X - d, Y, cc), p.px(X, Y + d, cc), p.px(X, Y - d, cc);
  }
  p.px(X, Y, n > 0 ? WHITE : c);
  p.glow(X + 0.5, Y + 0.5, 3 + n * 2.5, c, k);
}
return { glint };
})();

// ----- pixelfx: shootingStars -----
pfx.shootingStars = (() => {
const { clamp, smooth, rand, wrap, TAU } = pfx.math;
const { fit, mix, at, WHITE } = pfx.color;
const { sparkle } = pfx.sim;
const { clip, rows, box } = pfx.weatherlib;
// The glints (a cross of rays with a white heart and soft light, little twinkling stars around it) are adapted from
// Sprite Fusion's open-source sparkle (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License,
// Copyright (c) 2026 Hugo Duprez.

const meta = {
  name: "Shooting stars",
  desc: "Meteors burn across a starry sky, white heads trailing gold and rose; the big ones flare and break up, and each leaves a glowing train that twists and fades.",
  tags: ["weather", "meteor", "shooting star", "night", "sky", "stars", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 180],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#3a1e5a", "#7a3a8a", "#e0607a", "#ffa86a", "#ffe6a8", "#ffffff"],
    sky: ["#141428", "#2a2a4a", "#4c4c7c", "#8e8ec4", "#dcdcff"],
    seed: 4,
  },
};

const D = 10;
// the meteors: when, where they start, which way, how fast, how long they burn, how big; the last flares
const METEORS = [
  { t0: 0.5, x: 60, y: -170, a: 2.45, v: 260, life: 0.55, s: 0.6 },
  { t0: 1.9, x: -40, y: -176, a: 2.2, v: 220, life: 0.7, s: 0.8 },
  { t0: 3.4, x: 150, y: -150, a: 2.62, v: 300, life: 0.45, s: 0.5 },
  { t0: 4.6, x: 130, y: -178, a: 2.35, v: 240, life: 1.05, s: 1.4, flare: true },
  { t0: 6.7, x: -90, y: -168, a: 2.05, v: 200, life: 0.6, s: 0.7 },
  { t0: 7.9, x: 20, y: -160, a: 2.5, v: 280, life: 0.5, s: 0.6 },
  { t0: 9.2, x: -10, y: -176, a: 2.28, v: 230, life: 0.8, s: 1, flare: true },
];
const TRAIN = 1.6;

function draw(p, t, o) {
  const q = clip(p, meta), B = box(meta), S = o.seed, C = fit(o.palette, 6), K = fit(o.sky, 5);
  sky(p, q, t, S, K);
  METEORS.forEach((m, i) => meteor(q, wrap(t - m.t0, D), m, i, S, C));
}

// the starfield: a faint milky band across the sky, dim specks, steady stars, a few that twinkle with a glint
function sky(p, q, t, S, K) {
  rows(p, meta, -180, -1, (y, R) => {
    for (let i = 0; i < 320; i++) {
      const x = i - 160 + 0.5, d = Math.abs((y + 110) - (x * -0.32)) / 36;
      if (d >= 1) continue;
      const k = (1 - d) * (1 - d);
      R.l[i] = K[2];
      R.k[i] = 0.1 * k;
      if (rand(i, Math.floor(y), S, 5) < 0.05 * k) (R.c[i] = K[2]), (R.a[i] = 0.7);
    }
  });
  for (let i = 0; i < 130; i++) {
    const x = -160 + rand(S, i, 1) * 320, y = -180 + rand(S, i, 2) * 178, r = rand(S, i, 3), c = 1 + Math.floor(rand(S, i, 4) * 4);
    const tw = 0.5 + 0.5 * Math.sin((TAU * c * t) / D + rand(S, i, 5) * TAU);
    if (r < 0.6) q.dot(x, y, K[3], 0.35 + 0.5 * tw);
    else if (r < 0.94) (q.px(x, y, r < 0.8 ? K[4] : WHITE), q.glow(x + 0.5, y + 0.5, 3, K[3], 0.22 * tw));
    else sparkle(q, x, y, 1 + Math.round(tw * 2), K[4], K[3], 0.3 * tw);
  }
}

// one meteor, age seconds after it lights: a head that brightens and burns out, a trail cooling down the ramp
// behind it, a flare and fragments for the big ones, and the train it leaves glowing and twisting as it fades
function meteor(q, age, m, i, S, C) {
  const ca = Math.cos(m.a), sa = Math.sin(m.a), end = m.life + (m.flare ? 0.5 : 0) + TRAIN;
  if (age > end) return;
  const pos = (tt) => [m.x + ca * m.v * tt, m.y + sa * m.v * tt], burn = Math.min(age, m.life), [hx, hy] = pos(burn);
  // the train: the whole path it has burned, lingering, widening, drifting and twisting
  const trainK = age < m.life ? 1 : 1 - (age - m.life) / (TRAIN + (m.flare ? 0.5 : 0));
  if (trainK > 0) {
    const len = m.v * burn, nx = -sa, ny = ca;
    for (let d = 0; d < len; d += 1) {
      const passed = age - d / m.v;
      if (passed < 0.08) continue;
      const g = trainK * Math.min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Math.sin((Math.PI * d) / len)) * m.s, tw = Math.sin(d * 0.09 + passed * 1.7) * Math.min(4, passed * 3);
      const x = m.x + ca * d + nx * tw + passed * 4, y = m.y + sa * d + ny * tw;
      q.dot(x, y, passed < 0.6 ? C[2] : C[1], g * 0.75);
      if (d % 6 === 0) q.glow(x, y, 6 + passed * 4, C[1], 0.12 * g);
    }
  }
  if (age > m.life + (m.flare ? 0.5 : 0)) return;
  // the head brightens fast, holds, and burns out; the big ones flare as they go
  const u = age / m.life, k = age < m.life ? Math.min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) : 0;
  if (k > 0) {
    const L = (24 + 40 * m.s) * Math.min(1, u * 3);
    for (let d = 0; d <= L; d += 0.5) {
      const v = d / L, x = hx - ca * d, y = hy - sa * d;
      q.dot(x, y, v < 0.08 ? WHITE : at(C.slice(1).reverse(), v * 0.95), k * (v < 0.6 ? 1 : (1 - v) / 0.4));
      if (m.s > 0.9 && v < 0.4) q.dot(x - sa * 0.9, y + ca * 0.9, v < 0.15 ? C[4] : C[3], k * (1 - v / 0.4));
    }
    q.px(hx, hy, WHITE);
    if (m.s > 0.9) (q.px(hx + 1, hy, WHITE), q.px(hx, hy + 1, C[4]));
    q.glow(hx, hy, 8 + 10 * m.s, C[4], 0.45 * k);
    q.glow(hx - ca * L * 0.3, hy - sa * L * 0.3, 10 + 8 * m.s, C[3], 0.2 * k);
  }
  if (!m.flare || age < m.life * 0.82) return;
  // the flare: a burst of light and rays, fragments carrying on and fading
  const f = (age - m.life * 0.82) / (m.life * 0.18 + 0.5), [fx, fy] = pos(m.life * 0.86);
  if (f < 0.35) {
    sparkle(q, fx, fy, 9 * Math.sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.6);
    q.glow(fx, fy, 40, C[3], 0.5 * (1 - f / 0.35));
  }
  // little stars scattered round the burst, each twinkling once and gone
  for (let j = 0; j < 7; j++) {
    const ang = rand(S, i, j, 5) * TAU, r = 5 + rand(S, i, j, 6) * 16, d0 = rand(S, i, j, 7) * 0.3, g = (f - d0) / 0.45;
    if (g <= 0 || g >= 1) continue;
    const sx = fx + Math.cos(ang) * r * (0.6 + g * 0.5), sy = fy + Math.sin(ang) * r * (0.6 + g * 0.5) - g * 3, arm = Math.round(2.5 * Math.sin(Math.PI * g));
    if (arm >= 1) sparkle(q, sx, sy, arm, j % 3 ? C[4] : WHITE, C[3], 0.3 * (1 - g));
    else q.px(sx, sy, C[4]);
  }
  for (let j = 0; j < 4; j++) {
    const da = (rand(S, i, j, 1) - 0.5) * 0.5, sp = m.v * (0.5 + rand(S, i, j, 2) * 0.4), tt = f * (m.life * 0.18 + 0.5), g = 1 - f;
    const x = fx + Math.cos(m.a + da) * sp * tt, y = fy + Math.sin(m.a + da) * sp * tt;
    if (g <= 0) continue;
    q.line(x - Math.cos(m.a + da) * 5 * g, y - Math.sin(m.a + da) * 5 * g, x, y, C[3], g);
    q.px(x, y, g > 0.5 ? WHITE : C[4]);
    q.glow(x, y, 5, C[3], 0.35 * g);
  }
}
return { meta, draw };
})();

// ----- pixelfx: collectBurst -----
pfx.collectBurst = (() => {
const { Lights } = pfx.sim;
const { Rng, clamp, ease, TAU } = pfx.math;
const { fit, WHITE } = pfx.color;
const { glint } = pfx.pickuplib;
// The pop (a white flash, a ring snapping out, star sparks with short trails) follows Sprite Fusion's
// open-source pickup (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.

const meta = {
  name: "Collect burst",
  desc: "The moment of pickup: a white flash and a cross of light, a thin ring snapping out ahead of a softer one, twinkles thrown wide on curving paths that brake, hang and wink out.",
  tags: ["pickup", "collect", "burst", "sparkle", "reward", "one-shot"],
  size: [112, 108],
  origin: [56, 94],
  duration: 1.35,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"], seed: 3 },
};

const CY = -30;

function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), lights = new Lights();
  lights.add(0, CY, 36, C[5], 0.85, 0.32);
  lights.add(0, CY, 14, WHITE, 0.75, 0.08);
  // twinkles thrown out on curving paths: each one's heading turns as it flies, and drag brakes it
  const stars = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * TAU + R.range(-0.2, 0.2), sp = R.range(145, 225) * (i % 3 === 0 ? 1.12 : 0.85);
    return { x: 0, y: CY, a, sp, turn: (i % 2 ? 1 : -1) * R.range(2.5, 5), life: R.range(0.75, 1.15), age: 0, size: i % 3 === 0 ? 2.6 : R.range(1.2, 2), tr: [], c: i % 4 === 0 ? WHITE : i % 2 ? C[6] : C[5], ph: R.range(0, TAU) };
  });
  const motes = Array.from({ length: 7 }, () => ({ x: R.range(-8, 8), y: CY + R.range(-4, 6), vy: -R.range(12, 30), life: R.range(0.5, 0.9), d: R.range(0.05, 0.25), w: R.range(0, TAU) }));
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const s of stars) {
        if (s.age > s.life) continue;
        s.age += dt;
        s.tr.unshift([s.x, s.y]);
        if (s.tr.length > 4) s.tr.pop();
        s.a += s.turn * dt * Math.max(0, 1 - s.age * 1.5);
        s.sp -= s.sp * 4.3 * dt;
        s.x += Math.cos(s.a) * s.sp * dt;
        s.y += Math.sin(s.a) * s.sp * dt + 6 * s.age * dt;
        // the floor turns them back up
        if (s.y > -2) (s.y = -2), (s.a = -Math.abs(s.a)), (s.sp *= 0.5);
      }
      lights.update(dt);
    },
    draw(p) {
      // the flash: a white disc and a cross of light, gone in a few frames
      if (t < 0.07) p.circle(0, CY, 5.5 * (1 - t / 0.07) + 1, WHITE);
      if (t < 0.16) {
        const k = 1 - t / 0.16, L = 26 * ease.outCubic(Math.min(1, t / 0.03 + 0.4)) * k;
        for (const [dx, dy, l] of [[1, 0, 1], [-1, 0, 1], [0, 1, 0.6], [0, -1, 0.6]])
          p.line(0, CY, dx * L * l, CY + dy * L * l, (u) => (u < 0.3 ? WHITE : u < 0.65 ? C[6] : C[5]), (u) => (u < 0.5 ? 1 : (1 - u) * 2) * (0.5 + k));
        p.glow(0, CY, 20 * k + 4, C[5], 0.6 * k);
      }
      // a thin ring snapping out fast, a softer ring following
      const u1 = t / 0.32;
      if (u1 < 1) {
        const r = 3 + 23 * ease.outExpo(u1);
        p.ring(0, CY, r, 1, u1 < 0.3 ? WHITE : C[6], 1.3 - u1 * 1.2);
        p.glowRing(0, CY, r, 4, C[5], 0.4 * (1 - u1));
      }
      const u2 = (t - 0.04) / 0.5;
      if (u2 > 0 && u2 < 1) {
        const r = 2 + 16 * ease.outCubic(u2);
        p.ring(0, CY, r, Math.max(1, 2.6 * (1 - u2)), C[5], 1 - u2);
      }
      // the twinkles, with short trails, flickering as they hang and wink out
      for (const s of stars) {
        if (s.age > s.life) continue;
        const k = 1 - s.age / s.life, tw = 0.65 + 0.35 * Math.sin(s.age * 26 + s.ph);
        s.tr.forEach(([x, y], i) => i > 0 && p.dot(x, y, i < 2 ? C[5] : C[4], (1 - i / 4) * k * 1.4));
        if (k < 0.3 && Math.sin(s.age * 40 + s.ph) < 0) continue;
        glint(p, s.x, s.y, Math.round(s.size * tw * Math.min(1, k * 2.5)), s.c, 0.45 * k);
      }
      // motes drifting up after
      for (const m of motes) {
        const a = t - m.d;
        if (a < 0 || a > m.life) continue;
        const k = 1 - a / m.life, x = m.x + Math.sin(a * 6 + m.w) * 1.5, y = m.y + m.vy * a;
        p.dot(x, y, k > 0.5 ? C[6] : C[5], k * 1.5);
        p.glow(x + 0.5, y + 0.5, 3, C[5], 0.3 * k);
      }
      lights.draw(p);
    },
  };
}
return { meta, create };
})();

// =====================================================================================================
// Pixel theme code (motion-deck, MIT). Everything above this line is pixelfx; everything below is ours.
// =====================================================================================================

const { Painter } = pfx.painter;
const { createFrame, clearFrame, composite } = pfx.frame;
const { rgb: rgbNum, mix } = pfx.color;
const stars = pfx.shootingStars;
const burst = pfx.collectBurst;

// ---------- ambient: a pixel night sky (pixelfx "Shooting stars"), two parallax hills, a burst of pixelfx "Collect burst" on every slide change ----------
const FW = 320; // the art-pixel frame the pixelfx effects were drawn for; 320 x 180 is 5 screen pixels per art pixel on the 1600 x 900 stage
const FH = 180;
const FPS = 30;
const frame = createFrame(FW, FH);
const painter = new Painter(frame);
const off = document.createElement('canvas');
off.width = FW;
off.height = FH;
const octx = off.getContext('2d', { willReadFrequently: true });
const img = octx.createImageData(FW, FH);

const px = document.createElement('canvas');
px.width = px.height = 1;
const pctx = px.getContext('2d', { willReadFrequently: true });
// any css color to a pixelfx color number; used on init, resize and slide change only
const num = (c, fb) => {
  try {
    pctx.clearRect(0, 0, 1, 1);
    pctx.fillStyle = '#000';
    pctx.fillStyle = (c || '').trim() || '#000';
    pctx.fillRect(0, 0, 1, 1);
    const d = pctx.getImageData(0, 0, 1, 1).data;
    return rgbNum(d[0], d[1], d[2]);
  } catch (e) { return fb; }
};

let cBg = rgbNum(26, 28, 44);
let bgCss = '#1a1c2c';
let skyOpts = null;
let hillFar = 0;
let hillNear = 0;
let burstRamp = [];
let burstOpts = null;
let bursts = [];
let slide = 0; // parallax: the hills slide by one step on every slide change
let slideTo = 0;
let acc = 0;
let pend = 0;

const refresh = (api) => {
  cBg = num(api.css('--bg'), cBg);
  bgCss = (api.css('--bg') || '').trim() || bgCss;
  const panel = num(api.css('--panel'), cBg);
  const muted = num(api.css('--muted'), cBg);
  const text = num(api.css('--text'), cBg);
  const a2 = num(api.css('--a2'), text);
  const a4 = num(api.css('--a4'), text);
  hillFar = mix(cBg, panel, 0.5);
  hillNear = mix(cBg, panel, 0.9);
  skyOpts = {
    seed: 4,
    sky: [cBg, mix(cBg, muted, 0.25), mix(cBg, muted, 0.5), muted, text],
    palette: [mix(a4, cBg, 0.7), mix(a4, cBg, 0.4), a4, a2, text, text],
  };
};

const setBurst = (api) => {
  const a = num(api.accent(), cBg);
  const text = num(api.css('--text'), a);
  burstRamp = Array.from({ length: 8 }, (_, k) => (k < 4 ? mix(cBg, a, 0.2 + 0.8 * (k / 3)) : mix(a, text, (k - 3) / 4)));
  burstOpts = { palette: burstRamp, seed: 3 };
};

// the hills: stepped silhouettes made of a few sines, two layers, columns of whole art pixels
const HW = 640;
const hillMap = (base, amp, seed) => Array.from({ length: HW }, (_, x) => {
  const u = (x / HW) * Math.PI * 2;
  const v = Math.sin(u * 2 + seed) * 0.5 + Math.sin(u * 3 + seed * 2.1) * 0.3 + Math.sin(u * 7 + seed * 0.7) * 0.2;
  return Math.round((base + v * amp) / 2) * 2;
});
const farMap = hillMap(26, 9, 1);
const nearMap = hillMap(12, 6, 4);
const drawHill = (map, color, shift) => {
  const C = frame.color;
  const s = Math.floor(shift);
  for (let x = 0; x < FW; x++) {
    const top = FH - map[(((x + s) % HW) + HW) % HW];
    for (let y = top; y < FH; y++) C[y * FW + x] = color;
  }
};

const draw = (api, t, still) => {
  if (!skyOpts) return;
  clearFrame(frame);
  painter.reset();
  painter.place(FW / 2, FH);
  stars.draw(painter, still ? 0.25 : (t / 1000) % 10, skyOpts);
  drawHill(farMap, hillFar, slide * 0.45);
  drawHill(nearMap, hillNear, slide);
  for (const b of bursts) {
    painter.reset();
    painter.place(b.x, b.y + 30);
    b.fx.draw(painter);
  }
  composite(frame, img.data, cBg);
  octx.putImageData(img, 0, 0);
  const { ctx, w, h } = api;
  const s = Math.max(w / FW, h / FH);
  ctx.fillStyle = bgCss;
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.82; // a little dimmer than the frame, so running text stays calm over it
  ctx.drawImage(off, Math.round((w - FW * s) / 2), Math.round((h - FH * s) / 2), Math.ceil(FW * s), Math.ceil(FH * s));
  ctx.globalAlpha = 1;
};

const step = (dt) => {
  // the pixelfx simulations step at 120 Hz or finer whatever the frame rate (as pixelfx's createFx does)
  const n = Math.max(1, Math.ceil((dt / 1000) * 120 - 1e-9));
  for (const b of bursts) {
    b.age += dt / 1000;
    for (let i = 0; i < n; i++) b.fx.update(dt / 1000 / n);
  }
  bursts = bursts.filter((b) => b.age < 1.4);
  slide += (slideTo - slide) * Math.min(1, dt / 260);
};

// ---------- art: sprites drawn on a pixel grid, one letter per colour ----------
// Each sprite is a list of layers; every layer is painted into a grid with P (a pixel) and R (a rectangle) and
// becomes one <g>. A grid cell is one run of the SVG path of its letter, so the art stays crisp at any size.
const sprite = (w, h, build) => {
  const layers = [];
  const layer = (cls) => {
    const g = Array.from({ length: h }, () => Array(w).fill(''));
    layers.push({ cls, g });
    const P = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; };
    const R = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, c); };
    return { P, R };
  };
  build(layer);
  const out = layers.map(({ cls, g }) => {
    const by = {};
    g.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        const c = row[x];
        if (!c) continue;
        let n = 1;
        while (x + n < w && row[x + n] === c) n++;
        (by[c] = by[c] || []).push(`M${x} ${y}h${n}v1h-${n}z`);
        x += n - 1;
      }
    });
    return `<g${cls ? ` class="${cls}"` : ''}>${Object.entries(by).map(([c, d]) => `<path class="f-${c}" d="${d.join('')}"/>`).join('')}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" fill="none">${out}</svg>`;
};
// a plus-shaped twinkle
const plus = (L, x, y, c) => { L.P(x, y, c); L.P(x - 1, y, c); L.P(x + 1, y, c); L.P(x, y - 1, c); L.P(x, y + 1, c); };
const disc = (L, cx, cy, r, c) => { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) L.P(x, y, c); };

// hero: a castle under a moon, its flag waving in two frames
const hero = sprite(32, 30, (layer) => {
  const L = layer('');
  // ground
  L.R(0, 27, 31, 27, 'g'); L.R(0, 28, 31, 29, 'e');
  // side towers, walls and keep (stone n with light m)
  L.R(3, 14, 8, 26, 'n'); L.R(23, 14, 28, 26, 'n');
  L.R(9, 18, 22, 26, 'n');
  L.R(11, 10, 20, 26, 'n');
  L.R(3, 14, 3, 26, 'm'); L.R(11, 10, 11, 26, 'm'); L.R(23, 14, 23, 26, 'm'); L.R(9, 18, 9, 26, 'm');
  // battlements on the walls
  L.P(9, 17, 'n'); L.P(22, 17, 'n');
  // roofs in the section colour
  L.R(15, 4, 16, 4, 'a'); L.R(14, 5, 17, 5, 'a'); L.R(13, 6, 18, 6, 'a'); L.R(12, 7, 19, 7, 'a'); L.R(10, 8, 21, 8, 'a');
  L.R(5, 10, 6, 10, 'a'); L.R(4, 11, 7, 11, 'a'); L.R(3, 12, 8, 12, 'a'); L.R(2, 13, 9, 13, 'd');
  L.R(25, 10, 26, 10, 'a'); L.R(24, 11, 27, 11, 'a'); L.R(23, 12, 28, 12, 'a'); L.R(22, 13, 29, 13, 'd');
  L.R(10, 8, 21, 8, 'a'); L.R(10, 9, 21, 9, 'd');
  // gate and windows
  L.R(14, 21, 17, 26, 'k'); L.R(15, 20, 16, 20, 'k');
  L.R(15, 12, 16, 14, 'y'); L.R(5, 17, 6, 19, 'y'); L.R(25, 17, 26, 19, 'y');
  // flag pole
  L.R(15, 0, 15, 3, 'w');
  const fa = layer('fl-a');
  fa.R(16, 0, 19, 1, 'r'); fa.P(20, 1, 'r');
  const fb = layer('fl-b');
  fb.R(16, 1, 19, 2, 'r'); fb.P(20, 0, 'r');
  // the moon and a few stars
  const m = layer('');
  disc(m, 26.5, 4.5, 3.2, 'w'); m.P(25, 3, 'm'); m.P(26, 6, 'm'); m.P(28, 5, 'm'); m.P(27, 2, 'm');
  const s1 = layer('tw-a');
  plus(s1, 5, 4, 'y'); plus(s1, 22, 21, 'w');
  const s2 = layer('tw-b');
  plus(s2, 12, 2, 'w'); plus(s2, 3, 8, 'y');
});

// chapter: a key, glinting
const chapter = sprite(24, 24, (layer) => {
  const L = layer('bob');
  // the bow: a ring, shaded on its lower half
  disc(L, 7, 11.5, 5.6, 'a');
  for (let y = 12; y <= 18; y++) for (let x = 1; x <= 13; x++) if ((x - 7) ** 2 + (y - 11.5) ** 2 <= 5.6 * 5.6) L.P(x, y, 'd');
  disc(L, 7, 11.5, 2.4, '');
  // the shaft and the bit
  L.R(12, 11, 21, 12, 'a'); L.R(12, 13, 21, 13, 'd');
  L.R(18, 14, 19, 17, 'a'); L.R(21, 14, 21, 15, 'a'); L.R(18, 17, 19, 17, 'd');
  L.R(3, 7, 5, 7, 'l'); L.P(2, 8, 'l'); L.R(13, 11, 17, 11, 'l');
  const s = layer('tw-a');
  plus(s, 20, 5, 'w'); plus(s, 4, 20, 'y');
  const s2 = layer('tw-b');
  plus(s2, 12, 3, 'y'); plus(s2, 21, 20, 'w');
});

// closing: a trophy with a star
const closing = sprite(24, 26, (layer) => {
  const L = layer('');
  // handles
  L.R(2, 4, 4, 4, 'o'); L.R(1, 5, 1, 8, 'o'); L.R(2, 9, 4, 9, 'o');
  L.R(19, 4, 21, 4, 'o'); L.R(22, 5, 22, 8, 'o'); L.R(19, 9, 21, 9, 'o');
  // cup
  L.R(5, 2, 18, 3, 'y'); L.R(5, 4, 18, 8, 'y'); L.R(6, 9, 17, 10, 'y'); L.R(7, 11, 16, 12, 'y'); L.R(9, 13, 14, 14, 'y');
  L.R(5, 2, 7, 10, 'Y'); L.R(8, 11, 9, 12, 'Y');
  L.R(15, 4, 18, 8, 'o'); L.R(14, 9, 17, 10, 'o'); L.R(13, 11, 16, 12, 'o'); L.R(13, 13, 14, 14, 'o');
  // stem and base
  L.R(10, 15, 13, 17, 'y'); L.R(13, 15, 13, 17, 'o'); L.R(10, 15, 10, 17, 'Y');
  L.R(7, 18, 16, 19, 'y'); L.R(7, 18, 16, 18, 'Y'); L.R(15, 19, 16, 19, 'o');
  L.R(5, 20, 18, 23, 'a'); L.R(5, 20, 18, 20, 'l'); L.R(5, 23, 18, 23, 'd');
  // a star on the cup
  L.P(11, 5, 'k'); L.P(12, 5, 'k'); L.R(10, 6, 13, 6, 'k'); L.R(9, 7, 14, 7, 'k'); L.R(10, 8, 13, 8, 'k'); L.P(10, 9, 'k'); L.P(13, 9, 'k');
  const s1 = layer('tw-a');
  plus(s1, 3, 14, 'w'); plus(s1, 20, 15, 'y');
  const s2 = layer('tw-b');
  plus(s2, 12, 0, 'w'); plus(s2, 21, 22, 'w');
});

// divider: a row of bricks with a coin shining along it
const divider = sprite(72, 8, (layer) => {
  const L = layer('');
  for (let r = 0; r < 2; r++) {
    const y = r * 4;
    for (let x = r ? -4 : 0; x < 72; x += 9) {
      for (let i = 0; i < 8; i++) {
        const xx = x + i;
        if (xx < 0 || xx > 71) continue;
        L.P(xx, y, 'l'); L.P(xx, y + 1, 'a'); L.P(xx, y + 2, 'd');
      }
    }
  }
  const s = layer('shine');
  s.R(0, 0, 1, 1, 'w');
});

Deck.registerTheme({
  name: 'pixel',
  defaultTransition: 'pixelwipe',
  vocabulary: {
    map: 'Stage select', mapHint: 'Pick a stage. Esc closes.', counter: 'STAGE {n}/{N}', backupCounter: 'BONUS {L}', section: 'WORLD',
    now: 'Now playing', next: 'Next stage', notes: 'Cheat codes', timer: 'Play time', presenter: 'Game master',
    hint: '← → move · M stage select · P game master · F full screen · ? controls',
    ambient: 'Stars', help: 'Controls', helpClose: 'Press Esc or ? to resume.', jump: 'Warp to stage',
    keyMove: 'Next, previous stage', keyMap: 'Stage select', keyPresenter: 'Game master window', keyFull: 'Full screen', keyBlackout: 'Pause screen', keyAmbient: 'Stars on or off', keyJump: 'Warp to a stage number', keyHelp: 'Controls',
  },
  art: { hero, chapter, closing, divider },
  ambient: {
    init(api) { refresh(api); setBurst(api); },
    resize(api) { refresh(api); setBurst(api); },
    frame(api, t, dt) {
      pend += dt;
      acc += dt;
      if (acc < 1000 / FPS) return;
      step(Math.min(pend, 100));
      pend = 0;
      acc = 0;
      draw(api, t, false);
    },
    paint(api) { bursts = []; slide = slideTo; draw(api, 0, true); },
    change(api, info) {
      setBurst(api);
      if (info.from < 0) return;
      const dir = info.dir === 'back' ? -1 : 1;
      slideTo += dir * 12;
      for (const side of [-1, 1]) {
        const x = side > 0 ? FW * 0.88 + api.rand() * 14 : FW * 0.12 - api.rand() * 14;
        const y = 50 + api.rand() * 90;
        bursts.push({ x, y, age: 0, fx: burst.create({ ...burst.meta.options, ...burstOpts }) });
      }
    },
  },
});
})();
