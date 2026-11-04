/* Neon theme: a synthwave horizon on the ambient canvas (perspective grid, striped sun, stars) that takes the section accent and surges on every slide change; neon-sign line art. */
(() => {
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const pctx = px.getContext('2d', { willReadFrequently: true });
  // any css color to [r, g, b]; used on init, resize and slide change only
  const rgb = (c, fb) => {
    try {
      pctx.clearRect(0, 0, 1, 1);
      pctx.fillStyle = '#000';
      pctx.fillStyle = (c || '').trim() || '#000';
      pctx.fillRect(0, 0, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return fb || [0, 229, 255]; }
  };
  const str = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  const lerp = (a, b, k) => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];

  let stars = [];
  let skyGrad = null;
  let groundGrad = null;
  let gridGrad = null;
  let glowGrad = null;
  let sunGlow = null;
  let sunSprite = null;
  let y0 = 0;
  let sunX = 0;
  let sunY = 0;
  let sunR = 0;
  let cBg = [10, 6, 20];
  let cBg2 = [22, 11, 46];
  let cText = [239, 232, 255];
  let cSun = [[255, 138, 31], [255, 95, 162], [255, 43, 214]];
  let tint = [0, 229, 255];
  let tintTo = [0, 229, 255];
  let tintKey = '';
  let tintStr = '';
  let starStyle = '';
  let phase = 0.35;
  let boost = 0;
  let dir = 1;

  const N = 15; // horizontal grid lines
  const M = 13; // vertical grid lines each side of the centre

  const gradTint = (api) => {
    const { ctx, w, h } = api;
    tintStr = str(tint);
    skyGrad = ctx.createLinearGradient(0, 0, 0, y0);
    skyGrad.addColorStop(0, str(cBg));
    skyGrad.addColorStop(0.6, str(cBg2));
    skyGrad.addColorStop(1, str(lerp(cBg2, tint, 0.3)));
    gridGrad = ctx.createLinearGradient(0, y0, 0, h);
    gridGrad.addColorStop(0, str(tint, 0));
    gridGrad.addColorStop(0.1, str(tint, 0.4));
    gridGrad.addColorStop(1, str(tint, 1));
    glowGrad = ctx.createLinearGradient(0, y0 - h * 0.12, 0, y0 + h * 0.06);
    glowGrad.addColorStop(0, str(tint, 0));
    glowGrad.addColorStop(0.7, str(tint, 0.2));
    glowGrad.addColorStop(1, str(tint, 0));
    tintKey = tint.join(',');
  };

  const build = (api) => {
    const { ctx, w, h } = api;
    cBg = rgb(api.css('--bg'), cBg);
    cBg2 = rgb(api.css('--bg-2'), cBg2);
    cText = rgb(api.css('--text'), cText);
    cSun = [rgb(api.css('--a4'), cSun[0]), rgb(api.css('--a6'), cSun[1]), rgb(api.css('--a2'), cSun[2])];
    starStyle = str(cText);
    y0 = Math.round(h * 0.67);
    sunR = Math.min(w, h) * 0.125;
    sunX = w * 0.5;
    sunY = y0 - sunR * 0.28;
    groundGrad = ctx.createLinearGradient(0, y0, 0, h);
    groundGrad.addColorStop(0, str(lerp(cBg2, cBg, 0.1)));
    groundGrad.addColorStop(1, str(cBg));
    sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 2.6);
    sunGlow.addColorStop(0, str(cSun[1], 0.2));
    sunGlow.addColorStop(1, str(cSun[1], 0));
    // the striped sun, rendered once
    const size = Math.ceil(sunR * 2 + 4);
    sunSprite = document.createElement('canvas');
    sunSprite.width = sunSprite.height = size;
    const g = sunSprite.getContext('2d');
    const gr = g.createLinearGradient(0, 2, 0, size - 2);
    gr.addColorStop(0, str(cSun[0]));
    gr.addColorStop(0.5, str(cSun[1]));
    gr.addColorStop(1, str(cSun[2]));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(size / 2, size / 2, sunR, 0, 6.2832);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) g.fillRect(0, sunR * 0.78 + i * sunR * 0.15, size, sunR * 0.012 + i * sunR * 0.024);
    const n = Math.max(80, Math.min(320, Math.round((w * h) / 7500)));
    stars = Array.from({ length: n }, () => ({
      x: api.rand() * w, y: Math.pow(api.rand(), 1.35) * y0 * 0.94, s: api.rand() < 0.1 ? 2 : 1, a: 0.3 + api.rand() * 0.7, sp: 0.0008 + api.rand() * 0.004, ph: api.rand() * 6.28,
    }));
    gradTint(api);
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    if (!sunSprite) return; // the engine paints once on resize, before init has built the layers
    if (still) {
      tint = tintTo.slice();
      boost = 0.3;
    } else {
      const k = Math.min(1, dt / 420);
      tint[0] = Math.round(tint[0] + (tintTo[0] - tint[0]) * k);
      tint[1] = Math.round(tint[1] + (tintTo[1] - tint[1]) * k);
      tint[2] = Math.round(tint[2] + (tintTo[2] - tint[2]) * k);
      boost = Math.max(0, boost - dt / 1100);
      phase += dt * (0.00018 + boost * boost * 0.006) * dir;
      phase -= Math.floor(phase);
    }
    if (tint.join(',') !== tintKey) gradTint(api);
    const bri = Math.min(1, 0.55 + boost * 0.5);

    ctx.globalAlpha = 1;
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, y0 + 1);
    ctx.fillStyle = starStyle;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = s.a * (still ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)));
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - sunR * 2.6, sunY - sunR * 2.6, sunR * 5.2, sunR * 5.2);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(sunSprite, sunX - sunR - 2, sunY - sunR - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, y0 - h * 0.12, w, h * 0.18);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, y0, w, h - y0);

    // the grid: horizontals race toward the viewer, verticals fan out from the vanishing point
    const H = h - y0;
    const sway = still ? 0 : dir * boost * w * 0.02;
    ctx.beginPath();
    for (let k = 0; k < N; k++) {
      const u = (k + phase) / N;
      const y = y0 + H * u * u;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    const sp = w * 0.105;
    for (let i = -M; i <= M; i++) {
      ctx.moveTo(w * 0.5, y0);
      ctx.lineTo(w * 0.5 + i * sp + sway * i * 0.2, h);
    }
    ctx.strokeStyle = gridGrad;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.16 * bri;
    ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = bri;
    ctx.stroke();

    // the horizon line
    ctx.beginPath();
    ctx.moveTo(0, y0 + 0.5);
    ctx.lineTo(w, y0 + 0.5);
    ctx.strokeStyle = tintStr;
    ctx.lineWidth = 9;
    ctx.globalAlpha = 0.16 + boost * 0.2;
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.5 + boost * 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // ---------- art: neon signs ----------
  const f1 = (v) => Math.round(v * 10) / 10;
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * 6.2832;
    const r1 = i % 4 === 0 ? 150 : 156;
    return `M${f1(200 + r1 * Math.cos(a))} ${f1(200 + r1 * Math.sin(a))}L${f1(200 + 166 * Math.cos(a))} ${f1(200 + 166 * Math.sin(a))}`;
  }).join('');
  const spark = (x, y, s) => `<path d="M${x} ${y - s}C${x} ${y - s * 0.2} ${x + s * 0.2} ${y} ${x + s} ${y}C${x + s * 0.2} ${y} ${x} ${y + s * 0.2} ${x} ${y + s}C${x} ${y + s * 0.2} ${x - s * 0.2} ${y} ${x - s} ${y}C${x - s * 0.2} ${y} ${x} ${y - s * 0.2} ${x} ${y - s}Z" style="stroke:var(--text)" stroke-width="2"/>`;

  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round">
