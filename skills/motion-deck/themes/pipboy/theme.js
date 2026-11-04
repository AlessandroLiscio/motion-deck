/* Pip-Boy theme: a phosphor screen on the ambient canvas (a bright centre, a faint grid, grain) with a refresh bar that rolls down it, a flash and a scan line on every slide change, and green line art (a wrist computer, a radiation gauge, a vault door, a rule). */
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
    } catch (e) { return fb || [46, 255, 133]; }
  };
  const str = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

  let base = null; // the static phosphor field, drawn once per size
  let bar = null; // gradient of the rolling refresh bar, in local coordinates (0 to barH)
  let line = null; // gradient of the scan line that follows a slide change
  let barH = 0;
  let cBg = [3, 15, 8];
  let cBg2 = [6, 33, 15];
  let cText = [110, 255, 176];
  let tint = [46, 255, 133];
  let tintTo = [46, 255, 133];
  let roll = 0.16; // position of the refresh bar, 0 to 1 of the way down
  let flash = 0; // brightness kick on a slide change, 1 to 0
  let sweep = 1; // progress of the scan line, 0 to 1; 1 means idle
  let dir = 1;
  let trMs = 620; // length of the scan transition, read from --tr-dur on init

  const grads = (api) => {
    const { ctx } = api;
    bar = ctx.createLinearGradient(0, 0, 0, barH);
    bar.addColorStop(0, str(tint, 0));
    bar.addColorStop(0.7, str(tint, 0.05));
    bar.addColorStop(0.94, str(tint, 0.13));
    bar.addColorStop(1, str(tint, 0));
    line = ctx.createLinearGradient(0, 0, 0, barH);
    line.addColorStop(0, str(tint, 0));
    line.addColorStop(0.75, str(tint, 0.1));
    line.addColorStop(0.97, str(tint, 0.42));
    line.addColorStop(1, str(tint, 0));
  };

  const build = (api) => {
    const { w, h, dpr } = api;
    cBg = rgb(api.css('--bg'), cBg);
    cBg2 = rgb(api.css('--bg-2'), cBg2);
    cText = rgb(api.css('--text'), cText);
    barH = Math.max(120, Math.round(h * 0.22));
    base = document.createElement('canvas');
    base.width = Math.max(2, Math.round(w * dpr));
    base.height = Math.max(2, Math.round(h * dpr));
    const g = base.getContext('2d');
    g.scale(dpr, dpr);
    const rg = g.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, Math.hypot(w, h) * 0.62);
    rg.addColorStop(0, str(cBg2));
    rg.addColorStop(1, str(cBg));
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    // a faint grid, like the graticule of a radar screen
    const step = 56;
    g.strokeStyle = str(cText, 0.035);
    g.lineWidth = 1;
    g.beginPath();
    for (let x = ((w % step) / 2) + 0.5; x < w; x += step) { g.moveTo(x, 0); g.lineTo(x, h); }
    for (let y = ((h % step) / 2) + 0.5; y < h; y += step) { g.moveTo(0, y); g.lineTo(w, y); }
    g.stroke();
    // phosphor grain
    const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) {
      g.fillStyle = str(cText, 0.02 + api.rand() * 0.06);
      g.fillRect(Math.floor(api.rand() * w), Math.floor(api.rand() * h), 1, 1);
    }
    grads(api);
  };

  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x); // close to the scan transition's cubic-bezier(.45, 0, .55, 1)

  const draw = (api, dt, still) => {
    const { ctx, w, h } = api;
    if (!base) return; // the engine paints once on resize, before init has built the layers
    let moved = false; // the tint changed, so the gradients are rebuilt (not every frame)
    if (still) {
      moved = tint.some((v, i) => v !== tintTo[i]);
      tint = tintTo.slice();
      flash = 0;
      sweep = 1;
    } else {
      const k = Math.min(1, dt / 360);
      for (let i = 0; i < 3; i++) {
        const v = Math.round(tint[i] + (tintTo[i] - tint[i]) * k);
        if (v !== tint[i]) { tint[i] = v; moved = true; }
      }
      roll = (roll + dt / 9000) % 1;
      flash = Math.max(0, flash - dt / 380);
      if (sweep < 1) sweep = Math.min(1, sweep + dt / trMs);
    }
    if (moved) grads(api);

    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0, w, h);

    // the refresh bar rolling down the screen; a still frame (paused, reduced motion, capture) has none, so a frozen band never cuts across the text
    if (!still) {
      ctx.save();
      ctx.translate(0, -barH + (h + barH) * roll);
      ctx.fillStyle = bar;
      ctx.fillRect(0, 0, w, barH);
      ctx.restore();
    }

    // the scan line of a slide change, in step with the scan transition: down going forward, up going back
    if (sweep < 1) {
      const e = ease(sweep);
      ctx.save();
      if (dir > 0) ctx.translate(0, e * h - barH);
      else { ctx.translate(0, (1 - e) * h + barH); ctx.scale(1, -1); }
      ctx.fillStyle = line;
      ctx.fillRect(0, 0, w, barH);
      ctx.restore();
    }
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.1;
      ctx.fillStyle = str(tint);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  };

  // ---------- art: green line work ----------
  const f1 = (v) => Math.round(v * 10) / 10;
  const polar = (cx, cy, r, a) => [f1(cx + r * Math.cos(a)), f1(cy + r * Math.sin(a))];
  const D = Math.PI / 180;
  // n radial ticks from r1 to r2 over `span` radians from a0; a closed ring does not repeat its first tick at the end
  const ticks = (cx, cy, r1, r2, n, a0, span, closed) => Array.from({ length: n }, (_, i) => {
    const a = a0 + (span * i) / (closed ? n : n - 1);
    return `M${polar(cx, cy, r1, a).join(' ')}L${polar(cx, cy, r2, a).join(' ')}`;
  }).join('');

  // a wrist computer: strap, case, a screen with bars and a pulse trace, a dial column, a status lamp
  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="square" stroke-linejoin="miter">
