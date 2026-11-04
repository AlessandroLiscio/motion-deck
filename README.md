# motion-deck

Animated presentations that are one HTML file. A Claude Code plugin with a skill that turns a brief, notes or a document into a deck with entrance animations, step-by-step builds, diagrams that draw themselves, cinematic transitions, a living background, a map of the talk and a presenter window, in six themes.

**[See the showcase deck in all six themes](https://alessandroliscio.github.io/motion-deck/)**

| Theme | Look | Background | Transition |
|---|---|---|---|
| `space` | dark void, one accent per chapter | twinkling stars, drifting dust | warp streaks |
| `editorial` | warm paper, ink and a fountain-pen blue | paper grain, ink-drawn diagrams | page lift |
| `neon` | black-violet with magenta and cyan glow | grid scrolling to a horizon sun | zoom-through |
| `corporate` | white with one brand color from the config | soft drifting shapes | smooth glide |
| `fantasy` | candlelit dark, gold and burgundy | fireflies, embers, low fog | magic dissolve |
| `pirates` | treasure-map parchment and sea blue | rolling waves and clouds | sailing sway |

Changing the theme is one word in the deck's config. Slides name their illustrations by role (hero, chapter, closing), and each theme draws its own.

## Install

In Claude Code:

```
/plugin marketplace add https://github.com/AlessandroLiscio/motion-deck.git
/plugin install motion-deck@motion-deck
```

Then ask for a presentation, for example "make a 10-slide deck about our onboarding in the pirates theme", or call the skill as `/motion-deck:motion-deck`. Claude plans the story, writes the slides, builds the file, checks every slide and build step in a headless browser, looks at the screenshots and hands over `decks/<name>/index.html`.

You need Node.js 24 or newer and Chrome or Edge on the machine (the check drives the browser through the DevTools protocol). Nothing else is installed; the scripts use only Node built-ins.

## Use the scripts directly

```bash
node skills/motion-deck/scripts/new.mjs my-talk --theme space --title "My talk"
# edit decks/my-talk/deck.src.html
node skills/motion-deck/scripts/build.mjs decks/my-talk/deck.src.html
node skills/motion-deck/scripts/check.mjs decks/my-talk/index.html
```

The deck is a small HTML source: a config block and one `<section class="slide">` per slide, with layouts (`title`, `chapter`, `statement`, `content`, `split`, `diagram`, `stats`, `quote`, `code`, `cards`, `timeline`, `image`, `closing`, `blank`) and a few attributes (`data-step` for builds, `data-count` for counters, `data-morph` for elements that travel between slides). `skills/motion-deck/references/authoring.md` is the cheat sheet and `skills/motion-deck/examples/showcase.src.html` uses everything.

The build joins the source with the engine, the theme, the embedded fonts and the images into one file that works offline, from a file, a web server or GitHub Pages. In the deck: arrows or Space move, `M` opens the map, `P` opens the presenter window (notes, timer, next slide), `F` is full screen, and printing to PDF gives one slide per page.

## What the check does

`check.mjs` opens the built deck in headless Chrome or Edge, walks through every slide and every build step, and fails on content outside the safe margins, clipped boxes, console errors, a font that did not load, any network request, a wrong PDF page count and text with too little contrast. It saves a screenshot of every state, the PDF and a contact sheet, so the model (or you) can look at the result before presenting.

## Develop

```bash
node --test skills/motion-deck/scripts/tests/*.test.mjs
node skills/motion-deck/scripts/selftest.mjs
```

The selftest builds the showcase in every theme and runs it in every installed browser with probes for the map, URL hashes, going back, swaps, reduced motion, the presenter window, morph transitions, print and offline use, plus deliberately broken decks that the check must fail. `skills/motion-deck/references/contract.md` is the specification the engine, the scripts and the themes are built against. CI runs the tests on Linux and Windows and publishes the gallery to GitHub Pages after every merge to `main`.

## License

Code under the [MIT license](LICENSE). Fonts under the SIL Open Font License, embedded in each deck with their notices. See [CREDITS.md](CREDITS.md) for the fonts and for the deck that inspired this project.
