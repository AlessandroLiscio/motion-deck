# Authoring a deck

You write one file, `decks/<slug>/deck.src.html`: a config block, an optional `<style>` block and a list of `<section class="slide">` elements. No `<html>`, `<head>` or `<body>`. The build adds the engine, the theme, fonts and images. Exact rules are in `contract.md` section 2; this page is the working cheat sheet.

## File shape

```html
<script type="application/json" id="deck-config">
{ "title": "Why we ship on Fridays", "lang": "en", "theme": "space", "sections": [{ "id": "why", "label": "Why" }], "timer": 15 }
</script>
<style>/* optional, deck-specific, tokens only */</style>
<section class="slide" data-layout="title" data-sec="why">…</section>
<section class="slide" data-sec="why">…</section>
```

The config comes first, then the `<style>` blocks, then the slides; anything else at the top level fails the build. The build fails on a missing `title`, an unknown theme, a remote URL and an image over 2 MB, and tells you the line.

## Config

| Key | Use |
|---|---|
| `title` | required; the tab title and the default title slide text |
| `theme` | `space`, `editorial`, `neon`, `corporate`, `fantasy`, `pirates` or `pipboy` |
| `lang` | language code of the text (`en`, `it`, `fr`…); sets number formatting for counters |
| `accent` | one `#rrggbb` color; the corporate theme uses it as its brand color, other themes may ignore it |
| `transition` | one transition for the whole deck (`slide`, `fade`, `rise`, `zoom`, `none`, or a theme transition) |
| `sections` | ordered list of `{ "id", "label", "accent" }`; `accent` is 1 to 6; the list order is the map order. A `data-sec` missing here is created with its id as label |
| `vocabulary` | translate or rename the HUD words (below) |
| `timer` | presenter timer target in minutes (default 20) |
| `duration` | planned length of the talk in minutes; the presenter window shows a progress bar and whether you are ahead or behind the plan (default: `timer`, else 20) |
| `ambient` | `"off"` starts with the moving background and the looping art paused (the audience or the presenter can resume with `.`); default `"on"` |
| `subtitle`, `author`, `event`, `date`, `description` | free text; `description` becomes the meta description |

Vocabulary keys: `map` (map title), `mapHint`, `counter` (a template, `{n}` and `{N}`), `backupCounter` (`{L}` is the letter), `section` (prefix before a section name in the HUD), `now`, `next`, `notes`, `timer`, `presenter` (the presenter window), `hint` (the line shown at start), `rotate`, `ambient` (the pause button), `help`, `helpClose`, `jump`, `keyMove`, `keyMap`, `keyPresenter`, `keyFull`, `keyBlackout`, `keyAmbient`, `keyJump`, `keyHelp` (the key help). Every theme brings flavoured defaults in English, so a deck in another language translates all of them. Example for Italian: `{ "map": "Mappa", "mapHint": "Scegli una slide. Esc chiude.", "counter": "{n} / {N}", "backupCounter": "Extra {L}", "now": "In scena", "next": "Prossima", "notes": "Note", "timer": "Tempo", "presenter": "Relatore", "hint": "Frecce per muoversi · M mappa · P relatore · F schermo intero" }`.

## A slide

```html
<section class="slide" data-layout="content" data-sec="why" data-title="Short name for the map">
  <p class="kicker">Small label above the title</p>
  <h2>The claim, in at most ten words</h2>
  …content…
  <aside class="notes">What you say, in your own words.</aside>
</section>
```

| Attribute | Meaning |
|---|---|
| `data-layout` | one of the layouts below; default `content` |
| `data-sec` | the section (chapter) the slide belongs to; it sets the accent color and the HUD label; default the previous slide's |
| `data-title` | name in the map and the HUD; default the first `h1` or `h2` text |
| `data-minutes` | planned minutes for this slide; the slides without it share the rest of `duration` equally |
| `data-transition` | transition used when entering this slide, or `none` |
| `data-anim` | entrance style for the children: `rise` (default), `fade`, `left`, `right`, `zoom`, `pop`, `none` |
| `data-backup` | appendix slide, numbered A, B, C after the last normal slide |

## Layouts

| `data-layout` | Put inside | Notes |
|---|---|---|
| `title` | `.kicker`, `h1`, `p.lead`, `p.meta` with `span`s, `div data-art="hero"` | first slide |
| `chapter` | `.kicker` ("Part 2"), `h2`, `p.lead`, `div data-art="chapter"` | opens a section; the art is optional |
| `statement` | `.kicker`, `p.big`, `.attrib` | one sentence, 12 words at most |
| `content` | `.kicker`, `h2`, then `ul`, `ol`, `p`, `.callout`, `figure` or `.cols` | the default; keep it to one block under the title |
| `split` | `.kicker`, `h2`, `div.cols` with two `div.col` | `.cols.wide-l` is 60/40, `.cols.wide-r` is 40/60 |
| `diagram` | `.kicker`, `h2`, `svg[data-diagram]` with its JSON spec | see `diagrams.md` |
| `stats` | `.kicker`, `h2`, `div.stats` with 2 to 4 `div.stat` of `span.num` and `span.label`, `p.source` | `.num` is short: `42`, `3.2x`, `98%`; the source line names where the figures come from |
| `quote` | `blockquote > p`, `cite` | |
| `code` | `.kicker`, `h2`, `pre.code[data-lang]`, `p.note` | 14 lines at most; `data-hl="2-4,7"` highlights lines |
| `cards` | `.kicker`, `h2`, `div.cards` with 2 to 4 `div.card` of `h3`, `p`, optional `.chip` | |
| `timeline` | `.kicker`, `h2`, `ol.timeline` with 3 to 6 `li`, each starting with `<b>label</b>` | |
| `image` | `figure > img` and `figcaption` | local file in `assets/`; `data-bleed` lets it leave the margins |
| `closing` | `h1` or `h2`, `p.lead`, `p.links` with anchors, `div data-art="closing"` | last slide |
| `blank` | anything | only the safe margins apply |

