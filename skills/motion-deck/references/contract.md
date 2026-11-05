# motion-deck contract, version 1

This file is the single source of truth between the engine, the build and check scripts, the diagram language and the themes. Anything not written here is not promised. If a piece needs a change here, the piece's author asks the owner of this file (the main session) and does not edit it. Words MUST, SHOULD and MAY are used in the usual sense.

All sizes are in stage pixels: the stage is a fixed 1600 by 900 box that the runtime scales to the window. Paths are relative to the skill root `skills/motion-deck/` unless they start with `/`.

## 1. Layout of the skill

| Path | What | Owner |
|---|---|---|
| `SKILL.md`, `references/*.md` | workflow and guides (this file is `references/contract.md`) | main session |
| `engine/deck.css`, `engine/deck.js` | runtime: stage, layouts, motion, navigation, chrome, ambient loop, presenter, morph | main session |
| `engine/diagram.js`, `references/diagrams.md` | diagram and chart language | diagram helper |
| `themes/<name>/theme.json`, `theme.css`, `theme.js` | one theme | see the wave plan |
| `themes/_shared/fonts/` | `fonts.json` registry, `<id>/*.woff2`, `<id>/OFL.txt` (already fetched by `/tools/fetch-fonts.mjs`) | main session |
| `scripts/new.mjs`, `build.mjs`, `lib/` build side (`lib/watch.mjs` is the dev server of `build.mjs --watch`) | scaffold and build | build helper |
| `scripts/doctor.mjs` | install check (section 10, Doctor) | check helper |
| `agents/deck-reviewer.md` (repository root, registered in `.claude-plugin/plugin.json`) | reviewer agent for a finished deck (section 10, Reviewer) | main session |
| `scripts/check.mjs`, `selftest.mjs`, `lib/` check side | headless check and selftest | check helper |
| `templates/deck.src.html` | starter source | main session |
| `examples/showcase.src.html`, `examples/dev.html`, `examples/fixtures/` | showcase deck, dev page, test inputs | main session (fixtures: anyone adds files under their own subfolder) |
| `examples/<kind>.src.html` for `pitch`, `quarterly-review`, `tech-talk`, `workshop`, `lesson`, `keynote` | starter decks with real content, used by `new.mjs --template` and built and checked by the selftest (the kinds are listed in `scripts/lib/templates.mjs`) | main session |

Node 24 is the only runtime for scripts. Scripts MUST NOT need `npm install`: only Node built-ins, the Chrome or Edge already on the machine, and files in this repository. Scripts follow the quiet-scripts rule: one status line per stage, a final `PASS` or `FAIL` line, full output in logs under `tmp/reports/<script>/`, at most 5 excerpt lines on failure.

## 2. The deck source (`deck.src.html`)

A UTF-8 file that is a fragment (no `<html>`, `<head>` or `<body>`). Top level, in this order:

1. Exactly one `<script type="application/json" id="deck-config">…</script>`.
2. Zero or more `<style>…</style>` blocks (deck-specific CSS, inlined after the theme CSS).
3. One or more `<section class="slide">…</section>` elements (never nested).

Comments and whitespace may sit between them. Any other top-level element is a build error `E_SOURCE`.

### 2.1 Config

```json
{
  "title": "Required, shown in the tab and the title slide",
  "subtitle": "", "author": "", "event": "", "date": "",
  "lang": "en",
  "theme": "space",
  "accent": "#2a7fff",
  "transition": "warp",
  "sections": [{ "id": "open", "label": "Opening", "accent": 1 }],
  "vocabulary": { "map": "Chapters" },
  "description": "meta description",
  "timer": 20,
  "duration": 20,
  "ambient": "on"
}
```

| Key | Rule |
|---|---|
| `title` | required, non-empty string, else `E_CONFIG` |
| `theme` | one of the directory names under `themes/` (not `_shared`), default `space`, else `E_THEME` |
| `lang` | BCP 47 tag, written to `<html lang>`, used for number formatting, default `en` |
| `accent` | optional `#rgb` or `#rrggbb`; replaces `--a1` and the values derived from it (themes MAY ignore it; the corporate theme uses it as its brand color) |
| `transition` | optional transition name that overrides the theme default for the whole deck |
| `sections` | optional list; order defines the map order; `accent` is 1 to 6 (index of `--a1` to `--a6`); a section used by a slide but missing here is created from its `data-sec` (label = id with the first letter capitalised) with the next free accent, cycling |
| `vocabulary` | optional partial override of the theme vocabulary (section 8.4) |
| `timer` | presenter timer target in minutes, default 20; superseded by `duration` when both are set |
| `duration` | planned length of the talk in minutes (a positive number); the presenter window plans the slides against it (section 11); default: `timer`, else 20 |
| `ambient` | `"on"` (default) or `"off"`: whether the moving background and the looping art run at load (5.8); anything else is `E_CONFIG` |
| unknown keys | warning `W_CONFIG_KEY`, ignored |

### 2.2 Slide element

`<section class="slide" data-layout="…" data-sec="…" data-title="…">`

| Attribute | Meaning |
|---|---|
| `id` | optional, otherwise the build assigns `s<n>` (1-based) |
| `data-layout` | one of the layouts in 2.3, default `content` |
| `data-sec` | section id; default the previous slide's section, for the first slide `main` |
| `data-title` | short title for the map and the HUD; default the text of the first `h1` or `h2`, else `Slide <n>` |
| `data-transition` | transition used when this slide is entered: a name from 5.5 or `none` |
| `data-anim` | default entrance for the children of this slide (5.1) |
| `data-minutes` | planned minutes for this slide (a positive number); slides without it share the rest of `duration` equally; anything else is ignored (section 11) |
| `data-backup` | present: the slide is an appendix slide, numbered A, B, C and listed after the last normal slide in the map |
| `aside.notes` | speaker notes (plain text or simple inline HTML); never shown on the slide |

Elements anywhere in a slide MAY carry: `data-step`, `data-step-out` (5.3), `data-count` and its companions (5.4), `data-morph` (5.6), `data-anim`, `data-delay` (5.1), `data-art` (2.5), `data-bleed` (marks decoration that is allowed to leave the safe area, see 10).

The build adds nothing else to slides except `id`, `data-title` and `data-sec` defaults. The runtime adds the classes listed in section 12.

### 2.3 Layouts (the authoring vocabulary)