<path d="M74 112L22 122V280L74 290M326 112L378 122V280L326 290" style="stroke:var(--acc)" stroke-width="3" opacity=".7"/>
<path d="M22 160H60M22 200H60M22 240H60M340 160H378M340 200H378M340 240H378" style="stroke:var(--acc)" stroke-width="2" stroke-dasharray="6 6" opacity=".45"/>
<path d="M74 84H326V316H74ZM92 102H308V298H92Z" style="stroke:var(--acc)" stroke-width="4"/>
<circle cx="83" cy="93" r="3" style="fill:var(--acc);stroke:none"/><circle cx="317" cy="93" r="3" style="fill:var(--acc);stroke:none"/><circle cx="83" cy="307" r="3" style="fill:var(--acc);stroke:none"/><circle cx="317" cy="307" r="3" style="fill:var(--acc);stroke:none"/>
<path d="M112 122H262V258H112Z" style="stroke:var(--acc);fill:color-mix(in srgb,var(--acc) 8%,transparent)" stroke-width="3"/>
<path d="M124 140H170M184 140H212M226 140H250" style="stroke:var(--acc)" stroke-width="4"/>
<path d="M124 154H250" style="stroke:var(--acc)" stroke-width="1.5" opacity=".6"/>
<path d="M132 244V216M148 244V196M164 244V224M180 244V184" style="stroke:var(--acc);stroke-linecap:butt" stroke-width="10"/>
<path class="trace" d="M196 214H206L214 186L224 238L234 198L242 214H252" style="stroke:var(--acc)" stroke-width="3"/>
<path d="M124 168H250" style="stroke:var(--acc)" stroke-width="1" stroke-dasharray="3 5" opacity=".5"/>
<circle cx="285" cy="148" r="15" style="stroke:var(--acc)" stroke-width="3"/><path d="M285 148V136" style="stroke:var(--acc)" stroke-width="3"/>
<circle cx="285" cy="196" r="10" style="stroke:var(--acc)" stroke-width="3"/>
<path d="M272 232H298V246H272Z" style="stroke:var(--acc)" stroke-width="3"/>
<circle class="blink" cx="285" cy="272" r="6" style="fill:var(--a4);stroke:none"/>
<path d="M112 276H262M112 288H210" style="stroke:var(--acc)" stroke-width="2" opacity=".6"/>
</svg>`;

  // a radiation gauge: scale, three-bladed mark, a needle that swings
  const blade = (a) => {
    const p0 = polar(100, 100, 12, a - 30 * D);
    const p1 = polar(100, 100, 44, a - 30 * D);
    const p2 = polar(100, 100, 44, a + 30 * D);
    const p3 = polar(100, 100, 12, a + 30 * D);
    return `M${p0.join(' ')}L${p1.join(' ')}A44 44 0 0 1 ${p2.join(' ')}L${p3.join(' ')}A12 12 0 0 0 ${p0.join(' ')}Z`;
  };
  const chapter = `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="square" stroke-linejoin="miter">
