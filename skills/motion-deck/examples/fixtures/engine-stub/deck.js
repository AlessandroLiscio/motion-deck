// Stub of the runtime contract (references/contract.md section 6). It exists so the build and check scripts can be tested
// before the real engine does: it shows one slide at a time, applies steps and capture mode, and nothing more.
(() => {
  const slides = Array.from(document.querySelectorAll('#stage > .slide'));
  const config = JSON.parse(document.getElementById('deck-config').textContent);
  const stepsOf = (el) => Math.max(0, ...Array.from(el.querySelectorAll('[data-step],[data-step-out]')).map((e) => Math.max(+e.dataset.step || 0, +e.dataset.stepOut || 0)));
  const fit = () => {
    document.getElementById('stage').style.setProperty('--s', String(Math.min(innerWidth / 1600, innerHeight / 900)));
  };
  const D = (window.Deck = {
    version: 1,
    config,
    theme: { name: config.theme },
    token: Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join(''),
    count: slides.length,
    index: 0,
    step: 0,
    features: ['capture'],
    steps: (i = D.index) => stepsOf(slides[i]),
    registerTheme(t) { D.theme = t; },
    setStep(n) {
      D.step = Math.max(0, Math.min(n, D.steps()));
      slides[D.index].querySelectorAll('[data-step]').forEach((e) => e.classList.toggle('on', D.step >= +e.dataset.step));
      slides[D.index].querySelectorAll('[data-step-out]').forEach((e) => e.classList.toggle('off', D.step >= +e.dataset.stepOut));
      document.dispatchEvent(new CustomEvent('deck:step', { detail: { index: D.index, step: D.step, steps: D.steps() } }));
    },
    go(i, o = {}) {
      const from = D.index;
      D.index = Math.max(0, Math.min(i, slides.length - 1));
      slides.forEach((s, k) => s.classList.toggle('active', k === D.index));
      D.setStep(o.step ?? (i < from ? D.steps() : 0));
      document.dispatchEvent(new CustomEvent('deck:change', { detail: { index: D.index, from, step: D.step, dir: i < from ? 'back' : 'fwd', transition: 'none' } }));
    },
    next() { D.step < D.steps() ? D.setStep(D.step + 1) : D.index < D.count - 1 && D.go(D.index + 1); },
    prev() { D.step > 0 ? D.setStep(D.step - 1) : D.index > 0 && D.go(D.index - 1); },
    capture(on) {
      if (on !== undefined) document.documentElement.classList.toggle('capture', !!on);
      return document.documentElement.classList.contains('capture');
    },
    openMap: () => false,
    openPresenter: () => null,
    info: () => ({
      title: config.title, theme: config.theme, lang: config.lang || 'en', sections: [],
      slides: slides.map((s, index) => ({
        index, id: s.id, title: s.dataset.title || s.id, sec: s.dataset.sec || 'main', layout: s.dataset.layout || 'content',
        steps: stepsOf(s), backup: s.hasAttribute('data-backup'), notes: (s.querySelector('.notes') || {}).textContent || '', morph: [],
      })),
    }),
  });
  fit();
  addEventListener('resize', fit);
  if (/[?&]capture=1/.test(location.search)) D.capture(true);
  D.ready = document.fonts.ready.then(() => { D.go(0); return D; });
})();
