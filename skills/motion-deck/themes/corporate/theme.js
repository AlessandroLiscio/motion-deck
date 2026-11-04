/* Corporate theme: a few large soft shapes in brand tints drift on the ambient canvas and ease toward each section's accent; flat geometric art in tints of the accent. */
(() => {
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const pctx = px.getContext('2d', { willReadFrequently: true });
  // any css color (hex, rgb, color-mix, oklch relative colors) to [r, g, b]; used on init and on slide change only
  const rgb = (c, fb) => {
    try {
      pctx.clearRect(0, 0, 1, 1);
      pctx.fillStyle = '#000';
      pctx.fillStyle = (c || '').trim() || '#000';
      pctx.fillRect(0, 0, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return fb || [11, 122, 140]; }
  };
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };

  const S = 256;
  const blobs = [];
  let brand = [11, 122, 140];
  let tintTo = [11, 122, 140];
  let mix = 1;
  let shift = 0;

  // soft alpha masks, blurred once; tinting a sprite later is one cheap composite
  const masks = {};
  const buildMasks = () => {
    const d = mk();
    const g = d.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.7)');
    gr.addColorStop(0.6, 'rgba(0,0,0,.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    masks.disc = d;
    const q = mk();
    const h = q.getContext('2d');
    h.filter = 'blur(12px)';
    h.fillStyle = 'rgba(0,0,0,.62)';
    h.beginPath();
    if (h.roundRect) h.roundRect(52, 52, 152, 152, 54); else h.rect(52, 52, 152, 152);
    h.fill();
    masks.squircle = q;
  };
  const sprite = (cv, kind, c) => {
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, S, S);
    g.drawImage(masks[kind], 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
  };

  const populate = (api) => {
    brand = rgb(api.css('--a1'), brand);
    if (!masks.disc) buildMasks();
    blobs.length = 0;
    const cfg = [
      { kind: 'disc', x: 0.84, y: 0.12, r: 0.4, a: 0.15, sec: true, sp: 0.00011, ph: 0.3, depth: 0.5, rot: 0, rs: 0 },
      { kind: 'squircle', x: 0.1, y: 0.9, r: 0.38, a: 0.13, sec: true, sp: 0.00009, ph: 2.2, depth: 1, rot: 0.4, rs: 0.00004 },
      { kind: 'disc', x: 0.56, y: 1.02, r: 0.3, a: 0.07, sec: false, sp: 0.00013, ph: 4.1, depth: 0.7, rot: 0, rs: 0 },
      { kind: 'squircle', x: 0.95, y: 0.62, r: 0.2, a: 0.06, sec: false, sp: 0.00012, ph: 5.3, depth: 1.4, rot: -0.5, rs: -0.00005 },
    ];
    cfg.forEach((c) => {
      const cur = mk();
      const prev = mk();
      sprite(cur, c.kind, c.sec ? tintTo : brand);
      sprite(prev, c.kind, c.sec ? tintTo : brand);
      blobs.push(Object.assign({ cur, prev }, c));
    });
  };

  const setTint = (c) => {
    tintTo = c;
    blobs.forEach((b) => {
      if (!b.sec) return;
      const t = b.prev; b.prev = b.cur; b.cur = t;
      sprite(b.cur, b.kind, c);
    });
  };

  const draw = (api, t, dt, still) => {
    const { ctx, w, h } = api;
    ctx.clearRect(0, 0, w, h);
    if (still) { mix = 1; shift = 0; } else { mix = Math.min(1, mix + dt / 900); shift *= Math.pow(0.0015, dt / 1000); }
    const R = Math.max(w, h);
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const cx = (b.x + (still ? 0 : Math.sin(t * b.sp + b.ph) * 0.05 + shift * 0.06 * b.depth)) * w;
      const cy = (b.y + (still ? 0 : Math.cos(t * b.sp * 0.8 + b.ph) * 0.05)) * h;
      const r = b.r * R;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.rot + (still ? 0 : t * b.rs));
      if (b.sec && mix < 1) {
        ctx.globalAlpha = b.a * (1 - mix);
        ctx.drawImage(b.prev, -r, -r, r * 2, r * 2);
        ctx.globalAlpha = b.a * mix;
      } else ctx.globalAlpha = b.a;
      ctx.drawImage(b.cur, -r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  // ---------- art: flat geometry, tints of the section accent ----------
  const tint = (p) => `color-mix(in srgb,var(--acc) ${p}%,var(--bg))`;
  const hero = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect x="46" y="96" width="300" height="236" rx="30" style="fill:${tint(7)}"/>
<rect x="30" y="76" width="300" height="236" rx="30" style="fill:var(--bg);stroke:${tint(30)}" stroke-width="3"/>
<rect x="58" y="104" width="86" height="12" rx="6" style="fill:${tint(34)}"/>
<rect x="58" y="126" width="54" height="10" rx="5" style="fill:${tint(18)}"/>
<g>
<rect class="bar" style="--k:0;fill:${tint(22)}" x="58" y="222" width="32" height="60" rx="9"/>
<rect class="bar" style="--k:1;fill:${tint(34)}" x="102" y="196" width="32" height="86" rx="9"/>
<rect class="bar" style="--k:2;fill:${tint(46)}" x="146" y="208" width="32" height="74" rx="9"/>
<rect class="bar" style="--k:3;fill:${tint(64)}" x="190" y="168" width="32" height="114" rx="9"/>
<rect class="bar" style="--k:4;fill:var(--acc)" x="234" y="136" width="32" height="146" rx="9"/>
</g>
<path class="trace" pathLength="1" d="M74 198L118 172L162 184L206 148L250 112" style="stroke:var(--text)" stroke-width="5"/>
<g style="fill:var(--bg);stroke:var(--text)" stroke-width="4"><circle class="pop" style="--k:1" cx="74" cy="198" r="7"/><circle class="pop" style="--k:2" cx="118" cy="172" r="7"/><circle class="pop" style="--k:3" cx="162" cy="184" r="7"/><circle class="pop" style="--k:4" cx="206" cy="148" r="7"/></g>
<circle class="pop" style="--k:5;fill:var(--text)" cx="250" cy="112" r="10"/>
<g class="pop" style="--k:2"><circle cx="316" cy="122" r="56" style="fill:var(--bg);stroke:none"/><circle cx="316" cy="122" r="42" style="stroke:${tint(20)}" stroke-width="18"/><path d="M316 80A42 42 0 1 1 274 122" style="stroke:var(--acc)" stroke-width="18"/></g>
<g class="pop" style="--k:4"><rect x="266" y="262" width="92" height="92" rx="26" style="fill:var(--acc)" transform="rotate(-8 312 308)"/><path d="M288 328L306 306L318 316L338 288M322 288H338V304" transform="rotate(-8 312 308)" style="stroke:var(--on-acc)" stroke-width="9"/></g>
<circle class="pop" style="--k:3;fill:${tint(30)}" cx="62" cy="352" r="16"/>
<circle class="pop" style="--k:4;fill:var(--acc)" cx="98" cy="366" r="7"/>
<rect x="124" y="350" width="104" height="12" rx="6" style="fill:${tint(22)}"/>
<rect x="124" y="372" width="64" height="10" rx="5" style="fill:${tint(12)}"/>
</svg>`;

  const chapter = `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect x="16" y="16" width="168" height="168" rx="42" style="fill:${tint(8)}"/>
<rect x="30" y="30" width="140" height="140" rx="34" style="stroke:${tint(30)}" stroke-width="3"/>
<circle class="pop" style="--k:0;stroke:${tint(30)}" cx="100" cy="100" r="54" stroke-width="14"/>
<path class="trace" pathLength="1" d="M100 46A54 54 0 0 1 154 100" style="stroke:var(--acc)" stroke-width="14"/>
<rect class="pop" style="--k:1;fill:var(--acc)" x="72" y="72" width="56" height="56" rx="16" transform="rotate(45 100 100)"/>
<circle class="pop" style="--k:2;fill:var(--bg)" cx="100" cy="100" r="11"/>
<circle class="pop" style="--k:3;fill:${tint(46)}" cx="160" cy="40" r="9"/>
</svg>`;

  const closing = `<svg viewBox="0 0 400 400" fill="none" stroke-linecap="round" stroke-linejoin="round">
<circle cx="236" cy="188" r="146" style="fill:${tint(7)}"/>
<circle class="pop" style="--k:0;fill:${tint(14)}" cx="236" cy="188" r="112"/>
<circle class="pop" style="--k:1;fill:${tint(28)}" cx="236" cy="188" r="76"/>
<circle class="pop" style="--k:2;fill:var(--acc)" cx="236" cy="188" r="38"/>
<circle class="pop" style="--k:3;fill:var(--bg)" cx="236" cy="188" r="12"/>
<g transform="translate(236 188) rotate(-41.4)">
<path class="trace" pathLength="1" d="M-214 0H-12" style="stroke:var(--text)" stroke-width="10"/>
<path d="M2 0L-34 -19L-24 0L-34 19Z" style="fill:var(--text);stroke:var(--text)" stroke-width="2"/>
<path d="M-196 0L-226 -26H-250L-224 0L-250 26H-226Z" style="fill:var(--acc);stroke:var(--acc)" stroke-width="2"/>
</g>
<circle cx="338" cy="60" r="12" style="fill:${tint(40)}"/>
<circle cx="372" cy="96" r="6" style="fill:var(--acc)"/>
<rect x="38" y="88" width="64" height="12" rx="6" style="fill:${tint(22)}"/>
<rect x="38" y="110" width="40" height="10" rx="5" style="fill:${tint(12)}"/>
</svg>`;

  const divider = `<svg viewBox="0 0 600 40" fill="none" stroke-linecap="round">
<path d="M0 20H268M332 20H600" style="stroke:var(--line)" stroke-width="2"/>
<circle cx="300" cy="20" r="7" style="fill:var(--acc)"/>
<circle cx="278" cy="20" r="3.5" style="fill:${tint(45)}"/><circle cx="322" cy="20" r="3.5" style="fill:${tint(45)}"/>
</svg>`;

  Deck.registerTheme({
    name: 'corporate',
    defaultTransition: 'glide',
    vocabulary: {
      map: 'Agenda', mapHint: 'Select a slide. Esc closes.', counter: '{n} / {N}', backupCounter: 'Appendix {L}',
      now: 'Current', next: 'Up next', notes: 'Speaker notes', timer: 'Elapsed', presenter: 'Presenter view',
      hint: '← → navigate · M agenda · P presenter · F full screen',
    },
    art: { hero, chapter, closing, divider },
    ambient: {
      init(api) { tintTo = rgb(api.accent(), brand); populate(api); },
      resize(api) { if (blobs.length) populate(api); },
      frame(api, t, dt) { draw(api, t, dt, false); },
      paint(api) { const c = rgb(api.accent(), tintTo); if (c[0] !== tintTo[0] || c[1] !== tintTo[1] || c[2] !== tintTo[2]) setTint(c); draw(api, 0, 0, true); },
      change(api, info) {
        const c = rgb(api.accent(), tintTo);
        if (c[0] !== tintTo[0] || c[1] !== tintTo[1] || c[2] !== tintTo[2]) { setTint(c); mix = 0; }
        if (info.from >= 0) shift = info.dir === 'back' ? -1 : 1;
      },
    },
  });
})();
