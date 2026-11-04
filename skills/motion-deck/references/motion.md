# Motion

The engine animates a deck without per-element work. This page says what moves by itself, which attributes change that, and how much motion serves a talk.

## What moves by itself

- **Entrance cascade.** When a slide opens, its kicker, title, paragraphs, list items, cards, stats, figures, code and diagrams arrive one after another with a short stagger. Each theme tunes the flavour (distance, blur, speed). Going back to a slide shows it complete, without the entrance.
- **Transition.** The change from one slide to the next comes from the theme (`warp` in space, a page lift in editorial…). A new key press during a transition finishes the previous one at once.
- **Background.** The theme's ambient layer (stars, grid, fog, waves…) runs behind the stage, reacts to each slide change and takes the accent of the current section. It pauses when the tab is hidden.
- **Section accent.** Every section has one accent color; the HUD, the progress track, kickers, bullets and numbers follow it, so a chapter change is visible as a color change.

## Builds (steps)

`data-step="n"` reveals an element on the n-th press. Use a build when the speech goes through points in order and the audience should not read ahead. Rules that keep it good:

- Reveal in speaking order, at most three or four steps per slide. More points means more slides or cards.
- Do not build a slide that has one idea.
- A slide with steps must still read complete at its last step, because that is what print and the PDF show.
- `data-step-out` plus a `.swap` container replaces one block with another in the same place: use it for before and after, old and new, question and answer.
- Diagrams bring their own steps (nodes appear, lines draw, packets flow); they add to the slide's step count.

## Counters

`data-count` counts a number up when it appears (or when its step arrives). Use it for the one or two figures a slide is about, never for a table. The text inside the element is the final value and is what print and reduced motion show.

## Morph

When two consecutive slides hold an element with the same `data-morph` key, that element glides and resizes from its place on the first slide into its place on the second, while the rest cross-fades. It works for a card that grows into a panel, a number that moves to a corner, a small figure that becomes the main picture. One morph pair per transition; two is the limit. Chrome and Edge do it natively; elsewhere the normal transition runs.

## Transitions

| Name | Look | Where |
|---|---|---|
| `slide` | slides sideways | engine, default fallback |
| `fade` | cross-fade | engine |
| `rise` | new slide rises while the old fades | engine |
| `zoom` | slight zoom through | engine |
| `none` | cut | engine |
| theme transitions | `warp` (space), `lift` (editorial), `tunnel` (neon), `glide` (corporate), `dissolve` (fantasy), `sail` (pirates) | each theme, its default |

Use the theme's default for the whole deck. Set `data-transition="none"` on a slide that continues the previous one (a second half of a diagram, a reveal), or `data-transition="fade"` for a quiet slide such as a quote. Set the config key `transition` only to force one style on every slide.

## Entrance overrides

`data-anim` on a slide changes how its children enter (`fade`, `left`, `right`, `zoom`, `pop`, `none`); on one element it changes that element. `data-delay="400"` waits 400 ms more. Good reasons: a statement that should arrive as one block (`data-anim="fade"`), a chip that should pop. Without a reason, leave the defaults.

## Reduced motion, capture and print

- With the system setting "reduce motion": no entrance, no transition, no counting, one static background frame, steps appear instantly. Everything stays readable.
- Capture mode (`?capture=1` in the URL) freezes all motion and finishes every animation; the check uses it for screenshots.
- Print and PDF: one slide per page, every step shown, the theme's page color, no HUD, no moving background.

## Pacing

A slide earns about 45 to 60 seconds. One build every 15 to 30 seconds of speech, one counter or morph per slide at most, and a chapter slide to reset the eye every three to five slides. When a slide combines steps, a counter and a morph, remove two of them.
