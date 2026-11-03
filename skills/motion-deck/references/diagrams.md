# Diagrams and charts: author guide

This guide is for the model that writes diagrams for a motion-deck slide. A diagram is a small JSON spec. You never compute pixel coordinates: you say which cell of a grid each node sits in and which nodes connect, and `engine/diagram.js` does the layout, the animation and the theme colors. The engine fails with readable errors that name the path inside the spec, so read them and fix the spec.

## 1. Embedding

Put the spec inside the svg of a `diagram` layout slide (or any slide). The runtime reads the JSON, mounts it once after the fonts are loaded and then drives it with the slide step.

```html
<section class="slide" data-layout="diagram" data-title="Pipeline">
  <div class="kicker">How it flows</div>
  <h2>Four stages, one direction</h2>
  <svg data-diagram viewBox="0 0 1360 540" role="img" aria-label="Sources flow through clean and score into a weekly report">
    <script type="application/json">{ "grid": {"cols": 4}, "nodes": [ ... ], "edges": [ ... ] }</script>
  </svg>
</section>
```

The `viewBox` is the free area of the slide; the grid fills it. Use `0 0 1360 540` unless the slide has a caption or other content, then shrink the height (for example `0 0 1360 460`). Without a viewBox the engine sets `0 0 1360 540`. Always give the svg a `role="img"` and an `aria-label` that says what the diagram shows. Keys that start with `_` anywhere in the spec are ignored, use them for notes. The JSON must be valid: double quotes, no comments, no trailing commas.

## 2. Spec reference

Top level keys: `grid`, `nodes`, `edges`, `uniform` (default true, set false to stop the automatic equal sizing of boxes). Anything else is an error.

### 2.1 Grid

| Key | Default | Meaning |
|---|---|---|
| `cols`, `rows` | the highest `at` plus `span` used | size of the grid, whole numbers |
| `gap` | 56 (64 when the spec has a group) | space between cells in viewBox units |
| `padding` | 12 | space around the grid; with groups the frames get extra room so they stay inside |

Cells are numbered from 0: `"at": [col, row]`. `"span": [cols, rows]` (default `[1,1]`) makes a node cover more cells. A node is centered in its cell or span.

### 2.2 Common node properties

| Key | Default | Meaning |
|---|---|---|
| `id` | none | name used by edges and badges; letters, digits, `-`, `_` |
| `kind` | `box` | one of the kinds in 2.3 |
| `at`, `span` | none | grid placement; every node needs `at` or `x` and `y` |
| `x`, `y` | none | absolute top-left corner in viewBox units (instead of `at`) |
| `w`, `h` | measured from the text | force a size; the text must still fit or the engine throws |
| `fill` | false | true: the node fills its whole cell instead of its natural size |
| `tone` | accent of the slide | 1 to 6 (the theme accents `--a1` to `--a6`), or `muted`, `danger`, `ok`; it tints border, icon and fill |
| `step` | 0 | appears when the slide step reaches this number |
| `out` | never | disappears from this step on; must be greater than `step` |
| `highlight` | none | at exactly this step an accent outline pulses around the node and stays while the step is current |
| `delay` | automatic | entrance delay in ms (overrides the automatic stagger) |
| `sync` | false | true: enters together with the previous element |
| `entrance` | by kind | `rise`, `fade`, `pop` or `none` |

Size rules for boxes: the width follows the text (minimum 150, maximum 300 or the cell width minus room for connectors), long labels wrap and the height grows. All boxes of the same kind with span 1x1 and no `w` get the same width, and the same height inside a row, so a row of boxes looks tidy. If a box cannot hold its text inside its cell the engine throws instead of overlapping.

### 2.3 Kinds

