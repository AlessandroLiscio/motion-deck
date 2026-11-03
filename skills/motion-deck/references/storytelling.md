# Storytelling for a deck

A deck that moves well still fails when the story is loose. Settle the story first, then write markup.

## 1. One sentence

Write the one sentence the audience should repeat after the talk, and who it is for. Every slide either supports it or goes. If the user gave notes or a document, extract their claims and numbers; keep their wording for facts and figures, and never add a fact, number, name or quote that is not in the source.

## 2. An arc

| Talk | Arc | Typical slides |
|---|---|---|
| Pitch, proposal | problem, insight, solution, proof, ask | title, problem (stats), insight (statement), how (diagram), proof (stats, quote), ask (closing) |
| Report, review | situation, complication, question, answer | title, context, what changed, options (cards), recommendation, next steps (timeline) |
| Technical talk | goal, constraints, design, demo, results, lessons | title, goal, architecture (diagram), key decision (split), code, results (chart), lessons (cards) |
| Teaching, workshop | why it matters, concept, example, practice, recap | title, hook, concept (diagram), example (code or cards), exercise, recap (timeline) |
| Story, keynote | hook, journey in chapters, turn, return | title, hook (statement), chapters with art, turn (quote), closing |

Pick the closest and adapt; do not follow a table blindly.

## 3. Length

About one slide per minute of talk, a little more when slides are light. Ten minutes means 8 to 12 slides, thirty minutes 20 to 28. Add a chapter slide for every three to five content slides, and put answers to likely questions in backup slides (`data-backup`) after the closing.

## 4. Titles are claims

A title says what is true, in at most ten words: "Reviews wait longer than builds", not "Review process". The kicker above it names the topic ("Cycle time"). Readers who only look at titles should still follow the argument.

## 5. A metaphor for the sections

Name the sections after one metaphor that fits the topic and the theme: a launch (Countdown, Orbit, Landing), a journey (Map, Crossing, Arrival), a book (Prologue, Chapters, Epilogue), a workshop (Tools, Craft, Showroom). The map overlay, the HUD label, the progress track and the backup slides then tell the story too. Keep section labels short (one or two words). Each theme brings default words for the map and the counter; override them with `vocabulary` when the metaphor differs, and always in a deck that is not in English.

## 6. Rhythm

- Alternate dense and light: after two content slides, give a statement, a quote, stats or a chapter slide.
- A new idea is a new slide; a new point of the same idea is a build.
- Every claim gets one piece of evidence on its slide: a number (`stats`), a diagram, a quote, a short code sample. Decoration is not evidence.
- Use the strongest layout for the content: numbers as stats, parallel options as cards, order as a timeline, structure and flow as a diagram.
- Open with the promise (what the audience will get), close with one action. Do not end on "Questions?" or "Thank you" alone; add what to do next.

## 7. Speaker notes

Notes carry the talk: what to say, the example to tell, the transition to the next slide, a timing cue when a slide needs long. 40 to 90 words, spoken language, same language as the deck. They never repeat the slide text. The presenter window shows them next to a preview of the next slide and a timer set by `timer` in the config.

## 8. Words

Plain words, concrete numbers, active verbs. Cut "very", "really", "leverage", "unlock", "seamless". Keep one term for one thing. Numbers carry units and a period ("42 ms median, last 30 days"). A figure without a source goes in the notes as "to verify".

## 9. Before you build

- Can the one sentence be said after the last slide?
- Does every title state a claim?
- Does every slide have notes?
- Does a chapter or breathing slide appear every three to five slides?
- Is every number and quote from the source, or marked in the notes as an assumption?
- Is the language of the slides, notes and `vocabulary` the language of the brief?
