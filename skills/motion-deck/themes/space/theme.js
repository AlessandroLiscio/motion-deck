/* Space theme: stars, dust and a warp streak on the ambient canvas, line-art planet, ring and rocket. */
(() => {
  const rgb = (c) => {
    c = (c || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [...m[1]].map((x) => parseInt(x + x, 16));
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) return m[1].split(',').slice(0, 3).map(Number);
    return [90, 215, 255];
  };

  let stars = [];
  let dust = [];
  let warp = 0;
  let dir = 1;
  let tint = [90, 215, 255];
  let tintTo = [90, 215, 255];

  const populate = (api) => {
    const n = Math.max(120, Math.min(300, Math.round((api.w * api.h) / 8500)));
    stars = Array.from({ length: n }, () => {
      const z = 0.2 + api.rand() * 0.8;
      return { x: api.rand() * api.w, y: api.rand() * api.h, z, size: 0.5 + z * 1.4, sp: 0.0006 + api.rand() * 0.0018, ph: api.rand() * 6.28, hue: api.rand() < 0.2 };
    });
    dust = Array.from({ length: 36 }, () => ({ x: api.rand() * api.w, y: api.rand() * api.h, r: 1.2 + api.rand() * 2.6, a: 0.05 + api.rand() * 0.14, vx: 0.002 + api.rand() * 0.006, ph: api.rand() * 6.28 }));
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    ctx.clearRect(0, 0, w, h);
    if (still) tint = tintTo.slice();
    else for (let i = 0; i < 3; i++) tint[i] += (tintTo[i] - tint[i]) * Math.min(1, dt / 480);
    const [r, g, b] = tint.map(Math.round);

    let grad = ctx.createRadialGradient(w * 0.8, h * 0.16, 0, w * 0.8, h * 0.16, Math.max(w, h) * 0.55);
    grad.addColorStop(0, `rgba(${r},${g},${b},.17)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    grad = ctx.createRadialGradient(w * 0.08, h * 0.95, 0, w * 0.08, h * 0.95, Math.max(w, h) * 0.5);
    grad.addColorStop(0, 'rgba(118,92,225,.14)');
    grad.addColorStop(1, 'rgba(118,92,225,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (!still) warp = Math.max(0, warp - dt / 950);
    const k = still ? 0 : warp * warp;

    for (const d of dust) {
      if (!still) d.x = (d.x + d.vx * dt * (1 + k * 30) * -dir + w + 20) % (w + 20);
      const y = d.y + (still ? 0 : Math.sin(t * 0.0003 + d.ph) * 14);
      ctx.fillStyle = `rgba(${r},${g},${b},${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x, y, d.r, 0, 6.283);
      ctx.fill();
    }

    for (const s of stars) {
      if (!still) {
        s.x -= (0.004 + s.z * 0.012) * dt * (1 + k * 70) * dir;
        if (s.x < -30) s.x += w + 60;
        else if (s.x > w + 30) s.x -= w + 60;
      }
      const tw = still ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      const a = Math.min(1, (0.3 + 0.7 * s.z) * tw);
      ctx.fillStyle = s.hue ? `rgba(${r},${g},${b},${a})` : `rgba(235,240,255,${a})`;
      const len = k * (50 + s.z * 240);
      if (len > 3) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + dir * len, s.y);
        ctx.stroke();
      } else {
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
  };

  const twinkles = [[46, 70, 2.4], [332, 48, 2], [372, 150, 1.6], [64, 330, 2], [300, 352, 2.6], [120, 30, 1.6], [22, 190, 1.6]]
    .map(([x, y, r]) => `<circle class="twinkle" cx="${x}" cy="${y}" r="${r}"/>`).join('');

  Deck.registerTheme({
    name: 'space',
    defaultTransition: 'warp',
    vocabulary: {
      map: 'Star chart', mapHint: 'Pick a star to fly there. Esc closes.', counter: 'SOL {n} / {N}', backupCounter: 'CARGO {L}',
      now: 'On screen', next: 'Next jump', notes: 'Ship log', timer: 'Mission time', presenter: 'Mission control',
      hint: '← → fly · M star chart · P mission control · F full screen · ? manual',
      ambient: 'Starfield', help: 'Flight manual',
    },
    art: {
      hero: `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<g fill="currentColor" stroke="none">${twinkles}</g>
<path d="M27 249.6A180 46 -16 0 1 373 150.4" style="stroke:var(--acc)" opacity=".45"/>
<circle cx="200" cy="200" r="104" style="stroke:var(--acc);fill:color-mix(in srgb,var(--acc) 12%,var(--bg))"/>
<path d="M100.4 170Q200 188 299.6 170" style="stroke:var(--acc)" opacity=".4"/>
<path d="M96 205Q200 223 304 205" style="stroke:var(--acc)" opacity=".55"/>
<path d="M104 240Q200 256 296 240" style="stroke:var(--acc)" opacity=".4"/>
<path d="M128 150A82 82 0 0 1 188 108" style="stroke:var(--text)" stroke-width="5" opacity=".7"/>
<path d="M373 150.4A180 46 -16 0 1 27 249.6" style="stroke:var(--acc)" stroke-width="3"/>
<circle cx="349" cy="185" r="12" style="fill:var(--bg);stroke:var(--text)"/>
</svg>`,
      chapter: `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
<path d="M19.25 123.15A84 22 -16 0 1 180.75 76.85" style="stroke:var(--acc)" opacity=".45"/>
<circle cx="100" cy="100" r="46" style="stroke:var(--acc);fill:color-mix(in srgb,var(--acc) 12%,var(--bg))"/>
<path d="M56 92Q100 101 144 92" style="stroke:var(--acc)" opacity=".5"/>
<path d="M58 112Q100 121 142 112" style="stroke:var(--acc)" opacity=".4"/>
<path d="M180.75 76.85A84 22 -16 0 1 19.25 123.15" style="stroke:var(--acc)" stroke-width="3"/>
</svg>`,
      closing: `<svg viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<g fill="currentColor" stroke="none">${twinkles}</g>
<path d="M60 330Q110 300 150 296M40 296Q90 270 126 266" style="stroke:var(--acc)" stroke-dasharray="3 12" opacity=".6"/>
<g transform="rotate(32 200 200)">
<path d="M200 70C238 110 246 180 238 246H162C154 180 162 110 200 70Z" style="stroke:var(--text);fill:color-mix(in srgb,var(--acc) 10%,var(--bg))"/>
<circle cx="200" cy="160" r="20" style="stroke:var(--acc)"/>
<path d="M162 206L120 262L162 246ZM238 206L280 262L238 246Z" style="stroke:var(--acc)"/>
<path d="M178 246H222L214 264H186Z" style="stroke:var(--text)"/>
<path d="M188 272Q200 332 212 272" style="stroke:var(--acc)" stroke-width="3"/>
</g>
</svg>`,
      divider: `<svg viewBox="0 0 600 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
<path d="M0 20H250M350 20H600" style="stroke:var(--line)"/>
<path d="M300 4L306 14L316 20L306 26L300 36L294 26L284 20L294 14Z" style="fill:var(--acc);stroke:none"/>
<circle cx="262" cy="20" r="3" style="fill:var(--acc);stroke:none"/><circle cx="338" cy="20" r="3" style="fill:var(--acc);stroke:none"/>
</svg>`,
    },
    ambient: {
      init(api) { populate(api); tint = rgb(api.accent()); tintTo = tint.slice(); },
      resize(api) { populate(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { tintTo = rgb(api.accent()); draw(api, 0, 0, true); },
      change(api, info) { if (info.from >= 0) { warp = 1; dir = info.dir === 'back' ? -1 : 1; } tintTo = rgb(api.accent()); },
    },
  });
})();