| Kind | Required | Options | Notes |
|---|---|---|---|
| `box` | `label` | `sub`, `icon`, `maxW` | the workhorse: rounded panel with a bold label and a smaller `sub` line |
| `pill` | `label` | `icon`, `maxW` | fully rounded; use for start, end, state names |
| `chip` | `label` | `icon`, `maxW` | small pill, 20 px text; for tags and short annotations |
| `diamond` | `label` | `sub`, `maxW` | a decision; keep the label to a short question |
| `text` | `label` | `size` (28), `align` (`middle`, `start`, `end`), `valign` (`top`, `middle`, `bottom`), `weight` (`bold`), `mono` | free text without a frame; it fills its cell, wraps to the cell width |
| `group` | none | `title`, `dashed` | a titled frame drawn behind the nodes of the cells it spans; it may share cells with its content |
| `stack` | `label` | like `box` | three offset boxes: many instances of the same thing |
| `person` | `label` | `sub`, `maxW` | simple human glyph with a caption below |
| `cylinder` | `label` | `sub`, `maxW` | a data store |
| `cloud` | `label` | `sub`, `maxW` | an external service or the internet |
| `dot` | none | `label`, `labelPos` (`r`, `b`, `t`), `size` (20) | a small marker |
| `ring` | `value` 0 to 100 | `label` | progress ring with the percentage in the middle |
| `spinner` | none | `label` | a rotating arc (still in capture and print) |
| `ghost` | `label` | like `box` | dashed placeholder: something missing or unknown |
| `badge` | `label` | `attach` (node id), `corner` (`tr`, `tl`, `br`, `bl`) | small numbered circle; with `attach` it sits on the corner of that node, otherwise give it `at` or `x`,`y` |
| `bars` | `values` | `labels`, `orient` (`v`, `h`), `hi`, `unit`, `prefix`, `decimals`, `ticks`, `max`, `title` | bar chart |
| `line` | `values` (2 or more) | `labels`, `area`, `smooth`, `markers`, `unit`, `prefix`, `decimals`, `ticks`, `min`, `max`, `zero`, `title` | line chart with an end-point marker |
| `donut` | `segments` | `center`, `centerSub`, `unit`, `decimals`, `legend` (true), `title` | segments are `{"label", "value", "tone"?}`; the center shows the total unless `center` is set |
| `gauge` | `value` | `max` (100), `label`, `unit`, `decimals` | 270 degree arc with the value in the middle |
| `kpi` | `value`, `label` | `prefix`, `suffix`, `delta`, `deltaTone`, `decimals` | big number card; `delta` like `"+12%"` shows a triangle, green for `+`, red for `-` |

Icons for `box`, `pill`, `chip`: `user`, `db`, `doc`, `gear`, `lock`, `bolt`, `check`, `alert`, `search`, `globe`, `mail`, `code`, `chat`, `clock`. An icon takes 44 px of the box width, so skip it when the cell is narrow.

Charts: `values` are numbers (bars need 0 or more), `labels` must have the same length as `values`. One scale per chart: the axis ends at the first round tick at or above the largest value (or at `max`), and ticks and labels only exist up to there. `unit` and `prefix` go on tick labels and value labels (`"unit": "%"`, `"prefix": "$"`). `bars`: `hi` is an index or a list of indexes, the highlighted bars take the tone color and the rest turn grey; `orient: "h"` draws horizontal bars and hides the ticks unless `ticks: true`. `line`: the axis starts at 0 unless `zero: false` or `min` is given; `area: true` fills under the line; `smooth: true` rounds the curve. Charts fill their cell, so give them a cell (or span) of their own and put no other node in it.

### 2.4 Edges

An edge connects two nodes by id. Edges are drawn under the nodes, arrow tips land exactly on the border of the target.

| Key | Default | Meaning |
|---|---|---|
| `from`, `to` | required | node ids (any kind, groups included) |
| `anchors` | automatic | `[fromSide, toSide]` with `l`, `r`, `t`, `b` or null; use it when the automatic side looks wrong, for example `["b","t"]` to leave downwards |
| `style` | `auto` | `straight`, `elbow` (right angles with rounded corners), `curve`; `auto` is straight when the two points line up, elbow otherwise |
| `arrow` | `end` | `end`, `start`, `both`, `none` |
| `dashed` | false | dashed line; it fades in instead of drawing itself |
| `label` | none | short text on a pill over the line; the line must be long enough or the engine throws |
| `tone` | muted grey | 1 to 6, `muted`, `danger`, `ok` |
| `draw` | true | false: the edge fades in instead of drawing itself |
| `packets` | none | `true`, a count, or `{"count": 1 to 8, "dur": seconds (2.4)}`: small dots travel along the line in a loop; they stand still in capture, print and reduced motion |
| `step`, `out`, `highlight`, `delay`, `sync` | see below | as for nodes |

