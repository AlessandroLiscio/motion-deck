---
name: motion-deck
description: Use when asked for a presentation, slide deck, talk or pitch as an animated HTML page, or to edit or restyle one made with this skill. Builds one offline HTML file with entrance and build animations, animated diagrams and charts, cinematic transitions, a living background, a map and a presenter view, in six themes (space, editorial, neon, corporate, fantasy, pirates). Not for .pptx or .pdf deliverables.
---

# motion-deck

You write the slide content as small HTML. The scripts of this skill join it with the motion engine, a theme, embedded fonts and images into one offline `index.html`, then check every slide and every build step in a headless browser. The engine does all the animation; you never write animation code.

`SKILL` below is the folder that holds this file. Run the scripts from the user's working folder as `node "SKILL/scripts/<name>.mjs"` (Node 24, Chrome or Edge installed, nothing to `npm install`). A new deck goes in `decks/<slug>/` of that folder unless the user names another place.

## Workflow

1. **Brief.** Topic, goal, audience, length in minutes (about one slide per minute, 10 to 14 slides when unsaid), language (follow the brief), theme. Read the source notes or document the user gives you. Never invent facts, figures or quotes: every figure on a slide comes from the user's material and is named in a `<p class="source">` footnote on that slide. Ask only when the topic or the source is missing.
2. **Theme.** When the user names none, pick from the table below, say which and why in one line, and say that changing it is one word in the config.
3. **Story.** Plan before markup: one claim per slide, an arc (hook, problem, turn, proof, ask), sections that share one metaphor, a chapter slide every three to five slides (`references/storytelling.md`). Show the outline only when the user asked for it or the brief was thin.
4. **Scaffold.** `node "SKILL/scripts/new.mjs" <slug> --theme <theme> --title "<title>" --lang <code>` creates `decks/<slug>/deck.src.html`. When the brief matches a kind of talk, start from a worked example with `--template pitch|quarterly-review|tech-talk|workshop|lesson|keynote`: it keeps the structure and the real sample content to replace (see `examples/<kind>.src.html`). Set `"duration"` (minutes) in the config, and `data-minutes` on a slide that needs more or less than its share.
5. **Write the slides** (with `build.mjs --watch` running the deck reloads on every save) in that file (`references/authoring.md`). Use steps, morph and counters where they help (`references/motion.md`) and diagrams or charts for flows, structures and data (`references/diagrams.md`). Every slide gets speaker notes. A deck in another language than English also translates the HUD words through `vocabulary` in the config.
6. **Build.** `node "SKILL/scripts/build.mjs" decks/<slug>/deck.src.html` writes `decks/<slug>/index.html`.
7. **Check, then look.** `node "SKILL/scripts/check.mjs" decks/<slug>/index.html` must end with `PASS`; read its `warn lint` line and fix the warnings that are real (the list is in `report.json`). Then open screenshots from `tmp/reports/check/<deck>/shots/` with the Read tool: the first slide, one slide per layout you used, every slide with steps (last step), every diagram, the densest slide. Fix what is cramped, unbalanced, repeated or generic, rebuild, look again. Three rounds at most. For an independent second read, hand the source and the check folder to the `deck-reviewer` agent: it scores content, design and coherence from 1 to 5 and lists fixes per slide; it flags, you decide what to change.
8. **Hand over.** Path to `index.html`, slide count, theme, how to present: arrows or Space move, `M` opens the map, `P` opens the presenter window (notes, timer, next slide), `F` is full screen, `B` blacks the screen out, `G` then a number jumps to a slide, `.` pauses the moving background, `?` lists the keys, printing to PDF gives one slide per page. Say what was not verified: only Chrome and Edge were tested.

To edit a deck, change its `deck.src.html` and rebuild; never edit `index.html`. To restyle, change `"theme"` in the config, rebuild and check again, because other fonts move the line breaks.

## Themes

