# The eight themes

Set the theme with `"theme": "<name>"` in the deck config (or `new.mjs --theme`), or build the same deck in another theme with `build.mjs --theme <name>`. After any change of theme rebuild and run the check again: other fonts move line breaks, and the text length that fits a Big Shoulders title does not always fit Unbounded. Every theme supports the same layouts, steps, diagrams, charts, morph, map, presenter view, reduced motion and print.

## Choosing

| Theme | Light or dark | Choose it for | Avoid it for |
|---|---|---|---|
| `space` | dark | tech, product, science, engineering, anything with a roadmap or a journey | formal finance or legal reviews |
| `editorial` | light | essays, research, strategy, long arguments with few figures, a reader's tone | dense dashboards, party-style events |
| `neon` | dark | launches, gaming, music, developer-conference energy, short punchy decks | long text, serious board reports |
| `corporate` | light | business reviews, sales, internal updates, anything with charts and tables, a brand color | storytelling that needs atmosphere |
| `fantasy` | dark | storytelling, tabletop games, training told as a narrative, workshops with a quest | plain status updates |
| `pirates` | light | kids, playful workshops, team events, onboarding with a treasure-hunt feel | anything that must look serious |
| `pipboy` | dark | games, retro-futurist tech, developer tools, terminal-style talks, anything that should feel like a console | long prose, formal reports, wide tables |
| `skyrim` | dark | fantasy and games, adventure and travel stories, calm and serious storytelling, long-form talks with an atmosphere | dense dashboards, bright rooms, party-style events |

Light themes project well in a bright room and print well; dark themes suit a dim room and a big screen. When the user gives no theme, pick from this table by audience and tone, say which and why in one line, and say that changing it is one word.

## Vocabulary

Each theme words the chrome in its own world through `vocabulary`; a deck in another language overrides the strings in its config (all keys optional): `map`, `mapHint`, `counter` (`{n}` and `{N}`), `backupCounter` (`{L}`), `section`, `now`, `notes`, `timer`, `next`, `presenter`, `rotate`, `hint`.

| Theme | Map | Counter | Presenter window |
|---|---|---|---|
| `space` | Star chart | `SOL 3 / 18` | Mission control |
| `editorial` | Contents | `3 of 18` | The desk |
| `neon` | Tracklist | `TRACK 3/18` | DJ booth |
| `corporate` | Agenda | `3 / 18` | Presenter view |
| `fantasy` | The atlas | `Folio 3 of 18` | The scribe |
| `pirates` | The treasure map | `Port 3 of 18` | Captain's quarters |
| `pipboy` | Data | `LVL 3/18` | Overseer's terminal |
| `skyrim` | Map | `Stop 3 of 18` | The skald’s lectern |

For a deck that tells its own story (a journey, a lab, a kitchen), name the sections in the same world and override `map` and `counter` to match: one metaphor from the title to the map.

## What each theme does

**space.** Black-blue void with a faint nebula, twinkling stars and drifting dust. Titles in Big Shoulders Display capitals, body in Atkinson Hyperlegible Next, code in Atkinson Hyperlegible Mono. The six accents are cyan, amber, mint, coral, violet and pink, one per section. Slides change with a warp: stars streak in the direction of travel. Art: a ringed planet (hero), a ringed planet in the section accent (chapter), a rocket (closing).

**editorial.** Warm paper with grain and slow ink-wash light. Fraunces headlines in sentence case (an `<em>` in a headline switches to italic Source Serif in the accent color), Source Serif 4 for text, JetBrains Mono for labels. Structure comes from hairline rules rather than boxes; the accents are ink blue, oxblood, green, ochre, plum and teal. Slides lift: a fade and rise with a glint of light across the page. Diagram shapes get a slightly hand-drawn edge. Art: an open book with a pen (hero), a framed ink blot (chapter), a wax seal (closing).

**neon.** Black-violet night with a synthwave horizon: a perspective grid scrolls toward a striped sun. Unbounded capitals with a stacked glow, Chakra Petch for text (the type scale is smaller because Unbounded is wide). Accents are cyan, magenta, lime, orange, violet and rose. Slides zoom through a tunnel with a glow. Running text carries a dark halo so it stays readable over the sun. Art: a lightning bolt in a ring (hero), a glowing triangle (chapter), a four-point star with an orbit (closing).

**corporate.** White page, slate-navy ink, soft panels with shadows and large pale shapes drifting behind. Manrope for display and body. One brand color from the config key `"accent"` (for example `"accent": "#d9480f"`) re-tints the title, the section accents, diagrams and charts; the other five accents are derived from it. Slides glide sideways. Art: a dashboard (hero), a ring and a diamond (chapter), a target with an arrow (closing).

**fantasy.** Candlelit manuscript: burgundy-black with parchment text and gold. Cinzel capitals, EB Garamond text (quotes in italic), JetBrains Mono for labels. Fireflies, rising embers and low fog drift behind the slide and a candle flicker moves the vignette. Slides dissolve with blur and a burst of gold sparks. Accents are gold, rose, emerald, sapphire, amethyst and amber. Cinzel draws the digit 1 as a Roman numeral, so counters read like folios. Art: a castle under a crescent moon (hero), a rune circle (chapter), a scroll with a wax seal (closing).