An edge without `step` appears together with the later of its two nodes, and an edge without `out` leaves with the first of its nodes to leave, so a connector never dangles. When several edges leave from or arrive at the same side of a node that are visible at the same time, they are spread along that side.

### 2.5 Steps and motion

`step: k` hides the element until the slide step is at least k and plays its entrance then. `out: m` hides it from step m. `highlight: k` pulses an outline at step k. The slide has as many steps as the largest k, m or highlight of the diagram. Going forward through the steps plays only what newly appears; entering the slide plays the cascade of the elements that have no step.

Elements without a `step` enter when the slide becomes active, staggered: the first starts after 240 ms, then one element every 90 ms in the order of the spec (nodes first, then edges; an edge starts shortly after its source node). Elements with the same `step` stagger every 90 ms. Entrances: boxes and most shapes rise, text and charts fade (bars grow, lines draw, donuts sweep, rings and gauges fill), edges draw themselves and then show arrow head and label, dots and badges pop. At the final step of the diagram the outline of an element whose `highlight` equals that step stays visible in the finished frame, so keep `highlight` below the last step unless you want it in print.

The finished diagram is always the natural state: capture, print and reduced motion show it without animation.

### 2.6 Theme and look

Everything is drawn with the theme tokens, with fallbacks: `--panel`, `--line`, `--bg`, `--bg-2`, `--text`, `--muted`, `--acc` (accent of the slide), `--a1` to `--a6`, `--on-acc`, `--f-body`, `--f-display`, `--f-mono`, `--radius`, `--stroke`. So it follows dark and light, serif and sans themes. Never write colors in a spec: use `tone`. Color means something: one tone per idea (for example blue for input, amber for processing, green for good, red for failure), and `muted` for what is old or irrelevant.

## 3. Layout advice

One idea per diagram, 3 to 7 nodes. Above 9 nodes split the story into two slides or use steps to reveal it in stages; the engine accepts up to about 24 nodes, but nobody can read that on a projector. Labels under three words (`Clean`, `Score rows`), put the detail in `sub` (under 25 characters). Read left to right or top to bottom, loops go back along the outside with `anchors`. Give connectors room: leave at least one empty column between nodes that have a labelled edge, and keep edge labels to one word.

Use steps to tell a story: show the first node, then add one idea per step, and use `out` to swap an old node for a new one in the same cell (two nodes may share a cell when one leaves before the other arrives). Use `group` to show layers or before and after, and give each group its own tone. Use `packets` on the one or two edges where data really flows, not on every edge. Do not mix a chart with a flow diagram; a chart gets its own slide or its own cell next to a short `text`.

Grid recipes: a pipeline is `cols: N, rows: 1`. A decision flow is `rows: 3` with the diamond in the middle row and the branches above and below. Layers are `rows: 3` with a `group` per row spanning all columns. A cycle is a 3x3 grid with four nodes on the cross, curved edges with `anchors`, and a `text` in the middle. A KPI row is `cols: N, rows: 1` of `kpi` nodes.

## 4. Worked examples

### 4.1 pipeline

Use for a linear flow of 3 to 5 stages. One row of boxes, tones that change per stage, packets on the edges to show data moving, a one-word label on an edge when the step needs naming.

