// Presenter probe (contract section 11): trusted P opens a popup, the two windows follow each other, and two decks never cross-talk.
import { fail, reset, same, sleep, titleIndex, until, untilNode } from './probe-kit.mjs';

const POPUP_STATE = `JSON.stringify({ title: document.title, count: (document.querySelector('#p-count') || {}).textContent || '',
  notes: (document.querySelector('#p-notes') || {}).textContent || '', frames: document.querySelectorAll('iframe').length,
  index: (document.querySelector('#p-current') || { dataset: {} }).dataset.index, step: (document.querySelector('#p-current') || { dataset: {} }).dataset.step,
  next: (document.querySelector('#p-next') || { dataset: {} }).dataset.index })`;
const popupState = async (pop) => JSON.parse(await pop.evaluate(POPUP_STATE));
const deckState = (page) => page.evaluate('({ index: Deck.index, step: Deck.step, token: Deck.token })');

// Presses P in the opener (a trusted key: a synthetic event cannot open a popup) and attaches to the new window.
async function openPopup(client, opener) {
  const known = new Set((await client.targets()).map((t) => t.targetId));
  await opener.send('Page.bringToFront');
  await opener.key('p');
  const info = await untilNode(async () => (await client.targets()).find((t) => !known.has(t.targetId) && t.openerId === opener.targetId), { what: 'P to open a popup window' });
  const pop = await client.attach(info.targetId);
  await pop.send('Runtime.enable');
  await until(pop, `document.title.startsWith('Presenter') && document.querySelectorAll('iframe').length === 2`, { what: 'the presenter title and two preview frames', timeout: 8000 });
  return pop;
}

const pressInPopup = async (pop, name) => {
  await pop.send('Page.bringToFront');
  await pop.key(name);
};

export async function presenter({ client, file, open }) {
  const a = await open();
  await reset(a, 1);
  const stateA = await deckState(a);
  const notes = await a.evaluate('Deck.info().slides[1].notes');
  const popA = await openPopup(client, a);

  const s0 = await popupState(popA);
  if (!s0.count) fail('#p-count is empty');
  if (!s0.notes.trim() || !s0.notes.includes(notes.trim().slice(0, 15))) fail(`#p-notes does not show the slide notes (got "${s0.notes.slice(0, 40)}")`);
  same([s0.index, s0.step, s0.next], ['1', '0', '1'], '#p-current index, step and #p-next index at the start');

  await a.evaluate('Deck.next()');
  await until(popA, `document.querySelector('#p-current').dataset.step === '1'`, { what: 'the popup to follow Deck.next()' });

  await pressInPopup(popA, 'ArrowRight');
  await until(a, 'Deck.step === 2', { what: 'ArrowRight in the popup to advance the opener' });

  // close it from inside, then P again: a new window with the current state
  await popA.evaluate('window.close()').catch(() => {});
  await untilNode(async () => !(await client.targets()).some((t) => t.targetId === popA.targetId), { what: 'the popup to close' });
  const popA2 = await openPopup(client, a);
  const now = await deckState(a);
  const s2 = await popupState(popA2);
  same([s2.index, s2.step], [String(now.index), String(now.step)], 'recreated popup state against the deck');

  // a slide with diagram builds: the Next preview shows the diagram one step ahead of the current preview
  await reset(a, await titleIndex(a, 'Diagrams'));
  const shown = `(() => { const n = (sel) => { const f = document.querySelector(sel + ' iframe'); const d = f && f.contentDocument; return d ? d.querySelectorAll('svg[data-diagram] .md-el:not(.md-hid)').length : 0; };
    const cur = n('#p-current'), next = n('#p-next'); return cur > 0 && next > cur ? [cur, next] : false; })()`;
  await until(popA2, shown, { what: 'the Next preview to show more diagram elements than the current preview', timeout: 6000 });

  // two decks, two popups: a command from one moves only its own deck
  const b = await open();
  await reset(b, 1);
  const stateB = await deckState(b);
  if (stateB.token === stateA.token) fail('two decks share one token');
  const popB = await openPopup(client, b);
  const bBefore = await deckState(b);
  const aBefore = await deckState(a);
  await pressInPopup(popA2, 'ArrowRight');
  await until(a, `Deck.step !== ${aBefore.step} || Deck.index !== ${aBefore.index}`, { what: 'deck A to advance from its own popup' });
  await sleep(400);
  same(await deckState(b), bBefore, 'deck B after a command from deck A\'s popup');
  const aMid = await deckState(a);
  await pressInPopup(popB, 'ArrowRight');
  await until(b, `Deck.step !== ${bBefore.step} || Deck.index !== ${bBefore.index}`, { what: 'deck B to advance from its own popup' });
  await sleep(400);
  same(await deckState(a), aMid, 'deck A after a command from deck B\'s popup');

  await Promise.all([popA2, popB].map((p) => p.closeTarget()));
  return 'popup state, both directions, close and reopen, diagram preview one step ahead, two decks apart';
}