<circle cx="100" cy="100" r="90" style="stroke:var(--acc)" stroke-width="4"/>
<circle cx="100" cy="100" r="80" style="stroke:var(--acc)" stroke-width="1.5" stroke-dasharray="2 8" opacity=".6"/>
<path d="${ticks(100, 100, 70, 78, 13, -210 * D, 240 * D, false)}" style="stroke:var(--acc)" stroke-width="2.5"/>
<path d="${blade(-90 * D)}${blade(30 * D)}${blade(150 * D)}" style="stroke:var(--acc);fill:color-mix(in srgb,var(--acc) 22%,transparent)" stroke-width="3"/>
<circle cx="100" cy="100" r="7" style="fill:var(--text);stroke:none"/>
<g class="needle"><path d="M100 100V30" style="stroke:var(--a4)" stroke-width="3"/><path d="M100 30L94 42H106Z" style="fill:var(--a4);stroke:none"/></g>
<path d="M54 168H146" style="stroke:var(--acc)" stroke-width="2" opacity=".6"/>
</svg>`;

  // a vault door: bolted ring, a toothed wheel and a hub that turn slowly
  const bolts = Array.from({ length: 12 }, (_, i) => { const [x, y] = polar(200, 200, 142, (i * 30 + 15) * D); return `<circle cx="${x}" cy="${y}" r="7" style="stroke:var(--acc)" stroke-width="3"/>`; }).join('');
  const teeth = ticks(200, 200, 112, 124, 36, 0, 360 * D, true);
  const spokes = Array.from({ length: 6 }, (_, i) => { const a = (i * 60 + 10) * D; return `M${polar(200, 200, 46, a).join(' ')}L${polar(200, 200, 98, a).join(' ')}`; }).join('');
  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="square" stroke-linejoin="miter">
<circle cx="200" cy="200" r="176" style="stroke:var(--acc)" stroke-width="5"/>
<circle cx="200" cy="200" r="162" style="stroke:var(--acc)" stroke-width="1.5" stroke-dasharray="3 9" opacity=".6"/>
${bolts}
<circle cx="200" cy="200" r="126" style="stroke:var(--acc)" stroke-width="4"/>
<g class="spin"><path d="${teeth}" style="stroke:var(--acc)" stroke-width="3" opacity=".8"/>
<circle cx="200" cy="200" r="100" style="stroke:var(--acc)" stroke-width="3" opacity=".9"/>
<path d="${spokes}" style="stroke:var(--acc)" stroke-width="7" opacity=".9"/></g>
<circle cx="200" cy="200" r="46" style="stroke:var(--acc);fill:color-mix(in srgb,var(--acc) 12%,transparent)" stroke-width="4"/>
<g class="spin-r"><path d="M200 168V232M168 200H232" style="stroke:var(--text)" stroke-width="4"/></g>
<circle cx="200" cy="200" r="8" style="fill:var(--text);stroke:none"/>
</svg>`;

  // a rule with a ruler's ticks and a bracketed block in the middle
  const rule = Array.from({ length: 10 }, (_, i) => { const y = i % 4 === 0 ? 30 : 26; return `M${12 + i * 24} 20V${y}M${588 - i * 24} 20V${y}`; }).join('');
  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke-linecap="square" stroke-linejoin="miter">
<path d="M0 20H250M350 20H600" style="stroke:var(--acc)" stroke-width="2" opacity=".85"/>
<path d="${rule}" style="stroke:var(--acc)" stroke-width="2" opacity=".5"/>
<path d="M264 8H252V32H264M336 8H348V32H336" style="stroke:var(--acc)" stroke-width="3"/>
<path d="M280 14H320V26H280Z" style="fill:var(--acc);stroke:none"/>
</svg>`;

  Deck.registerTheme({
    name: 'pipboy',
    defaultTransition: 'scan',
    vocabulary: {
      map: 'Data', mapHint: 'Pick an entry. Esc closes.', counter: 'LVL {n}/{N}', backupCounter: 'HOLOTAPE {L}',
      now: 'Current', next: 'Next entry', notes: 'Holotape notes', timer: 'Chrono', presenter: "Overseer's terminal",
      hint: 'Arrows move · M data · P overseer · F full screen · ? keys',
      ambient: 'Phosphor', help: 'Terminal keys', keyMap: 'Data screen', keyPresenter: "Overseer's terminal",
    },
    art: { hero, chapter, closing, divider },
    ambient: {
      init(api) {
        const d = /^\s*([\d.]+)\s*(ms|s)\s*$/.exec(api.css('--tr-dur'));
        if (d) trMs = Math.max(1, parseFloat(d[1]) * (d[2] === 's' ? 1000 : 1));
        tintTo = rgb(api.accent(), tintTo);
        tint = tintTo.slice();
        build(api);
      },
      resize(api) { if (base) build(api); },
      frame(api, t, dt) { draw(api, dt, false); },
      paint(api) { tintTo = rgb(api.accent(), tintTo); draw(api, 0, true); },
      change(api, info) {
        tintTo = rgb(api.accent(), tintTo);
        if (info.from >= 0) { flash = 1; sweep = 0; dir = info.dir === 'back' ? -1 : 1; }
      },
    },
  });
})();