**pirates.** The only theme with a tan treasure-map parchment, grain and burnt edges. Pirata One blackletter in mixed case for headings, Alegreya Sans for text. X marks replace bullets and timeline stops, cards look like torn paper with tape, and stat numbers use a fixed red. Rolling waves, drifting clouds and a small ship sail along the bottom. Slides rock sideways like a sail. Accents are sea blue, red, ochre, green, teal and purple. The lower third of a slide is busier than in other themes, so keep content above it. Art: a ship (hero), a compass rose (chapter), a treasure chest with an X (closing).

**pipboy.** A green phosphor terminal in the spirit of a wasteland wrist computer. Share Tech Mono serves display, text and code in one weight: headings are capitals and emphasis is inverse video instead of bold or italic (the label above a title is a tab, a `<strong>` is a highlighted menu row, an `<em>` turns amber). Panels get corner brackets, callouts carry hazard stripes, quotes start with a prompt and table headers are inverse bars. Scanlines and a vignette sit over everything, a refresh bar rolls down the background (it is absent while the background is paused) and the glow takes the section accent. The accents are green, amber, mint, red-orange, sky blue and lime; red-orange is the `danger` tone. Slides change with a scan: a bright line sweeps down the screen with the new slide above it (up when going back) and the text prints in from the left in steps. The header bar shows the section tab, the slide title and `LVL 3/18`. The type is wide and set in capitals, so keep titles shorter than in other themes; the font has no arrows or box symbols, which fall back to the system font. Art: a wrist computer (hero), a radiation gauge (chapter), a vault door (closing). An homage drawn from scratch; `CREDITS.md` carries the affiliation note.

**skyrim.** The menus of a northern fantasy game on a cold Nordic night; the screens of the game's own interface are the model (a shout list, a skill screen, an item card, the compass-star menu, a book list). Light grey-white capitals in Manrope at a thin weight, tracked wide, over Atkinson Hyperlegible Next text and Atkinson Hyperlegible Mono code; no glow anywhere. Under each heading a hairline rule fades out; panels (`.card`, `.callout`, `.stats`, `pre.code`, `blockquote`, the key help) are thin double-line frames with a small diamond at each corner (drawn with a mask, so they take the grey of the text); a card is an item card (centered title over a hairline, quiet text) and the `stats` layout is its stat row (small caps label over a large light number, hairlines between). List bullets are hollow diamonds, `strong` is the selected entry, chips and links are menu entries with a diamond-arrow selector. The HUD is the header of a skill screen (region at the left, a thin framed progress bar in the middle with the section accent in the segments already seen, the count and the Snowfall button at the right), and `theme.js` adds small round-key button hints at the bottom left (the words `btnMove`, `btnMap` and `btnHelp` of the vocabulary). The map is the compass-star menu: a thin four-point star with a knot in the middle above the title, the sections as hairline-ruled groups and the current entry marked with the selector. The ambient layer is unchanged from the first version: aurora bands that take the section accent, three depths of falling snow that a gust sweeps on every slide change, and two mountain ridges that shift a little with each slide. The accents are ice blue, firelight gold, aurora green, blood red, frost violet and steel grey; green is the `ok` tone and red the `danger` tone. Slides change with a frost: the leaving slide is blown away in a gust while it blurs and whitens, and the new one clears out of the frost (the other way when going back). Headings are set in capitals and the face is wide, so keep them short (about 40 characters at one line). Art: a horned iron helmet drawn as a constellation, stars joined by thin lines, above a row of runes with their transliteration (hero), a compass star with a knot (chapter), a standing-stone circle under aurora rays (closing), and a rune divider, a hairline with two diamonds around the rune row, which is 640 by 76 px unless the deck sets another size (divider). The runes are an angular script of the theme's own with twelve letters (F R O S T E M B D A W N), so the rune words FROST, EMBER and DAWN are the only ones the art can spell. An homage drawn from scratch; `CREDITS.md` carries the affiliation note.

## Art roles

`data-art="hero"` (title slide), `chapter` (chapter slides), `closing` (closing slide) and `divider` (a thin ornament between blocks) exist in every theme. A theme may add `mascot`; none of the eight does. Use the roles instead of images; each theme draws its own art with its colors and line style, so a deck re-skins completely with the theme.

## Limits

Embedded fonts are the Latin subset: English and the Western European languages work (accents included); Cyrillic, Greek, CJK, Arabic and Hebrew fall back to the system font and may not match the theme, so check them with `check.mjs` and look at the screenshots. Only Chrome and Edge are tested.

## Writing a new theme

Copy the folder of the closest theme to `themes/<name>/` and change `theme.json` (name, label, mode, description, fonts by id from `themes/_shared/fonts/fonts.json`, transitions, the tokens `bg`, `text`, `muted`, six `accents`), `theme.css` (every token of `references/contract.md` section 8.2, then the hooks of 8.3, transitions for both directions) and `theme.js` (`Deck.registerTheme` with `defaultTransition`, `vocabulary`, `art` with the four roles and the `ambient` layer). Colors and sizes only through tokens, at most four font files, the ambient layer cheap per frame (pre-render sprites, no allocation in `frame`), paused when hidden, under reduced motion, in capture and in print. `api.accent()` returns the raw text of the custom property, which may be a color function such as `oklch(from …)`: resolve it to RGB through a one-pixel canvas before doing arithmetic. Acceptance is contract section 8.6: build the showcase with the new theme, run `check.mjs` in Chrome and Edge, run `selftest.mjs`, and look at every slide.