```json
{
  "grid": {
    "cols": 4,
    "rows": 1
  },
  "nodes": [
    {
      "id": "src",
      "label": "Sources",
      "sub": "files, APIs",
      "icon": "doc",
      "at": [
        0,
        0
      ],
      "tone": 1
    },
    {
      "id": "clean",
      "label": "Clean",
      "sub": "dedupe",
      "icon": "gear",
      "at": [
        1,
        0
      ],
      "tone": 2
    },
    {
      "id": "model",
      "label": "Score",
      "sub": "per row",
      "icon": "bolt",
      "at": [
        2,
        0
      ],
      "tone": 3
    },
    {
      "id": "out",
      "label": "Report",
      "sub": "weekly digest",
      "icon": "mail",
      "at": [
        3,
        0
      ],
      "tone": 4
    }
  ],
  "edges": [
    {
      "from": "src",
      "to": "clean",
      "packets": 2
    },
    {
      "from": "clean",
      "to": "model",
      "label": "valid",
      "packets": 2
    },
    {
      "from": "model",
      "to": "out",
      "packets": true
    }
  ]
}
```

### 4.2 decision-flow

Use for a choice with consequences. The diamond sits in the middle row, the branches go up and down with labels, steps reveal the happy path first and the rework path second, and a dashed edge closes the loop.

```json
{
  "grid": {
    "cols": 4,
    "rows": 3
  },
  "nodes": [
    {
      "id": "req",
      "label": "Request",
      "sub": "pull request",
      "icon": "code",
      "at": [
        0,
        1
      ],
      "tone": 1
    },
    {
      "id": "check",
      "kind": "diamond",
      "label": "Tests green?",
      "at": [
        1,
        1
      ],
      "highlight": 1
    },
    {
      "id": "ship",
      "label": "Merge",
      "sub": "to main",
      "icon": "check",
      "at": [
        2,
        0
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "fix",
      "label": "Rework",
      "sub": "back to author",
      "icon": "alert",
      "at": [
        2,
        2
      ],
      "tone": "danger",
      "step": 2
    },
    {
      "id": "done",
      "kind": "pill",
      "label": "Released",
      "at": [
        3,
        0
      ],
      "tone": "ok",
      "step": 3
    }
  ],
  "edges": [
    {
      "from": "req",
      "to": "check"
    },
    {
      "from": "check",
      "to": "ship",
      "label": "yes",
      "anchors": [
        "t",
        "l"
      ],
      "tone": "ok"
    },
    {
      "from": "check",
      "to": "fix",
      "label": "no",
      "anchors": [
        "b",
        "l"
      ],
      "tone": "danger"
    },
    {
      "from": "ship",
      "to": "done",
      "tone": "ok"
    },
    {
      "from": "fix",
      "to": "req",
      "anchors": [
        "l",
        "b"
      ],
      "dashed": true,
      "tone": "danger"
    }
  ]
}
```

### 4.3 layered

Use for an architecture in layers. One `group` per row spanning every column, boxes, stacks and stores inside, steps that add one layer at a time, and a few vertical edges between layers.