| Theme | Choose it for | Look and motion |
|---|---|---|
| `space` | tech, product, science, engineering talks | dark void, one accent per chapter, twinkling stars, warp streak between slides |
| `editorial` | essays, research, strategy, long reads | warm paper, ink and one blue accent, serif type, page-lift transition |
| `neon` | launches, gaming, music, dev-conference energy | black-violet, magenta and cyan glow, scrolling grid, zoom-through |
| `corporate` | business reviews, sales, internal updates | white, one brand color from `"accent"` in the config, soft drifting shapes, smooth slide |
| `fantasy` | storytelling, tabletop games, training with a narrative | candlelit dark, gold and burgundy, fireflies and fog, magic dissolve |
| `pirates` | kids, playful workshops, team events | treasure-map parchment, sea blue, rolling waves, sailing slide |

`references/themes.md` has the details of each theme (accents, fonts, vocabulary, what it does best).

## Slide craft

- One idea per slide. The title states the claim in at most ten words. Body text at most 30 words, a list at most 5 items of at most 12 words; more items go to steps, cards or another slide.
- Vary the rhythm: chapter, statement, quote and stats slides breathe between content slides; never more than two slides of the same layout in a row.
- Pick the layout from the content: numbers to `stats`, two to four parallel items to `cards`, a sequence to `timeline`, a flow or structure to a diagram, a single sentence to `statement`, source code to `code`.
- Let the engine animate: do not add `data-anim` or `data-delay` without a reason. Builds (`data-step`) are for reveals that serve the speech, at most three or four per slide. Morph is for one object that changes place or size between two consecutive slides.
- Use the art slots (`data-art="hero|chapter|closing|divider"`) instead of stock images. Images are optional, local, under 300 KB each, never remote. A deck works fully offline.
- Colors come from the theme: use `var(--a1)` to `var(--a6)`, `var(--text)`, `var(--muted)` in the few lines of custom CSS you may add, never literal hex values.
- Speaker notes say what to speak, 40 to 90 words, in the deck's language; they never repeat the slide text.

## Commands

| Command | Does |
|---|---|
| `node "SKILL/scripts/new.mjs" <slug> [--theme t] [--title "…"] [--lang xx] [--dir decks] [--template kind]` | creates `<dir>/<slug>/deck.src.html` and `assets/`; `--template` starts from a worked example deck; `new.mjs --list-layouts` prints the layouts |
| `node "SKILL/scripts/build.mjs" <deck.src.html> [--out file] [--theme t]` | builds one offline HTML (`--theme` builds the same deck in another theme) |
| `node "SKILL/scripts/check.mjs" <index.html> [--shots all\|final\|none] [--browser chrome\|edge] [--strict] [--wpm n]` | steps through every slide and build step, fails on overflow, clipping, text under the legibility floor, console errors, missing fonts, network use or a wrong PDF page count, saves screenshots and a PDF; content lints (too many words, long lists, repeated layouts, notes, alt text, sources) are warnings, and `--strict` makes them fail; `--wpm 130` also compares the notes' reading time with the duration |
| `node "SKILL/scripts/build.mjs" <deck.src.html> --watch [--check]` | serves the deck on `http://127.0.0.1:<port>/`, rebuilds on every save and reloads the open page; `--check` also runs the check after each build |
| `node "SKILL/scripts/doctor.mjs" [index.html]` | checks Node, the browser, the fonts and the theme files, and whether a built deck is from this version |
| `node "SKILL/scripts/selftest.mjs" [--quick]` | checks the skill itself (all themes, all features, negative fixtures); run it after changing the engine or a theme |

## Where things are

`references/authoring.md` the source format, layouts and attributes. `references/motion.md` builds, morph, counters, transitions, reduced motion and print. `references/diagrams.md` the diagram and chart language. `references/storytelling.md` structure, metaphor, pacing and notes. `references/themes.md` the six themes. `references/contract.md` the exact specification of the engine, build, check and themes; read it only when the other guides leave a question. `examples/showcase.src.html` is a complete deck that uses every layout and feature; `examples/<kind>.src.html` are six starter decks with real content.