Helpers inside any layout: `.muted`, `.small`, `strong` (accent color), `em`, `code`, `a`, `.chip`, `.callout`, `table.data`, `.row` (flex row), `.stack` (flex column), `.center`, `.grow`, `.cols` and `.col`. Inline styles are fine for a width (`style="width: 640px"`); avoid anything else.

## Builds

`data-step="1"` hides an element until the first press, `data-step="2"` until the second, and so on; the next slide comes after the last step. Steps work on any element: a list item, a card, a column, an image, a diagram part (diagrams define their own steps). `data-step-out="2"` hides an element from step 2, so a replacement with `data-step="2"` takes its place when both sit in one `.swap` container:

```html
<div class="swap">
  <div class="card" data-step-out="1"><h3>Before</h3><p>Manual releases.</p></div>
  <div class="card" data-step="1"><h3>After</h3><p>One button.</p></div>
</div>
```

Print and the PDF show every step in its final state.

## Counters

`<span class="num" data-count="1200" data-prefix="€" data-suffix="k" data-decimals="1">1,200</span>` counts up from 0 when the slide (or its step) appears. The text inside is the final value, shown in print and with reduced motion; write it the way it should read.

## Morph

Give the same `data-morph="key"` to one element on two consecutive slides. Moving from the first to the second, that element glides and resizes into the other one while everything else cross-fades. The two elements should have the same kind of content (a card, a figure, a number). Keys are lowercase words and dashes, unique inside a slide.

## Art, images, code

`<div data-art="hero"></div>` is filled by the theme with its own illustration. Roles: `hero` (title slide), `chapter`, `closing`, `divider`, `mascot`. Position and size come from the layout; override in the deck `<style>` when needed. Add `data-alt="…"` to describe it for screen readers.

Starter decks: `new.mjs <slug> --template <kind>` copies `examples/<kind>.src.html` (`pitch`, `quarterly-review`, `tech-talk`, `workshop`, `lesson`, `keynote`) with real sample content and the structure of that kind of talk; replace the content, keep the shape, and keep the `.source` lines honest.

`<img src="assets/chart.png" alt="…">` is inlined by the build; the path is relative to the source file. Allowed: svg, png, jpg, webp, gif, avif; over 300 KB warns; over 2 MB fails. Remote images and fonts fail the build: decks work offline.

`<pre class="code" data-lang="js" data-hl="3">…</pre>`: write `<` as `&lt;` and `&` as `&amp;`. Highlighting is light: comments, strings, numbers and calls in every language, plus keyword lists for js (and ts), python, sh, sql, yaml and json. The font shrinks to fit; keep it under 14 lines of 60 characters.

## Notes and backup slides

`<aside class="notes">…</aside>` inside a slide is never shown on the slide; the presenter window shows it. Backup slides (`data-backup`) hold answers to questions you expect; they are reachable from the map and by arrow keys after the last slide.

Citations: `<p class="source">Source: Annual report 2025, p. 14.</p>` is a footnote that sits at the bottom of the slide. Put one on every slide that shows a figure, a quote or a claim taken from the user's material, and a closing slide that lists the sources when there are more than three. Never write a figure the material does not contain.

## Custom CSS

Rarely needed. Put it in one `<style>` block right after the config, use only theme tokens, and keep it small: `var(--a1)` to `var(--a6)` (accents), `var(--acc)` (the current section accent), `var(--text)`, `var(--muted)`, `var(--bg)`, `var(--panel)`, `var(--line)`, `var(--radius)`, `var(--gap)`, `var(--f-display)`, `var(--f-body)`, `var(--f-mono)`. A literal color breaks other themes.

## Stage and safe area

Slides live on a 1600 by 900 stage. Content must stay inside the margins (120 px left and right, 84 px top, 96 px bottom); the check reports any box that leaves them. Long words in big titles are the usual cause: shorten the title, or split the slide.

| Where | Budget |
|---|---|
| title (`h2`) | 10 words, 2 lines at most |
| `statement` | 12 words |
| list | 5 items of 12 words; 3 to 4 when each wraps |
| `card` | title of 3 words, text of 25 words |
| `stat` label | 8 words |
| `timeline` | 5 items of 12 words |
| `quote` | 25 words |
| code | 14 lines of 60 characters |

## Common mistakes

- Putting two ideas on one slide. Split it, or reveal the second with a step.
- Writing the full talk on the slides. The slide is the headline, the notes are the talk.
- Literal colors and sizes in custom CSS. Use the tokens.
- Editing the built `index.html`. Edit the source and rebuild.
- Forgetting `lang` and `vocabulary` for a deck that is not in English.
- A figure with no `.source` line, or a figure the user's material does not contain.
- Ignoring the `warn lint` line of the check: it names too many words, long lists, a layout three times in a row, missing or off-length notes and images without `alt`.
- Using `data-anim` on everything. The default entrance is already tuned for the theme.