```json
{
  "grid": {
    "cols": 3,
    "rows": 3
  },
  "nodes": [
    {
      "id": "L1",
      "kind": "group",
      "title": "Experience",
      "at": [
        0,
        0
      ],
      "span": [
        3,
        1
      ],
      "tone": 1
    },
    {
      "id": "web",
      "label": "Web app",
      "icon": "globe",
      "at": [
        0,
        0
      ],
      "tone": 1
    },
    {
      "id": "mob",
      "label": "Mobile",
      "icon": "user",
      "at": [
        1,
        0
      ],
      "tone": 1
    },
    {
      "id": "cli",
      "label": "CLI",
      "icon": "code",
      "at": [
        2,
        0
      ],
      "tone": 1
    },
    {
      "id": "L2",
      "kind": "group",
      "title": "Services",
      "at": [
        0,
        1
      ],
      "span": [
        3,
        1
      ],
      "tone": 2,
      "step": 1
    },
    {
      "id": "auth",
      "label": "Auth",
      "icon": "lock",
      "at": [
        0,
        1
      ],
      "tone": 2,
      "step": 1
    },
    {
      "id": "api",
      "kind": "stack",
      "label": "API pods",
      "at": [
        1,
        1
      ],
      "tone": 2,
      "step": 1
    },
    {
      "id": "jobs",
      "kind": "stack",
      "label": "Workers",
      "at": [
        2,
        1
      ],
      "tone": 2,
      "step": 1
    },
    {
      "id": "L3",
      "kind": "group",
      "title": "Data",
      "at": [
        0,
        2
      ],
      "span": [
        3,
        1
      ],
      "tone": 3,
      "step": 2
    },
    {
      "id": "pg",
      "kind": "cylinder",
      "label": "Postgres",
      "at": [
        0,
        2
      ],
      "tone": 3,
      "step": 2
    },
    {
      "id": "redis",
      "kind": "cylinder",
      "label": "Cache",
      "at": [
        1,
        2
      ],
      "tone": 3,
      "step": 2
    },
    {
      "id": "s3",
      "kind": "cloud",
      "label": "Object store",
      "at": [
        2,
        2
      ],
      "tone": 3,
      "step": 2
    }
  ],
  "edges": [
    {
      "from": "mob",
      "to": "api",
      "anchors": [
        "b",
        "t"
      ]
    },
    {
      "from": "api",
      "to": "redis",
      "anchors": [
        "b",
        "t"
      ],
      "packets": true
    },
    {
      "from": "auth",
      "to": "pg",
      "anchors": [
        "b",
        "t"
      ]
    },
    {
      "from": "jobs",
      "to": "s3",
      "anchors": [
        "b",
        "t"
      ]
    }
  ]
}
```

### 4.4 before-after

Use to compare two states. Two groups in danger and ok tones, the second one arrives at step 1, and a pill with two edges in the middle column tells what happened.

```json
{
  "grid": {
    "cols": 5,
    "rows": 2
  },
  "nodes": [
    {
      "id": "before",
      "kind": "group",
      "title": "Before",
      "at": [
        0,
        0
      ],
      "span": [
        2,
        2
      ],
      "tone": "danger",
      "dashed": true
    },
    {
      "id": "b1",
      "label": "Excel files",
      "sub": "by hand",
      "at": [
        0,
        0
      ],
      "tone": "muted"
    },
    {
      "id": "b2",
      "label": "Email",
      "sub": "attachments",
      "at": [
        1,
        0
      ],
      "tone": "muted"
    },
    {
      "id": "b3",
      "kind": "ghost",
      "label": "Who owns it?",
      "at": [
        0,
        1
      ]
    },
    {
      "id": "b4",
      "label": "Copy and paste",
      "at": [
        1,
        1
      ],
      "tone": "muted"
    },
    {
      "id": "after",
      "kind": "group",
      "title": "After",
      "at": [
        3,
        0
      ],
      "span": [
        2,
        2
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "a1",
      "label": "Form",
      "sub": "validated input",
      "at": [
        3,
        0
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "a2",
      "kind": "cylinder",
      "label": "Database",
      "at": [
        4,
        0
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "a3",
      "label": "Dashboard",
      "at": [
        3,
        1
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "a4",
      "label": "Alerts",
      "at": [
        4,
        1
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "mid",
      "kind": "pill",
      "label": "migrate",
      "at": [
        2,
        0
      ],
      "span": [
        1,
        2
      ],
      "tone": 1,
      "step": 1,
      "h": 56
    }
  ],
  "edges": [
    {
      "from": "b1",
      "to": "b2",
      "tone": "muted"
    },
    {
      "from": "b3",
      "to": "b4",
      "tone": "muted",
      "dashed": true
    },
    {
      "from": "before",
      "to": "mid",
      "anchors": [
        "r",
        "l"
      ],
      "tone": 1
    },
    {
      "from": "mid",
      "to": "after",
      "anchors": [
        "r",
        "l"
      ],
      "tone": 1
    },
    {
      "from": "a1",
      "to": "a2",
      "tone": "ok"
    },
    {
      "from": "a2",
      "to": "a4",
      "anchors": [
        "b",
        "t"
      ],
      "tone": "ok"
    },
    {
      "from": "a3",
      "to": "a4",
      "tone": "ok"
    }
  ]
}
```