Each layout is a flex or grid arrangement provided by `engine/deck.css`, styled only through tokens. `…?` means optional.

| `data-layout` | Expected children |
|---|---|
| `title` | `.kicker?`, `h1`, `p.lead?`, `.meta?` (author, event, date), `[data-art="hero"]?` |
| `chapter` | `.kicker?` (for example "Part 2"), `h2`, `p.lead?`, `[data-art="chapter"]?` |
| `statement` | `.kicker?`, `p.big` or `h2.big`, `.attrib?` |
| `content` (default) | `.kicker?`, `h2`, then free content: `ul`, `ol`, `p`, `.callout`, `figure`, `.cols` |
| `split` | `.kicker?`, `h2`, `.cols` with two `.col`; `.cols.wide-l` is 60/40 and `.cols.wide-r` is 40/60 |
| `diagram` | `.kicker?`, `h2`, `svg[data-diagram]` (fills the rest), `figcaption?` |
| `stats` | `.kicker?`, `h2`, `.stats` with 2 to 4 `.stat` each holding `.num` and `.label` |
| `quote` | `blockquote` (with `p`), `cite?` |
| `code` | `.kicker?`, `h2`, `pre.code[data-lang]`, `.note?` |
| `cards` | `.kicker?`, `h2`, `.cards` with 2 to 4 `.card` each holding `h3` and `p` (and `.chip?`) |
| `timeline` | `.kicker?`, `h2`, `ol.timeline` with 3 to 6 `li`, each starting with `<b>` for the label |
| `image` | `figure` holding `img` and `figcaption?`; the image MAY carry `data-bleed` |
| `closing` | `h1` or `h2`, `p.lead?`, `.links?` (anchors; a sources list is a `ul` of anchors or plain lines, one per source), `[data-art="closing"]?` |
| `blank` | anything; no padding rules besides the safe area |

`p.source` is the citation footnote: one short line ("Source: name, year") at the bottom of the slide, in the mono font and the muted color, inside the safe area (it takes the free space under the content with `margin-top: auto`). A figure on a slide comes from the user's material and its `.source` names that material; the `stats` layout expects one (lint `W_STAT_SOURCE`, section 10).

Shared elements: `.kicker` (small uppercase label in the accent), `h1`, `h2`, `h3`, `p.lead`, `p.big`, `.muted`, `.small`, `strong` (accent weight), `em`, inline `code`, `a`, `.chip`, `.callout`, `.cols`, `.col`, `.cards`, `.card`, `.stats`, `.stat`, `.num`, `.label`, `.source`, `ul`, `ol`, `table.data`, `figure`, `figcaption`, `.swap`, `.row`, `.stack`, `.center`.

### 2.4 Assets

`<img src="assets/x.png">` and CSS `url(assets/x.png)` inside the deck's own `<style>` blocks, with a path relative to the source file, are inlined as data URIs by the build. Allowed types: svg, png, jpg, jpeg, webp, gif, avif. A file over 300 KB is a warning `W_ASSET_SIZE`, over 2 MB an error `E_ASSET_SIZE`. A remote URL (`http:`, `https:`, `//`) in `src`, `href` of a stylesheet, `url()` or `@import` is an error `E_REMOTE` (decks work offline). Plain anchors `<a href="https://…">` are allowed.

### 2.5 Art slots

An element with `data-art="<role>"` and no children is filled at boot with the theme's SVG for that role. Roles: `hero`, `chapter`, `closing`, `divider`, `mascot`. A theme MUST provide the first four. The element gets the class `art`; give it `data-alt="description"` to expose it to screen readers, otherwise it is `aria-hidden`. The author controls position and size with normal layout (a grid cell, a flex child, or `position:absolute` in the deck's own `<style>`).

## 3. Slide numbering and sections

The runtime numbers normal slides 1 to N and backup slides A, B, C. Each distinct `data-sec` becomes a section; sections are shown in the order of `sections` (config) and then of first appearance. Each slide receives the style `--acc: var(--a<k>)` for its section's accent index k.

## 4. Stage

`#stage` is 1600 by 900 stage pixels, centred in the window, scaled by `--s = min(innerWidth / 1600, innerHeight / 900)`. Safe area of content: left and right `--pad-x` (120), top `--pad-y` (84), bottom `--pad-b` (96). The HUD and track live outside the stage in window coordinates and never count as content.

## 5. Motion

### 5.1 Entrance cascade

On slide activation the runtime has already tagged (once, at boot) the following elements with the class `a` and the style `--i: <n>` (n = order among tagged elements, capped at 18): `.kicker, h1, h2, h3, h4, p, li, blockquote, cite, figure, pre.code, .card, .stat, .chip, .callout, .meta, .links > *, .attrib, table.data, [data-art], svg[data-diagram], img`. An element is NOT tagged when it sits inside another tagged element, inside an `svg`, inside `[data-step]`, when it is itself `[data-step]`, `[data-morph]` or `[data-anim="none"]`, or when it is inside such an element with `data-anim="none"`.

CSS plays `.slide.play .a { animation: var(--a-name, aIn) var(--a-dur) var(--ease) both; animation-delay: calc(var(--i) * var(--a-stagger) + var(--a-base) + var(--d, 0ms)); }`. The keyframes read `--ax`, `--ay`, `--as`, `--ab` (start x, y, scale, blur) so a theme changes the flavour with variables.

`data-anim` (on an element, or on the slide as the default for its children): `rise` (default), `fade`, `left`, `right`, `zoom`, `pop`, `none`. The runtime turns it into the class `a-<value>`. `data-delay="300"` adds 300 ms (written as `--d`).

### 5.2 Replaying

Entering a slide removes `play`, forces a reflow, then adds `play`, so the cascade always restarts. Going back shows the target slide complete (`showAll`, class `instant`) with every step on and no entrance.

### 5.3 Steps (builds)

`data-step="n"` (integer n >= 1): the element is hidden (`visibility:hidden; opacity:0`, space kept) until the slide step reaches n, then it gets the class `on` and plays its entrance again (twin keyframes `aIn2` so the animation restarts). `data-step-out="m"`: from step m on the element gets the class `off` (hidden, space kept, fades). An element MAY carry both. `.swap` is a grid that stacks all its children in one cell so that a `data-step-out` element and its `data-step` replacement trade places.

