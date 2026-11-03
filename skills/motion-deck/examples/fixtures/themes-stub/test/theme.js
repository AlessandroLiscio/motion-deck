Deck.registerTheme({
  name: 'test',
  vocabulary: {},
  art: {
    hero: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="currentColor"/></svg>',
    chapter: '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="currentColor"/></svg>',
    closing: '<svg viewBox="0 0 100 100"><path d="M10 90 50 10 90 90z" fill="currentColor"/></svg>',
    divider: '<svg viewBox="0 0 100 10"><rect width="100" height="4" y="3" fill="currentColor"/></svg>',
  },
  ambient: { init() {}, frame() {}, paint() {}, change() {}, resize() {} },
});