### 4.5 human-loop

Use when a person checks or corrects a machine. A person node, a diamond gate, numbered badges attached to nodes that show the order, and a highlighted dashed edge for the correction loop.

```json
{
  "grid": {
    "cols": 4,
    "rows": 2
  },
  "nodes": [
    {
      "id": "req",
      "label": "Request",
      "icon": "mail",
      "at": [
        0,
        0
      ],
      "tone": 1
    },
    {
      "id": "ai",
      "label": "AI draft",
      "sub": "first answer",
      "icon": "bolt",
      "at": [
        1,
        0
      ],
      "tone": 5
    },
    {
      "id": "gate",
      "kind": "diamond",
      "label": "Confident?",
      "at": [
        2,
        0
      ],
      "step": 1
    },
    {
      "id": "done",
      "kind": "pill",
      "label": "Sent",
      "at": [
        3,
        0
      ],
      "tone": "ok",
      "step": 1
    },
    {
      "id": "rev",
      "kind": "person",
      "label": "Reviewer",
      "sub": "checks and edits",
      "at": [
        2,
        1
      ],
      "tone": 2,
      "step": 2
    },
    {
      "id": "n1",
      "kind": "badge",
      "label": "1",
      "attach": "req",
      "corner": "tl"
    },
    {
      "id": "n2",
      "kind": "badge",
      "label": "2",
      "attach": "ai",
      "corner": "tl",
      "step": 1
    },
    {
      "id": "n3",
      "kind": "badge",
      "label": "3",
      "attach": "rev",
      "corner": "tr",
      "step": 2
    }
  ],
  "edges": [
    {
      "from": "req",
      "to": "ai",
      "packets": true
    },
    {
      "from": "ai",
      "to": "gate",
      "step": 1
    },
    {
      "from": "gate",
      "to": "done",
      "label": "high",
      "tone": "ok"
    },
    {
      "from": "gate",
      "to": "rev",
      "label": "low",
      "anchors": [
        "b",
        "t"
      ],
      "tone": 2
    },
    {
      "from": "rev",
      "to": "ai",
      "anchors": [
        "l",
        "b"
      ],
      "label": "edit",
      "tone": 2,
      "dashed": true,
      "highlight": 3
    }
  ]
}
```

### 4.6 bar-chart

Use for one comparison where one bar is the point. `hi` colors that bar and greys the others, `unit` and `prefix` format the labels, one `highlight` step frames the chart at the end.

```json
{
  "nodes": [
    {
      "id": "rev",
      "kind": "bars",
      "at": [
        0,
        0
      ],
      "title": "Revenue per quarter",
      "values": [
        12,
        18,
        26,
        41,
        38
      ],
      "labels": [
        "Q1",
        "Q2",
        "Q3",
        "Q4",
        "Q5"
      ],
      "hi": 3,
      "unit": "k",
      "prefix": "$",
      "highlight": 1
    }
  ]
}
```

### 4.7 line-area

Use for a trend over time. A line chart over two columns with an area fill and a smooth curve, and a `text` node in the third column that states the conclusion.

```json
{
  "grid": {
    "cols": 3,
    "rows": 1
  },
  "nodes": [
    {
      "id": "users",
      "kind": "line",
      "at": [
        0,
        0
      ],
      "span": [
        2,
        1
      ],
      "title": "Weekly active users",
      "values": [
        120,
        150,
        148,
        210,
        260,
        310,
        295,
        380,
        450,
        520
      ],
      "labels": [
        "W1",
        "W2",
        "W3",
        "W4",
        "W5",
        "W6",
        "W7",
        "W8",
        "W9",
        "W10"
      ],
      "area": true,
      "smooth": true,
      "tone": 6
    },
    {
      "id": "note",
      "kind": "text",
      "at": [
        2,
        0
      ],
      "label": "Growth doubled after the onboarding change in week 4.",
      "size": 30,
      "align": "start"
    }
  ]
}
```

### 4.8 kpi-row