<g class="spin"><path d="${ticks}" style="stroke:var(--acc)" stroke-width="2" opacity=".7"/></g>
<circle cx="200" cy="200" r="138" style="stroke:var(--acc)" stroke-width="5"/>
<circle cx="200" cy="200" r="120" style="stroke:var(--acc)" stroke-width="1.5" stroke-dasharray="2 10" opacity=".6"/>
<path class="flick" d="M226 74L128 220H196L170 328L274 176H204Z" style="stroke:var(--a2);fill:color-mix(in srgb,var(--a2) 16%,transparent)" stroke-width="6"/>
<path d="M90 296H310M104 314H296M122 332H278" style="stroke:var(--acc)" stroke-width="2" opacity=".45"/>
<g class="pulse">${spark(330, 96, 16)}</g>${spark(68, 120, 10)}${spark(344, 310, 8)}
</svg>`;

  const chapter = `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round">
<circle cx="100" cy="102" r="80" style="stroke:var(--acc)" stroke-width="4"/>
<path class="flick" d="M100 24L168 142H32Z" style="stroke:var(--a2);fill:color-mix(in srgb,var(--a2) 12%,transparent)" stroke-width="4.5"/>
<path d="M100 142L130 90H70Z" style="stroke:var(--acc)" stroke-width="2.5" opacity=".8"/>
<circle cx="100" cy="106" r="7" style="fill:var(--text);stroke:none"/>
<circle cx="100" cy="102" r="92" style="stroke:var(--acc)" stroke-width="1.5" stroke-dasharray="3 9" opacity=".5"/>
</svg>`;

  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round">
<ellipse class="spin" cx="200" cy="200" rx="176" ry="58" transform="rotate(-24 200 200)" style="stroke:var(--a2)" stroke-width="3" opacity=".9"/>
<path class="flick2" d="M200 36C207 148 252 193 364 200C252 207 207 252 200 364C193 252 148 207 36 200C148 193 193 148 200 36Z" style="stroke:var(--acc);fill:color-mix(in srgb,var(--acc) 12%,transparent)" stroke-width="5"/>
<circle cx="200" cy="200" r="14" style="fill:var(--text);stroke:none"/>
<circle cx="98" cy="262" r="6" style="fill:var(--a2);stroke:none"/><circle cx="306" cy="140" r="6" style="fill:var(--a2);stroke:none"/>
<g class="pulse">${spark(318, 70, 14)}</g>${spark(76, 96, 10)}${spark(330, 330, 9)}
</svg>`;

  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke-linecap="round">
