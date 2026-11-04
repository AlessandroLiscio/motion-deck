// node --test scripts/tests/lint.test.mjs
// The lints are pure functions over measured data (contract 10, Lints), so they are tested without a browser.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LIMITS, lintAccents, lintContent, lintPace, lintType, summarize } from '../lib/lint.mjs';
import { contrast } from '../lib/measure.mjs';

const slide = (over = {}) => ({ index: 0, layout: 'content', backup: false, title: 'A claim', titleWords: 2, words: 12, lists: [], imgsNoAlt: 0, hasNotes: true, notesWords: 60, hasSource: false, ...over });
const codes = (slides, opts = { lang: 'en' }) => lintContent(slides, opts).map((w) => w.code);

describe('lintContent', () => {
  test('a clean slide has no warning', () => {
    assert.deepEqual(codes([slide()]), []);
  });
  test('each limit warns just above itself and not at it', () => {
    assert.deepEqual(codes([slide({ words: LIMITS.words })]), []);
    assert.deepEqual(codes([slide({ words: LIMITS.words + 1 })]), ['W_WORDS']);
    assert.deepEqual(codes([slide({ lists: [{ items: 5, maxWords: 12 }] })]), []);
    assert.deepEqual(codes([slide({ lists: [{ items: 6, maxWords: 13 }] })]), ['W_LIST_LEN', 'W_LIST_ITEM']);
    assert.deepEqual(codes([slide({ titleWords: 11 })]), ['W_TITLE_LEN']);
    assert.deepEqual(codes([slide({ imgsNoAlt: 2 })]), ['W_IMG_ALT']);
  });
  test('notes: missing, short, long, and the 40 and 90 edges', () => {
    assert.deepEqual(codes([slide({ hasNotes: false, notesWords: 0 })]), ['W_NOTES_MISSING']);
    assert.deepEqual(codes([slide({ notesWords: 39 })]), ['W_NOTES_LEN']);
    assert.deepEqual(codes([slide({ notesWords: 91 })]), ['W_NOTES_LEN']);
    assert.deepEqual(codes([slide({ notesWords: 40 }), slide({ index: 1, layout: 'split', notesWords: 90 })]), []);
  });
  test('a stats slide needs a source; other layouts do not', () => {
    assert.deepEqual(codes([slide({ layout: 'stats' })]), ['W_STAT_SOURCE']);
    assert.deepEqual(codes([slide({ layout: 'stats', hasSource: true })]), []);
  });
  test('the same layout three in a row warns once per run, at its first slide', () => {
    const three = [0, 1, 2].map((index) => slide({ index }));
    assert.deepEqual(lintContent(three, { lang: 'en' }).map((w) => [w.code, w.slide]), [['W_LAYOUT_RUN', 1]]);
    const five = [0, 1, 2, 3, 4].map((index) => slide({ index }));
    assert.equal(lintContent(five, { lang: 'en' }).length, 1);
    const two = [slide({ index: 0 }), slide({ index: 1 }), slide({ index: 2, layout: 'split' })];
    assert.deepEqual(codes(two), []);
  });
  test('a missing lang is a deck-level warning', () => {
    const w = lintContent([slide()], { lang: ' ' });
    assert.deepEqual(w.map((x) => [x.code, x.slide]), [['W_LANG', null]]);
  });
});

describe('lintType', () => {
  const sample = (tier, px, selector = 'p', slide = 1) => ({ tier, px, selector, slide });
  test('floors per tier: warning below warn, error below error', () => {
    const r = lintType([sample('body', 29), sample('body', 19, 'li'), sample('compact', 23, 'p.card'), sample('label', 15, 'p.kicker'), sample('label', 13, 'th'), sample('body', 30, 'h2')]);
    assert.deepEqual(r.warnings.map((w) => w.message.split(' ')[0]), ['p', 'p.card', 'p.kicker']);
    assert.deepEqual(r.errors.map((e) => e.selector), ['li', 'th']);
  });
  test('one entry per selector and size, with the slides it appears on', () => {
    const r = lintType([sample('body', 25, 'p', 2), sample('body', 25, 'p', 5), sample('body', 25, 'p', 9), sample('body', 25, 'p', 11)]);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].message, /slides 2, 5, 9 and 1 more/);
  });
});

describe('lintAccents', () => {
  const bg = '#ffffff';
  test('a theme accent under 3:1 is an error, a deck accent a warning', () => {
    const accents = { a1: '#ffee00', a2: '#005599' };
    const own = new Set(['a2']);
    const r = lintAccents(accents, bg, contrast, own);
    assert.equal(r.errors.length, 0);
    assert.deepEqual(r.warnings.map((w) => w.code), ['W_ACCENT_CONTRAST']);
    assert.equal(lintAccents(accents, bg, contrast, new Set(['a1', 'a2'])).errors.length, 1);
  });
});

test('summarize counts per code in first-seen order', () => {
  assert.equal(summarize([{ code: 'W_B' }, { code: 'W_A' }, { code: 'W_B' }]), 'W_B 2, W_A 1');
});

describe('lintPace', () => {
  const s = (index, notesWords, over = {}) => ({ index, backup: false, notesWords, minutes: null, ...over });
  test('off without --wpm', () => {
    assert.deepEqual(lintPace([s(0, 900)], { wpm: 0, duration: 1 }), []);
  });
  test('total notes against the duration: over, under and within', () => {
    const slides = [s(0, 650), s(1, 650)]; // 1300 words at 130 wpm = 10 min
    assert.deepEqual(lintPace(slides, { wpm: 130, duration: 10 }), []);
    assert.match(lintPace(slides, { wpm: 130, duration: 8 })[0].message, /about 10 min at 130 words per minute, over the 8 min plan/);
    assert.match(lintPace(slides, { wpm: 130, duration: 20 })[0].message, /well under the 20 min plan/);
  });
  test('a slide with data-minutes warns when its notes need much longer; backup slides never count', () => {
    const w = lintPace([s(0, 260, { minutes: 1 }), s(1, 100, { minutes: 1 }), s(2, 5000, { backup: true })], { wpm: 130, duration: 0 });
    assert.deepEqual(w.map((x) => [x.code, x.slide]), [['W_PACE', 1]]);
  });
});