Use for three or four headline numbers. `kpi` cards with a delta, and one `gauge` for a target; `deltaTone` overrides the color when a falling number is good news.

```json
{
  "grid": {
    "cols": 4,
    "rows": 1
  },
  "nodes": [
    {
      "id": "k1",
      "kind": "kpi",
      "at": [
        0,
        0
      ],
      "value": 1280,
      "prefix": "$",
      "suffix": "k",
      "label": "Monthly revenue",
      "delta": "+12%",
      "tone": 1
    },
    {
      "id": "k2",
      "kind": "kpi",
      "at": [
        1,
        0
      ],
      "value": 4.8,
      "label": "Support rating",
      "delta": "+0.3",
      "tone": 3
    },
    {
      "id": "k3",
      "kind": "kpi",
      "at": [
        2,
        0
      ],
      "value": 7.2,
      "suffix": "%",
      "label": "Churn",
      "delta": "-1.4%",
      "deltaTone": "ok",
      "tone": 4
    },
    {
      "id": "g1",
      "kind": "gauge",
      "at": [
        3,
        0
      ],
      "value": 78,
      "unit": "%",
      "label": "Goal reached",
      "tone": 6
    }
  ]
}
```

More fixtures to copy from are in `examples/fixtures/diagrams/`: `data-flow` (cylinder, cloud, dashed edge, packets), `cycle` (curved loop), `donut`, `steps-story` (swap with `out`), `kinds-tour` and `progress-kinds` (one of every kind), `stress-24` (24 nodes). Open `examples/diagram-lab.html#<name>` in a browser to see one; add `?step=2`, `?capture=1`, `?theme=light` or `?font=serif`.

## 5. Errors and how to fix them

Every error starts with `MotionDiagram:` and a path such as `nodes[3] "db"` or `edges[1] "a->b"` (the number is the index in the array, the text in quotes is the id).

| Message contains | Cause | Fix |
|---|---|---|
| `unknown kind "databse", did you mean "cylinder"?` | misspelt or invented kind | use a kind from 2.3; the hint names the closest one |
| `unknown property "lable", did you mean "label"?` | misspelt key (common: `type` for `kind`, `text` for `label`, `source` and `target` for `from` and `to`) | use the suggested key |
| `unknown node id "cashe" in "to", did you mean "cache"?` | an edge or badge names a node that does not exist | fix the id or add the node |
| `needs a position` | a node has neither `at` nor `x` and `y` | add `"at": [col,row]` |
| `both occupy cell [c,r]` | two nodes share a cell at the same time | move one, use `span`, or let one leave with `out` before the other arrives |
| `reaches column 4 but the grid has 4 column(s)` | `at` or `span` leaves the grid | raise `grid.cols` or `rows`, or move the node |
| `the text "..." is Npx wide but only Mpx fit` | a word is wider than the box | shorten the word, use fewer columns, a bigger `span` or a larger `w` |
| `the content needs Npx of height but only Mpx are available` | too many lines for the cell | shorten label and `sub`, use fewer rows, a bigger `span` or a larger `h` |
| `does not fit inside the viewBox` | an absolute `x`, `y`, `w`, `h` leaves the svg | move or shrink it |
| `the label "..." needs Npx but the connector has only Mpx` | an edge label is longer than the free line | shorten the label, widen `gap`, move the nodes apart or choose other `anchors` |
| `"labels" has N item(s) but "values" has M` | chart arrays differ | make them the same length |
| `"hi" 7 is not an index into "values"` | bad highlight index | use 0 to the last index |
| `legend label ... is too long` or `center text ... does not fit` | donut text too long | shorten it, widen the chart or set `"legend": false` |
| `kind "bars" with "x"/"y" also needs "w" and "h"` | absolute chart or group without a size | add `w` and `h`, or place it with `at` |
| `"out" (2) must be greater than "step" (3)` | an element would leave before it arrives | swap the numbers |
| `duplicate id` | two nodes share an id | rename one |

When you fix a spec, change only what the message names and run the check again: a deck build does not catch spec errors, the browser does, so open the slide (or the lab) after every edit.