<defs><linearGradient id="nd-fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" style="stop-color:var(--acc);stop-opacity:0"/><stop offset=".18" style="stop-color:var(--acc)"/><stop offset=".82" style="stop-color:var(--acc)"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient></defs>
<path d="M0 20H600" stroke="url(#nd-fade)" stroke-width="3"/>
<circle cx="300" cy="20" r="7" style="fill:var(--text);stroke:none"/>
<path d="M270 20H284M316 20H330" style="stroke:var(--text)" stroke-width="2" opacity=".7"/>
</svg>`;

  Deck.registerTheme({
    name: 'neon',
    defaultTransition: 'tunnel',
    vocabulary: {
      map: 'Tracklist', mapHint: 'Pick a track. Esc closes.', counter: 'TRACK {n}/{N}', backupCounter: 'BONUS {L}',
      now: 'Now playing', next: 'Up next', notes: 'Liner notes', timer: 'Runtime', presenter: 'DJ booth',
      hint: '← → skip · M tracklist · P DJ booth · F full screen · ? cheats',
      ambient: 'Lights', help: 'Cheat sheet',
    },
    art: { hero, chapter, closing, divider },
    ambient: {
      init(api) { tintTo = rgb(api.accent(), tintTo); tint = tintTo.slice(); build(api); },
      resize(api) { if (stars.length) build(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { tintTo = rgb(api.accent(), tintTo); draw(api, 0, 0, true); },
      change(api, info) {
        tintTo = rgb(api.accent(), tintTo);
        if (info.from >= 0) { boost = 1; dir = info.dir === 'back' ? -1 : 1; }
      },
    },
  });
})();
