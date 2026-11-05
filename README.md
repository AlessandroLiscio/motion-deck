# motion-deck

Animated presentations that are one HTML file. A Claude Code plugin with a skill that turns a brief, notes or a document into a deck with entrance animations, step-by-step builds, diagrams that draw themselves, cinematic transitions, a living background, a map of the talk and a presenter window, in eight themes.

**[See the showcase deck in all eight themes](https://alessandroliscio.github.io/motion-deck/)**

| Theme | Look | Background | Transition |
|---|---|---|---|
| `space` | dark void, one accent per chapter | twinkling stars, drifting dust | warp streaks |
| `editorial` | warm paper, ink and a fountain-pen blue | paper grain, ink-drawn diagrams | page lift |
| `neon` | black-violet with magenta and cyan glow | grid scrolling to a horizon sun | zoom-through |
| `corporate` | white with one brand color from the config | soft drifting shapes | smooth glide |
| `fantasy` | candlelit dark, gold and burgundy | fireflies, embers, low fog | magic dissolve |
| `pirates` | treasure-map parchment and sea blue | rolling waves and clouds | sailing sway |
| `pipboy` | green phosphor terminal, bracketed panels, inverse-video tabs | scanlines, a rolling refresh bar | top-to-bottom scan |
| `skyrim` | night slate, light grey-white capitals, double-line frames with corner diamonds, a compass-star map, a header like a skill screen | aurora, falling snow, shifting mountain ridges, a constellation helmet and runes | frost |

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

The build joins the source with the engine, the theme, the embedded fonts and the images into one file that works offline, from a file, a web server or GitHub Pages. In the deck: arrows or Space move, `M` opens the map, `P` opens the presenter window (notes, timer, next slide), `F` is full screen, `B` blacks the screen out, `G` and a number jumps to a slide, `.` pauses the moving background, `?` lists the keys, and printing to PDF gives one slide per page.

## What the check does

`check.mjs` opens the built deck in headless Chrome or Edge, walks through every slide and every build step, and fails on content outside the safe margins, clipped boxes, console errors, a font that did not load, any network request, a wrong PDF page count and text with too little contrast. It saves a screenshot of every state, the PDF and a contact sheet, so the model (or you) can look at the result before presenting.

## Hand over a PowerPoint file

`node skills/motion-deck/scripts/export.mjs decks/my-talk/index.html` writes `decks/my-talk/my-talk.pptx` for clients who ask for PowerPoint. The file is image-based: every slide, and every build step of a slide, becomes a picture, so one click in PowerPoint shows what one step shows in the deck, with a fade between them and the speaker notes in the notes pane. The limits are real. The pictures are not editable and there are no native animations, so entrances, counters and morphs are lost. Text is not selectable except the slide titles, which sit in the outline view and are read by screen readers. Files are much larger than the HTML deck (the showcase is 5 to 26 MB as JPEG and up to 189 MB as PNG), and fonts are baked into the pictures. Use the HTML deck to present; use the `.pptx` for hand-over. The export checks its own package (ZIP, content types, relationships, XML, picture sizes, counts) before it writes it; whether PowerPoint opens it was tested only where PowerPoint is installed (see `skills/motion-deck/references/contract.md`, section 13). An editable or natively animated PowerPoint deck is a different job for the `pptx` skill.

## Develop

```bash
node --test skills/motion-deck/scripts/tests/*.test.mjs
node skills/motion-deck/scripts/selftest.mjs
```

`node skills/motion-deck/scripts/build.mjs decks/talk/deck.src.html --watch` serves the deck on a local address and reloads it on every save (add `--check` to run the check after each build), `new.mjs --template pitch|quarterly-review|tech-talk|workshop|lesson|keynote` starts from a worked example deck, `new.mjs --list-layouts` prints the layouts, and `doctor.mjs` checks the install. After the check, the `deck-reviewer` agent can give a second opinion: it scores content, design and coherence and lists fixes per slide.

The selftest builds the showcase in every theme and runs it in every installed browser with probes for the map, URL hashes, going back, swaps, reduced motion, the ambient pause, the live keys, the presenter window, morph transitions, print and offline use, plus deliberately broken decks that the check must fail. `skills/motion-deck/references/contract.md` is the specification the engine, the scripts and the themes are built against. CI runs the tests on Linux and Windows and publishes the gallery to GitHub Pages after every merge to `main`.

## License

Code under the [MIT license](LICENSE). Fonts under the SIL Open Font License, embedded in each deck with their notices. See [CREDITS.md](CREDITS.md) for the fonts and for the deck that inspired this project.