The step count of a slide is the largest n or m found in its elements and in its diagrams (section 9). Navigation: `next()` raises the step before moving to the next slide; `prev()` lowers it, and when the step is 0 it goes to the previous slide with all steps on. The final state of a slide is "step = steps": every `data-step` element is `on`, every `data-step-out` element is `off`. Print and capture use this final state unless a step is asked for explicitly.

### 5.4 Counters

`<span class="num" data-count="1200" data-prefix="€" data-suffix="k" data-decimals="1" data-dur="1400">1,200</span>`: the text inside is the authored final value (what print, capture and no-motion show). On slide activation (or on the element's step) the runtime counts from 0 to `data-count` using `Intl.NumberFormat(lang)` with `data-decimals` fraction digits (default: the number of decimals in `data-count`).

### 5.5 Transitions

Resolution: slide `data-transition`, else config `transition`, else the theme's `defaultTransition`, else `slide`. Under reduced motion, `instant` navigation and hash jumps the name is `none`. The engine provides `slide`, `fade`, `rise`, `zoom`, `none`; a theme adds more and lists them in `theme.json`.

While a transition runs, `#stage` carries `data-tr="<name>"` and `data-dir="fwd"` or `"back"`, the entering slide has the class `entering` and the leaving slide the class `leaving`; both are displayed and absolutely stacked. A transition is pure CSS on `#stage[data-tr="<name>"] .slide.entering` and `… .slide.leaving` (and `[data-dir="back"]` variants), animating only `opacity`, `transform`, `filter`, `clip-path`. Its length is the custom property `--tr-dur` on `#stage` (default `600ms`); when it ends the runtime removes both classes and `data-tr`. A new navigation during a transition finishes the previous one at once. The theme's ambient layer is told through its `change` hook (8.5).

### 5.6 Morph

`data-morph="key"` (lowercase letters, digits, dashes; unique inside a slide) marks an element that should glide and resize into the element with the same key on the slide being entered. When the two slides share at least one key, `document.startViewTransition` exists and motion is allowed, the runtime gives both elements `view-transition-name: md-<key>` for the duration, runs the slide switch inside `document.startViewTransition`, and removes the names afterwards. `::view-transition-group(md-*)` lasts `calc(var(--tr-dur) * 1.2)` with `var(--ease)`. Everything else uses the normal crossfade. Without the API, or under reduced motion, the normal transition of 5.5 is used. Morph elements are never tagged for the entrance cascade. Observable by tests: `document.getAnimations()` contains animations whose `effect.pseudoElement` is `::view-transition-group(md-<key>)`.

### 5.7 Reduced motion, capture, print

* `prefers-reduced-motion: reduce`: no entrance, no transition, no counting, ambient paints one static frame, steps appear without animation.
* Capture mode (`Deck.capture(true)`, or `?capture=1` in the URL at load): the class `capture` is set on `<html>`; CSS sets `animation: none !important; transition: none !important` for everything under `#stage`; ambient paints one static frame and stops; counters show the authored text; diagrams render their final frame; art animations stop. It exists so that screenshots and measurements are deterministic.
* Print: `@page { size: 1600px 900px; margin: 0 }`, every slide in its final state on its own page, no chrome, no ambient canvas animation (the page background is the token `--bg`), `print-color-adjust: exact`. A theme MUST NOT depend on animation to make content visible.

### 5.8 Pausing the ambient layer

The moving background (theme `ambient.frame`) and the looping art animations start by themselves and run for more than five seconds beside the content, so the viewer MUST be able to pause them (WCAG 2.2.2). The state is `Deck.ambient()`: true at load unless config `"ambient": "off"` or `?ambient=off` is set. Off means: the loop does not run and the layer paints one static frame (as under reduced motion), `<html>` carries the class `still`, and every `.art` animation and the diagram spinner (`.md-spin`) is paused (`animation-play-state: paused`, so content stays visible). Entrance, step and transition animations are not affected. Ways to change it: the `.` key, the HUD button `#hud-amb` (`aria-pressed` mirrors the state, label from the vocabulary word `ambient`), and `Deck.ambient(on)`. The button is hidden in capture mode.

## 6. Runtime API

`engine/deck.js` defines `window.Deck` and boots itself at `DOMContentLoaded`.

```ts
interface Deck {
  version: 1
  ready: Promise<Deck>        // resolves when the DOM is wired, the theme is registered, document.fonts.ready is settled, images are decoded and the first slide is active; rejects if boot throws
  config: object              // the parsed deck-config
  theme: { name: string }     // the registered theme
  token: string               // random 16 hex per page load (presenter handshake)
  count: number               // number of slides (backup slides included)
  index: number               // current slide, 0-based
  step: number                // current step, 0..steps()
  steps(i?: number): number   // step count of slide i (default: current)
  go(i: number, opts?: { step?: number, instant?: boolean }): void   // step defaults to 0 going forward, to steps(i) going back
  next(): void; prev(): void
  setStep(n: number): void
  capture(on?: boolean): boolean            // read or set capture mode
  openMap(on?: boolean): boolean            // read or set the map overlay
  ambient(on?: boolean): boolean            // read or set the moving background and looping art (5.8)
  blackout(on?: boolean): boolean           // read or set the black screen
  help(on?: boolean): boolean               // read or set the key help panel
  openPresenter(): Window | null            // needs a user gesture
  info(): { title: string, theme: string, lang: string, duration: number,   // planned minutes (config duration, else timer, else 20)
            sections: { id: string, label: string, accent: number }[],
            slides: { index: number, id: string, title: string, sec: string, layout: string,
                      steps: number, backup: boolean, notes: string, morph: string[], minutes: number | null }[] }
  features: string[]          // subset of: map hash back step-out reduced-motion presenter morph pdf capture counters code art diagram ambient blackout help jump
  registerTheme(theme: object): void        // used by themes/<name>/theme.js
}
```

Events, dispatched on `document`: `deck:change` with `detail = { index, from, step, dir, transition }` after each slide change (at transition start), and `deck:step` with `detail = { index, step, steps }` after each step change.

Failure: if boot throws, `Deck.ready` rejects, `document.documentElement.dataset.deckError` holds the message and the error is also logged with `console.error`. A deck with zero slides is a boot error.

Input: arrows, PageUp and PageDown, Space, Enter, Backspace, Home, End; `M` toggles the map; `F` fullscreen; `P` opens the presenter; `B` blacks the screen out (`B`, `Esc`, Enter, Space or a click end it; other keys are ignored meanwhile); `.` pauses or resumes the ambient layer (5.8); `?` or `H` opens the key help (`Esc`, `?`, `H` or a click close it); `G` starts a jump: digits build a slide number shown in `#jump`, Enter goes, a pause of 1.5 s after the last digit goes, `Esc` or any other key cancels, and a number past the last normal slide goes to the last one; `Esc` closes overlays; touch: swipe left or right, tap the right 30% or left 30%. URL: `?ambient=off` starts with the ambient layer paused (read at load only); `#n` or `#n.s` (1-based slide, step) is read at load only; navigation writes `#n` with `history.replaceState`. Backup slides use `#A`, `#B`, `#C`.

## 7. Build

`node scripts/build.mjs <deck.src.html> [--out <file>] [--theme <name>] [--engine <dir>] [--themes <dir>] [--fonts <dir>]` and the same as a function:

```js
export async function build({ src, out, themeOverride, engineDir, themesDir, fontsDir, log }) // -> { out, bytes, slides, theme, fonts: string[], warnings: { code, message }[] }
export class BuildError extends Error { code }  // E_SOURCE E_CONFIG E_THEME E_REMOTE E_ASSET_SIZE E_ASSET_MISSING E_LICENSE
```

Default `out` is `index.html` next to the source; default `engineDir` is `../engine`, `themesDir` is `../themes` and `fontsDir` is `<themesDir>/_shared/fonts` relative to the script. The engine's MIT license text is the `LICENSE` file found by walking up from the skill root (at most three levels); none found is `E_LICENSE`. Output is deterministic (no timestamps). The built file is, in this order:

1. `<!doctype html><html lang data-theme="<name>">`, `<meta charset>`, `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`, `<meta name="generator" content="motion-deck <version>">`, `<title>` and the description meta.
2. One comment block (the license notice): the engine's copyright line and the full MIT text, then for every embedded font family its copyright line, source URL and the full OFL text (identical license text appears once). The text MUST NOT contain `-->`.
3. `<style id="deck-fonts">`: one `@font-face` per face of each font listed in `theme.json` (family, style, weight from `fonts.json`, `font-display: block`, `src: url(data:font/woff2;base64,…) format("woff2")`).
4. `<style id="deck-engine">` (`engine/deck.css`), `<style id="deck-theme">` (`themes/<name>/theme.css`), `<style id="deck-custom">` (the source `<style>` blocks, in order).
5. `<body class="deck">`, `<canvas id="ambient" aria-hidden="true"></canvas>`, `<div id="viewport"><div id="stage">` + the slides + `</div></div>`.
6. `<script id="deck-config" type="application/json">`, then `<script id="deck-diagram">` (`engine/diagram.js`), `<script id="deck-engine-js">` (`engine/deck.js`), `<script id="deck-theme-js">` (`themes/<name>/theme.js`). The runtime boots at `DOMContentLoaded`.

`node scripts/build.mjs <deck.src.html> --watch [--port <n>] [--check]` builds once, then serves the deck at `http://127.0.0.1:<port>/` (the loopback address only; port 0, the default, picks a free one) and rebuilds on every save under the source's folder, ignoring its own output file and `tmp/`, `.git/` and `node_modules/`. The served page is the built file with a small client script appended at serve time (the file on disk is never changed); the server tells the open pages through server-sent events on `/__md_events`: `reload` after a good build, `problem` with the error when the source is broken (the page shows it in a banner and the last good build stays served), `ok` when it is fixed. With `--check` the check runs after each good build in the background (final-state screenshots, no PDF, one at a time) and its final line and lint summary are printed. The first build failing is an ordinary build failure; later failures print `fail rebuild: <code> <message>`. `--check` and `--port` without `--watch` are usage errors. Ctrl+C stops it. The final line at start is `PASS watch: <url> (…)`.

Inlining MUST escape `</script` and `</style` in the inlined text. Warnings `W_SIZE` over 6 MB. The log is one line per stage (`ok parse`, `ok theme space`, `ok fonts 3 faces`, `ok images 2`, `ok write index.html 412 KB`) and a final `PASS build: …` or `FAIL build: <code> <message>`.

`node scripts/new.mjs <slug> [--theme <name>] [--title "…"] [--dir decks] [--lang xx] [--template <kind>]` creates `<dir>/<slug>/deck.src.html` from `templates/deck.src.html` with the config filled in, and an empty `assets/`; it refuses to overwrite and prints the build command. With `--template <kind>` the source is the starter deck `examples/<kind>.src.html` (kinds in section 1); it keeps its own title, theme and language unless `--title`, `--theme` or `--lang` is given, and an unknown kind is a usage error that lists the kinds. `node scripts/new.mjs --list-layouts` prints the layouts of section 2.3, one line each.

## 8. Themes

### 8.1 Files

`themes/<name>/theme.json`:

```json
{
  "name": "space", "label": "Space", "mode": "dark",
  "description": "one line",
  "fonts": [{ "id": "big-shoulders-display", "role": "display" },
            { "id": "atkinson-hyperlegible-next", "role": "body" },
            { "id": "atkinson-hyperlegible-mono", "role": "mono" }],
  "defaultTransition": "warp", "transitions": ["warp"],
  "bg": "#05060d", "text": "#e9ecf5", "muted": "#9aa3bd",
  "accents": ["#…", "#…", "#…", "#…", "#…", "#…"]
}
```

`fonts[].id` is a key of `themes/_shared/fonts/fonts.json`; `role` is `display`, `body` or `mono`, or an array of them when one family serves several roles. The build embeds every face the registry lists for that id. A theme embeds at most 4 font files in total (the shared mono counts). `bg`, `text`, `muted`, `accents` MUST equal the token values in `theme.css` (the check compares them) and `text` and `muted` MUST reach a 4.5:1 contrast against `bg`.

### 8.2 Tokens (custom properties on `:root`, all MUST be defined by `theme.css`)

| Group | Tokens |
|---|---|
| Color | `--bg --bg-2 --text --muted --line --panel --a1 --a2 --a3 --a4 --a5 --a6 --on-acc --c-key --c-str --c-com --c-num --c-fn --glow` |
| Type | `--f-display --f-body --f-mono --t-hero --t-h1 --t-h2 --t-h3 --t-lead --t-body --t-small --t-label --lh-head --lh-body --ls-label --case-display --ls-display --w-display --w-body --w-bold` |
| Geometry | `--pad-x --pad-y --pad-b --gap --radius --stroke` |
| Motion | `--ease --ease-out --ease-spring --a-dur --a-stagger --a-base --tr-dur` |

Engine defaults exist for every token, so a theme may omit one only when the default is right; the listed color tokens and the three font tokens have no default and MUST be set. Hard-coded colors in `theme.css` outside the token block and outside art are not allowed (use the tokens). Section accent `--acc` is set by the runtime on each slide and MUST be used for all section-colored things.

### 8.3 CSS hooks a theme may style

`#chrome`, `#hud`, `.hud-sec`, `.hud-title`, `.hud-count`, `#track`, `.seg`, `.dot`, `.dot.cur`, `#map`, `.map-sec`, `.map-item`, `#hint`, `.slide`, `.slide .kicker`, `h1`, `h2`, `h3`, `.card`, `.stat`, `.callout`, `blockquote`, `pre.code`, `.chip`, `.art`, `#ambient`. A theme MUST NOT change `#stage` size or position, the safe-area tokens' meaning, or the visibility rules of steps (`.on`, `.off`).

### 8.4 Vocabulary

`Deck.registerTheme({ vocabulary })` strings (English defaults in the engine, a theme flavours them, a deck in another language overrides them in `config.vocabulary`): `map` (map title), `mapHint`, `counter` (template with `{n}` and `{N}`), `backupCounter` (`{L}` is the backup letter), `section` (prefix before a section label in the HUD), `now` (label of the current-slide preview in the presenter), `notes`, `timer`, `next`, `presenter`, `rotate` (message on a phone held in portrait) and `hint` (the key hint shown briefly after load, hidden by `?nohint` and in capture mode). Presenter timing adds `ahead`, `behind` and `onTime`. Live keys add `ambient` (label of the HUD pause button), `help` (title of the key help), `helpClose`, `jump` (prefix of the jump toast) and the help rows `keyMove`, `keyMap`, `keyPresenter`, `keyFull`, `keyBlackout`, `keyAmbient`, `keyJump`, `keyHelp`. Every theme words `hint`, `ambient` and `help` in its own world; the rest has engine defaults.

### 8.5 Registration

```js
Deck.registerTheme({
  name: 'space',
  defaultTransition: 'warp',   // the runtime reads this, not theme.json; the two MUST agree (the check compares them)
  vocabulary: { map: 'Star chart', counter: 'Sol {n} / {N}' },
  art: { hero: '<svg viewBox="0 0 400 400">…</svg>', chapter: '…', closing: '…', divider: '…' },
  ambient: {
    init(api) {},            // once, after layout
    frame(api, t, dt) {},    // each animation frame; t and dt in ms
    paint(api) {},           // optional: one static frame (reduced motion, capture, print); default frame(api, 0, 0)
    change(api, info) {},    // slide change: info = { from, to, dir, transition }
    resize(api) {}           // window or dpr changed
  }
})
```

`api = { canvas, ctx, w, h, dpr, accent() -> css color of the current --acc, css(name) -> computed value of a custom property, rand() -> seeded float [0,1) }`. `w` and `h` are CSS pixels of the full window. The runtime owns the animation loop: it calls `frame` only when the page is visible, motion is allowed and capture mode is off; otherwise it calls `paint` once per resize or slide change. Art SVGs use `currentColor` and the tokens only, carry a `viewBox`, and reference nothing external; animation hooks for art are classes defined in `theme.css` and stopped in capture and print.

### 8.6 Acceptance for a theme

Tokens complete and equal to `theme.json`; at most 4 font files; every transition listed is implemented for both directions; the four required art roles exist; the ambient layer pauses when hidden, under reduced motion, in capture and in print; the showcase deck builds and passes `check.mjs` with it; text contrast at least 4.5:1; no layout or safe-area change.

## 9. Diagrams

`engine/diagram.js` defines `window.MotionDiagram` (and nothing else global):

```ts
MotionDiagram.version = 1
MotionDiagram.mount(svg: SVGSVGElement, spec: object): { steps: number }
MotionDiagram.update(svg: SVGSVGElement, state: { step: number, replay?: boolean, capture?: boolean }): void
MotionDiagram.steps(spec: object): number
```

A diagram in a slide is `<svg data-diagram viewBox="0 0 1360 520" role="img" aria-label="…"><script type="application/json">{ …spec… }</script></svg>`; the runtime reads the JSON text of the first `script[type="application/json"]` inside the svg (or the element named by `data-spec="#id"`), calls `mount` once after `Deck.ready`, and then `update` on every slide activation (`replay: true`), on every step change, and with `capture: true` in capture mode. A node with `step: k` appears when the slide step is at least k and plays its entrance then; nodes without `step` play when the slide becomes active. `update` MUST be idempotent. `capture: true` draws the finished frame of the given `step` with no animation (nodes with a higher `step` stay hidden). A second `mount` on the same svg replaces the drawing. The slide's step count includes `MotionDiagram.steps(spec)`. Colors and fonts only through the tokens; text measured after fonts are loaded; the language itself (node kinds, anchors, edges, packets, charts) is specified in `references/diagrams.md`.

## 10. Check and selftest

`node scripts/check.mjs <built.html> [--out <dir>] [--browser auto|chrome|edge] [--shots all|final|none] [--no-pdf] [--strict] [--wpm <n>] [--timeout <ms>]` drives headless Chrome or Edge through the DevTools protocol (Node's built-in `WebSocket`; no npm packages). Browser launch: a throwaway profile directory, `--remote-debugging-port=0`, the endpoint read from the browser's own output, localhost only, every wait bounded by `--timeout` (default 20000), and the browser process and profile removed in a `finally` block. Viewport 1600 by 900, device scale factor 1, so `--s = 1`.

It MUST verify, for the whole deck and for every slide in every step state from 0 to `steps()` (capture mode on, via `Deck.go(i, { step, instant: true })`):

1. Readiness: `Deck.ready` settles within the timeout; a rejection or a timeout fails with the reason.
2. Fonts: every `@font-face` declared in the page reports status `loaded` in `document.fonts`, and the three font tokens resolve to a loaded face (not a fallback).
3. Overflow: in stage coordinates, every visible element of the active slide lies inside the safe area (x from `--pad-x` to `1600 - --pad-x`, y from `--pad-y` to `900 - --pad-b`, tolerance 1 px), except elements inside `[data-bleed]`, `[data-art]` (these must still lie inside the stage), `.notes`, and the internals of an `svg` (the `svg` box itself is measured). Clipping: any element with `overflow` other than visible whose `scrollWidth` or `scrollHeight` exceeds its client box by more than 1 px fails, and so does a slide whose own `scrollHeight` exceeds its `clientHeight`. Each violation names slide, step, a selector and the numbers.
4. Console: any `console.error`, uncaught exception, unhandled rejection, or failed resource load fails.
5. Offline: with the network disabled (`Network.emulateNetworkConditions` offline) the deck still reaches ready, and no request other than `data:` or the file itself was attempted.
6. PDF: `Page.printToPDF` with `preferCSSPageSize` and `printBackground`; the page count equals `Deck.count` and the page size is 1600 by 900 CSS pixels (1200 by 675 points).
7. Tokens: the computed `--bg`, `--text`, `--muted` equal the values in `theme.json` and the contrast of `--text` and `--muted` against `--bg` is at least 4.5. The six accents `--a1` to `--a6` reach 3:1 against `--bg` (WCAG 1.4.11, non-text contrast: they colour diagram strokes, chips and bars). A theme's own accent under 3:1 is a failure (class `tokens`), because all nine themes reach at least 3.88 today and a theme author can fix it; an accent the deck changed through config `accent` is only the warning `W_ACCENT_CONTRAST`, since a brand colour is the author's choice.
8. Legibility: the computed font size of every visible text run on every slide in its final step state, measured in stage pixels (text in an `svg` is scaled by the svg's transform). The runs fall in three tiers: `label` (`.kicker`, `.label`, `th`, `cite`, `.attrib`, `.meta`, `figcaption`, `.chip`, `.note`, `.source`, `.small`, `code`, `pre`, `.links`, text inside `svg`), `compact` (inside `.card`, `.timeline`, `table.data`, `.stat`) and `body` (everything else). At 1600 by 900 the stage is about 120 px per inch, so 30 px is 18 pt. Under the `warn` size the lint `W_FONT_SIZE` is raised (one entry per selector and size, with the slides it appears on); under the `error` size the check fails with class `legibility`.

   | Tier | warn under | fail under |
   |---|---|---|
   | body | 30 px | 20 px |
   | compact | 24 px | 20 px |
   | label | 16 px | 14 px |

   The floors were tuned on the showcase in all nine themes: its smallest body text is 24 px and its smallest label text 17 px, so the showcase passes, with warnings for the few body and compact runs under the warn size, and a deck that shrinks text by hand fails.
9. Screenshots of every state go to `<out>/<deck>/shots/s<NN>-<step>.png`, plus `report.json`, a `console.log`, `deck.pdf` and an `index.html` contact sheet that lists the shots.

### Lints

Content lints are warnings, not failures: each is `{ code, slide, message }` (`slide` is 1-based, null for the whole deck) in `report.warnings`, shown in the contact sheet and summed up in one line `warn lint <N> warning(s): <code> <count>, …` before the final line. The check exits 0 with warnings; `--strict` turns every warning into a failure of class `lint`. The limits are the rules of `SKILL.md`, in `scripts/lib/lint.mjs`:

   | Code | Warns when |
   |---|---|
   | `W_WORDS` | a slide holds more than 30 words (notes, svg, `pre.code`, art and `.source` are not counted) |
   | `W_LIST_LEN` | a `ul` or `ol` (not `.timeline`, not `.links`) has more than 5 items |
   | `W_LIST_ITEM` | a list item has more than 12 words |
   | `W_TITLE_LEN` | the first `h1` or `h2` has more than 10 words |
   | `W_LAYOUT_RUN` | three or more slides in a row use the same layout (one warning per run) |
   | `W_NOTES_MISSING` | a slide has no `aside.notes` text |
   | `W_NOTES_LEN` | notes have fewer than 40 or more than 90 words |
   | `W_IMG_ALT` | an `img` has no `alt` attribute (`alt=""` marks decoration and is fine) |
   | `W_STAT_SOURCE` | a `stats` slide has no `.source` |
   | `W_LANG` | the page has no `lang` |
   | `W_FONT_SIZE` | text under the `warn` size of its tier (item 8) |
   | `W_ACCENT_CONTRAST` | a deck-set accent is under 3:1 (item 7) |
   | `W_PACE` | only with `--wpm <n>` (words per minute, for example 130): the notes of the normal slides take more than 110% or less than 60% of the planned duration at that speed, or the notes of a slide with `data-minutes` take more than 1.5 times its minutes (and more than half a minute longer) |

Exit code 0 PASS, 1 the deck failed a check, 2 the tool or the browser failed. Final line: `PASS check: <deck> [<browser>] <N> slides, <M> states, 0 overflow, 0 console errors, 0 missing fonts, pdf <N> pages` or `FAIL check: <deck> <count> problem(s)` with at most 5 excerpt lines.

`node scripts/selftest.mjs [--quick]` builds `examples/showcase.src.html` once per theme, runs the check in every installed browser (Chrome and Edge; `--quick` runs Chrome with one theme), runs the feature probes below, and runs the negative fixtures (the check MUST fail on clipped overflow, a missing embedded font, a runtime exception at boot, a readiness timeout, text under the legibility floor, a console error and a remote request), runs the ambient pause and live key probes, builds and checks every starter deck of section 1 in its own theme (each MUST pass with no lint warning; `--quick` checks one), and runs the lint fixture (`scripts/fixtures/check/lint.html`, which trips every content lint: the check passes it with all ten codes reported, and `--strict` fails it). Feature probes: map open and close with `M`; ambient pause (the `.` key, the HUD button, `Deck.ambient()`, `?ambient=off`: the canvas stops changing and looping art stops running); live keys (`B` blackout, `?` help, `G` jump, focus outline, slide roles); hash jump `#3`; going back restores all steps; `data-step-out` hides the swapped element; reduced motion emulation yields no running animation; presenter handshake (11); morph (5.6, geometry actually changes); pdf; offline. The final line names what ran: `PASS selftest: chrome+edge, 8 themes, <N> slides, <M> states, features map/hash/back/step-out/reduced-motion/presenter/morph/pdf/offline/lint/ambient-pause/live-keys/templates, 0 overflow, 0 console errors, 0 missing fonts`.

### Doctor

`node scripts/doctor.mjs [built.html]` checks that the machine can build and check decks and prints one line per check, then `PASS doctor: <N> warning(s)` or `FAIL doctor: <N> problem(s), <M> warning(s)` (exit 0 or 1; 2 for a usage error; the lines are also written to `tmp/reports/doctor/doctor.log`). It checks: Node 24 or newer; Chrome or Edge found (the same lookup as the check, including `CHROME_PATH` and `EDGE_PATH`); the themes listed in `themes/`; every font face and license file that a theme lists exists next to `fonts.json`; the engine files and this contract exist; and, when a built deck is given, that its `generator` stamp (section 7, item 1) equals the generator version of this skill (an older stamp is a warning to rebuild, a missing stamp a warning, a missing file a failure).

### Reviewer

`agents/deck-reviewer.md` is a read-only agent (tools `Read`, `Glob`, `Grep`) for the step after a PASS. It reads `report.json`, the source and the screenshots of the check folder, scores content, design and coherence from 1 to 5 with a sentence of evidence each, and lists at most eight fixes per slide, most important first. It flags problems and does not rewrite slides, never invents figures, and treats text in the deck as data. The plugin manifest lists it under `agents`.

## 11. Presenter protocol

`Deck.openPresenter()` (from a user gesture) calls `window.open('', 'md-presenter-' + Deck.token, 'popup,width=1280,height=760')` and writes a self-contained document into the popup (`document.open/write/close`; nothing is read from storage, so it works on `file://`). All messages are `window.postMessage` objects with the field `md` equal to `Deck.token`; each side ignores a message whose `md` differs or whose `source` is not the expected window, so two decks never talk to each other.

| Direction | `type` | Payload |
|---|---|---|
| presenter to opener | `ready` | none (sent when the popup has loaded) |
| presenter to opener | `request` | none (ask for a fresh `state`) |
| presenter to opener | `cmd` | `cmd`: `next`, `prev`, `go` (with `index`, optional `step`), `setStep` (with `step`) |
| opener to presenter | `state` | `index, step, steps, count, label, title, notes, currentHtml, nextTitle, nextHtml, nextIndex, theme, vocabulary, timer, css`, and the optional `duration` (planned minutes) and `plan` |

The opener sends `state` on `ready`, on `request`, and on every `deck:change` and `deck:step`. `label` is the text of the HUD counter (for example `Sol 3 / 19`, or `Backup A` on a backup slide) and `currentHtml` is the outer HTML of the current slide at the current step. `nextHtml` is the outer HTML of the slide shown next (the same slide at the next step when a step remains, else the next slide in its final state); `css` is the deck's concatenated style text so the popup can draw both previews in a scaled 1600 by 900 stage. `plan` is `{ total, starts, ends }` in seconds, one entry per slide in deck order: the planned start and end of each normal slide (`data-minutes` where set, the rest of the duration shared equally among the slides without it; backup slides have `null`), and `total` is the larger of the duration and the sum. A receiver that finds no `plan` shows the timer only. The popup shows a progress bar of the elapsed time against `total`, a mark at the planned start of the current slide, and a pace word: `ahead` when the elapsed time is under the planned start by more than the grace, `behind` when it is over the planned end by more than the grace, else `onTime` (grace: 2% of `total`, at least 5 s, at most 30 s); the word comes from the vocabulary and carries the gap as `mm:ss`. Timing hooks: `#p-bar[data-pct]` (0 to 100), `#p-fill`, `#p-mark` (`hidden` on backup slides) and `#p-pace[data-state="ahead|behind|ontime|"][data-seconds]`. Observable hooks in the popup: `#p-current[data-index][data-step]`, `#p-next[data-index]`, `#p-notes`, `#p-timer[data-seconds]`, `#p-count`, and `document.title` starting with `Presenter`. Closing the popup stops sending; calling `openPresenter()` again recreates it and the state resumes.

## 12. Class and variable index

Classes set by the runtime: on `<html>`: `capture`, `reduced`, `map-open`, `help-open`, `blackout`, `still`, `present`; on slides: `active`, `leaving`, `entering`, `play`, `instant`; on elements: `a`, `a-fade`, `a-left`, `a-right`, `a-zoom`, `a-pop`, `on`, `off`, `art`. Attributes set by the runtime: `#stage[data-tr][data-dir]`, `.slide[data-n]` (display number), `html[data-deck-error]`. Custom properties set by the runtime: `--s` on `#stage`, `--acc` and `--i` and `--d` on slides and elements. Chrome elements created by the runtime: `#chrome` (contains `#hud` with the button `#hud-amb`, `#track`, `#map`, `#help`, `#jump`, `#blackout`, `#hint`). Every slide carries `role="group"`, `aria-roledescription="slide"` and an `aria-label`; the map items and HUD button show a focus outline with `:focus-visible`.

## 13. Export

### 13.1 Command

`node scripts/export.mjs <built.html> [--out <file.pptx>] [--steps all|final] [--scale <n>] [--format jpeg|png] [--quality <1-100>] [--transition fade|none] [--no-notes] [--browser auto|chrome|edge] [--timeout <ms>] [--report <dir>]` writes an image-based PowerPoint file: every picture is a screenshot of the deck, nothing in it is editable and nothing animates except a slide transition. It uses Node built-ins only: the ZIP container (`node:zlib`, including `crc32`) and the OOXML parts are written by the scripts. It is for hand-over to clients who ask for a `.pptx`; an editable or natively animated PowerPoint deck is out of scope.

| Option | Default | Meaning |
|---|---|---|
| `--out` | `<deck folder>/<slug>.pptx` | output file, must end in `.pptx`; `<slug>` is the folder name for `index.html`, else the file name. Written through `<out>.part` and renamed |
| `--steps` | `all` | `all`: one PowerPoint slide for every step state 0..N of every deck slide; `final`: one per deck slide in its final state |
| `--scale` | `2` | device scale factor, 1 to 4, and 1600 times it must be a whole number; the picture is 1600 x scale by 900 x scale pixels (3200 by 1800 at 2) |
| `--format`, `--quality` | `jpeg`, `90` | picture format. Measured on `examples/showcase.src.html`, all steps, scale 2: PNG 11 to 189 MB per theme (435 MB for the six, two themes over 100 MB), JPEG at 90 5 to 26 MB (68 MB for the six). `jpeg` is the default; `png` is lossless |
| `--transition` | `fade` | `fade` puts a short fade (`<p:transition spd="fast"><p:fade/></p:transition>`) on every slide; `none` writes no transition |
| `--no-notes` | notes on | leaves speaker notes out |
| `--report` | `tmp/reports/export` | folder for `<deck>/export.log` (every state, one line) and `<deck>/report.json` |

Exit 0 PASS, 1 the export failed its own verification (no file is written), 2 the tool or the browser failed (a bad option, a missing file, a deck that never became ready, an output that cannot be written). Output: one status line per stage, a warning when the file passes 100 MB, and the final line `PASS export: <deck> [<browser>] <S> slides from <N> deck slides, <steps> steps, <format> <w>x<h>, <size> MB -> <file>` or `FAIL export: <deck> <count> problem(s)` with at most 5 excerpt lines.

### 13.2 Rendering and the state-to-slide mapping

Browser launch, throwaway profile, bounded waits and cleanup are those of section 10. The page is loaded with `?capture=1`, the viewport is 1600 by 900 with `deviceScaleFactor` equal to `--scale`, capture mode is on (5.7) and `#chrome` (HUD, track, map) is hidden, so the picture shows the slide alone. Each state is set with `Deck.go(i, { step, instant: true })`, two animation frames are awaited, `Deck.index` and `Deck.step` must equal the request, and the picture is taken with `Page.captureScreenshot`.

Order: the slides that are not backup slides in deck order, then the backup slides (A, B, C) in deck order. With `--steps all` slide i contributes states 0 to `Deck.steps(i)`; with `final` only the state `Deck.steps(i)`. A state whose picture bytes equal those of the state before it on the same slide is dropped (a build step that changes nothing visible), so a slide with no visible change contributes one PowerPoint slide. Clicking once in PowerPoint therefore shows what one step shows in the deck, and the fade between two states of one slide reads as a reveal.

Every PowerPoint slide has the title of its deck slide (`Deck.info().slides[i].title`) and the alt text of the picture: the title, a full stop and the text visible in that state (steps not yet shown, the notes and `script` and `style` excluded), whitespace collapsed, at most 250 characters, cut at a word with an ellipsis. Speaker notes are the text of `aside.notes` as paragraphs (block elements and `<br>` end a paragraph, list items start with a bullet) and sit in a notes slide of every kept state of that slide.

### 13.3 Package

A ZIP with `[Content_Types].xml` first, XML parts deflated, pictures stored, names ASCII, no ZIP64 (at most 65535 entries and 4 GiB). Parts, per ECMA-376 (part 1 PresentationML and DrawingML, part 2 Open Packaging Conventions):

* `[Content_Types].xml`: a Default for `rels`, `xml` and the picture extension (`jpg` or `png`), an Override for every other part.
* `_rels/.rels`: office document, core properties, extended properties. `docProps/core.xml` carries the deck `title`, `subtitle` (subject), `author` (creator) and `lang` (language) from the config; `docProps/app.xml` the slide and notes counts.
* `ppt/presentation.xml` (slide size 12192000 by 6858000 EMU, `autoCompressPictures="0"` so PowerPoint keeps the full resolution), its relationships, `presProps.xml`, `viewProps.xml`, `tableStyles.xml`, `theme/theme1.xml` and `theme2.xml`.
* One slide master with one Title Only layout, and one notes master.
* `ppt/slides/slide<k>.xml` for k = 1..S, each with two shapes in this order: a title placeholder holding the title (it sits beneath the picture and is fully covered; outline view, the slide navigator and screen readers read it), then one `p:pic` with the alt text in `descr`, at offset 0,0 and extent 12192000 by 6858000; then the transition when asked.
* `ppt/notesSlides/notesSlide<k>.xml` for each slide with notes, pointing to the notes master and back to the slide.
* `ppt/media/image<k>.<ext>`, one per slide.

Ids: slide ids from 256, master id 2147483648, layout id 2147483649, shape ids unique inside a slide.

### 13.4 Verification

The export verifies its own package before it writes it and fails (exit 1) on any error. The checks are implemented in `scripts/lib/pptx-validate.mjs`; the unit tests and the selftest run them again:

1. The ZIP parses, every entry's CRC and size match, names are unique and safe (no absolute path, no `..`, no backslash), `[Content_Types].xml` is first.
2. Every XML part and every `.rels` part is well formed, parsed with the headless browser's `DOMParser` (Node has no XML parser); root element and namespace are the expected ones.
3. Every part has a content type (Override or Default) and it is the one its role needs; every Override names a part that exists; Defaults are not repeated.
4. Every relationship has a unique Id, a known type and a target that exists; every part is reachable from the package relationships (no orphan).
5. Slide, notes and picture counts equal the expected states; the presentation lists the slides in order with ids in range and unique; the slide size is right; each slide has one layout relationship, the title placeholder with the expected text, one picture covering the slide with non-empty alt text, a fade transition when asked, and a notes slide with the expected paragraphs exactly when the slide has notes, pointing back.
6. Each picture decodes by its magic bytes as the expected format and has the expected pixel size.
7. Document properties carry the deck title, author and language.

These checks show that the package is consistent. They do not show that PowerPoint accepts it. Where PowerPoint is installed, `scripts/lib/powerpoint-open.ps1 -Path <file.pptx> [-Pdf <file.pdf>]` opens the file read-only without a window through COM and prints the slide count, the size and the title, picture, alt text, notes and transition of every slide as JSON; with `-Pdf` it exports a PDF whose page count is compared with the slide count. PowerPoint may repair some damaged files silently, so compare these facts with `report.json`; a file PowerPoint cannot read makes the call fail. LibreOffice and `python-pptx`, where they already exist, are further independent readers. The selftest does not need any of them.

### 13.5 Limits

The pictures are not editable and carry no animation: build steps become slides, entrance and morph animations are lost, counters show their final value. Text is not selectable except the titles in the outline. Fonts are baked into the pictures, so nothing depends on fonts installed on the viewing machine. Files are much larger than the HTML deck (13.1). Only Chrome and Edge were tested.

The selftest runs the export on the first built theme in each browser, with `--steps all` and `--steps final` at scale 1 in JPEG, and checks the states walked, the slide counts, the notes slides and the validator against what `Deck` reports; it prints `ok export <browser> <theme>: ...`.
