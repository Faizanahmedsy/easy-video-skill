# Kit reference

Everything in a video is built from `Kit.*` calls (in `engine/kit.js`) and
the helpers of a look (`looks/<name>/look.js`, described in its `LOOK.md`).
Times are in seconds, positions in stage pixels (1920 × 1080 wide, 1080 ×
1920 tall). Most calls that animate return their end time.

```js
Kit.start(window.VIDEO, (v) => {
  const look = Kit.use(v, "clean")
  const A = Kit.shot(v, "intro")
  Kit.show(v, A.S, 0)
  const t = Kit.title(A.P.mid.el, "Ship *faster.*", { x: v.safe.x, y: 300, size: 120 })
  Kit.reveal(v, t, 0.2, { by: "words" })
  Kit.mark(v, t.em[0], 0.8, { kind: "bar" })
  A.P.move(0, 3, { zoom: 1.04 }, { from: { zoom: 1 } })
  v.sfx("swish", 0.2)
})
```

## The video object `v`

| Field / call | What it does |
|---|---|
| `v.tl` | The one paused timeline. Every motion goes on it. |
| `v.W`, `v.H`, `v.k` | Stage size; `k` is 1 when the short side is 1080 px |
| `v.safe` | `{ x, y, w, h, r, b, cx, cy }`: keep words and logos inside |
| `v.ui` | Areas a platform covers on tall videos (keep text out) |
| `v.portrait`, `v.format` | Tall or wide; `"16:9"`, `"9:16"` or `"1:1"` |
| `v.rand()` | Seeded random number (never `Math.random`) |
| `v.onFrame(fn)` | Run `fn(t)` on every frame, for things drawn by hand |
| `v.sfx(kind, at, o)` | A sound at a time: `whoosh`, `swish`, `pop`, `click`, `tick`, `hit`, `key`, `chime` |
| `v.svg(parent)` | A full-stage SVG inside `parent`; returns its `<g>` |
| `v.wait(promise)` | Hold the first frame until something (an image) loads |
| `v.scene(name)` | A bare full-stage scene, hidden until `Kit.show` |
| `v.quiet(from, to)` | Tell the layout check to skip a time span (an overlap you mean) |

`config.js` sets `window.VIDEO`: `format`, `look`, `duration`, `fps`,
`seed`, `backdrop`, `palette` (CSS colour variables) and `audio`.
`backdrop` is one word or several: `"glow"` (soft drifting coloured light),
`"dots"` (a faint dot grid), `"grid"`, `"spot"` or `"none"`, e.g. `"glow dots"`.

## Scenes and camera

| Call | What it does |
|---|---|
| `Kit.shot(v, name, depths?)` | A scene with three depth planes → `{ S, P }` |
| `Kit.planes(v, scene, depths?)` | Depth planes for an existing scene |
| `P.bg`, `P.mid`, `P.fg` | Each plane: `.el` (for HTML) and `.g` (for SVG) |
| `P.move(at, dur, to, { from, ease })` | Camera move: `{ x, y, zoom, rotate }`, near planes move more. Without `from` it starts where the camera is |
| `P.aim(x, y, zoom)` | A move target that zooms toward a stage point (that point stays put) |
| `P.drift(at, dur, { x, y, zoom })` | The slow drift and push-in every shot should have |
| `P.path([{ t, x, y, zoom, rotate }, …])` | One smooth camera through several key poses: it never stops between keys (a key can spread `P.aim(…)`; a first key with only `t` starts where the camera is) |
| `P.at(t)` | Where the camera is at a time: `{ x, y, zoom, rotate }` |
| `Kit.tilt(v, el, at, dur, to, { from })` | Turn a window, card or phone in 3D: `{ rx, ry, rz }` in degrees |
| `Kit.focus(v, el, at, { from, blur, dur })` | Rack focus: blur a plane in or out like a lens |
| `Kit.scenery(v, A.P.bg, kind, { from, to })` | A full-scene background in a plane, larger than the frame: `"studio"`, `"rays"`, `"stars"` |
| `Kit.show(v, els, at)`, `Kit.hide(v, els, at)` | Show or hide at a time |
| `Kit.finish(v, { grain, vignette, tint, leaks })` | Fine film grain, a soft vignette, optional drifting light washes |
| `Kit.bokeh(v, parent, { count, size, opacity, soft })` | Soft out-of-focus discs for depth (small ones behind, big ones in front) |
| `Kit.leak(v, at)` | A band of light sweeps across the frame (on a reveal) |
| `Kit.sheen(v, el, at)` | A glossy highlight sweeps across one element |

**One camera track per shot.** All of a shot's `P.move`, `P.drift` and
`P.path` calls go on one track in time order, and each ends where the next
one begins, so two moves never fight over the camera. A move without `from`
starts exactly where the camera is; a `from` that is somewhere else makes the
camera jump (the motion check finds it). To move through several poses
without stopping, use one `P.path` instead of several moves:

```js
B.P.path([
  { t: 3.3 },                                // from wherever the camera is
  { t: 5.5, zoom: 1.04 },                    // ease in
  { t: 9.8, ...B.P.aim(420, 560, 1.08) },    // and lean toward the table
])
```

## Text

| Call | What it does |
|---|---|
| `Kit.title(parent, str, { x, y, w, size, align, cls, color })` | A masked title. `*word*` highlights, `^word^` is light and quiet, `\|` breaks a line. → `{ el, lines, words, chars, em, lite }` |
| `Kit.reveal(v, t, at, { by, each, dur, rotate, blur })` | Lines, words or chars rise out of their masks |
| `Kit.tracking(v, el, at, { from, to })` | Letter spacing eases from wide to tight |
| `Kit.weight(v, els, at, { from, to })` | Font weight eases (variable fonts) |
| `Kit.unreveal(v, t, at, { to, each, dur })` | They slide away again |
| `Kit.sayWords(v, t, times)` | Each word rises at its own time (spoken words) |
| `Kit.mark(v, span, at, { kind, color, dur })` | A mark on a highlight: `bar` under it, `box` behind it |
| `Kit.typeOn(v, el, str, at, cps)` | Types text in |
| `Kit.count(v, el, from, to, at, dur, fmt)` | Counts a number up |
| `Kit.roll(v, el, "1,284", at, { dur })` | A number rolls into place digit by digit, like a counter |
| `Kit.measure(v, text, cls)` | Width of text at 100 px |
| `Kit.fit(v, text, width, cls, { max, min })` | Font size that makes text exactly `width` wide |

## Cards, data and pointer

| Call | What it does |
|---|---|
| `Kit.card(parent, { x, y, w, h, cls })` | A positioned card |
| `Kit.enter(v, els, at, { y, x, scale, dur, each })` | Rise and settle in |
| `Kit.kpis(v, parent, items, { x, y, w, gap, at, each })` | Number tiles with one shared size, so numbers stay on one line and line up |
| `Kit.table(v, parent, { cols, rows, x, y, w, rowH, at, sortAt, sortBy })` | A table whose rows slide in, and can re-sort |
| `Kit.lineChart(v, parent, { x, y, w, h, values, at, dur, grid, area })` | A line chart that draws itself |
| `Kit.bars(v, parent, { x, y, w, h, values, at, max, gap, hi })` | Bars that grow from the baseline |
| `Kit.ring(v, svgG, { cx, cy, r, w, value, at })` | A progress ring that fills |
| `Kit.donut(v, svgG, { cx, cy, r, w, parts: [{ value, color }], at })` | A donut chart whose parts draw on in turn |
| `Kit.phone(v, parent, { x, y, w })` | A phone (body, keys, camera pill, glass); build the app in `.screen` |
| `Kit.cursor(v, svgG)` | A pointer: `.glide(at, from, to)`, `.click(at)`, `.leave(at, to)` |
| `Kit.float(v, els, { y: 8 }, { period: 3 })` | A gentle float for things that would sit still |
| `Kit.image(v, parent, src, { x, y, w, h })` | A logo or screenshot the first frame waits for |
| `Kit.icon(name, size, color)` | A line icon as SVG text. Names in `Kit.ICONS`: check, arrow, up, down, search, spark, bolt, bell, chart, grid, users, clock, plus, home, inbox, card, lock, globe, settings, send, play, star |
| `Kit.box(el)` | Where an element sits on the stage |

## Transitions

| Call | What it does |
|---|---|
| `Kit.push(v, A, B, at, { dir, dur })` | The old shot slides out, the new one slides in |
| `Kit.panels(v, at, { colors, dir, text })` | Colour panels sweep across and stack; swap shots at the returned `.mid` |
| `Kit.zoomThrough(v, A, B, at, x, y)` | Dive into a point of the old shot, open the new one |
| `Kit.cut(v, A, B, at, { flash })` | A hard cut, with an optional 2-frame flash |
| `Kit.fly(v, el, at, from, to)` | Match cut: an element flies from one place to another |
| `Kit.whip(v, A, B, at, { dir })` | Whip pan: the old shot flies off, the new one lands; motion blur streaks it |
| `Kit.wipe(v, at, { kind, colors, dir })` | Shaped colour layers cover then uncover the frame: `"wave"`, `"circle"`, `"diagonal"`; swap at `.mid` |
| `Kit.clipIn(v, el, at, { from })`, `Kit.clipOut` | A mask reveal on one element: from `left`, `right`, `top`, `bottom`, `center`, `circle` |

Eases: `out`, `inout`, `pop`, `dash`, `rise` (masked type), `land` (arrive with a hair of overshoot),
`glide` (camera), `whip`.

## The checks

`node engine/render.mjs <project> --check` runs two checks over the whole
video and writes them to `out/check.txt`. Every line names the time, says
what is wrong in plain words and ends with a `fix:` hint (how far to move
it, how many words to keep). `scripts/draft.sh` runs it first and stops on a
problem (`--force` skips it). `--only layout` or `--only motion` runs one.

**Layout** (every 0.1 s, outside transitions): text on top of text, text cut
off by its card or the frame, text under a platform's buttons or caption
(tall videos), frames with nothing on screen. Notes that do not stop the
draft: big text outside the safe box, text that stands out too little from
what is behind it (contrast under 3:1, from a screenshot every half second),
small text, and stretches of 3 s or more where nothing moves. Give
decoration that is meant to sit behind text the class `no-check`.

**Motion** (twice per frame, what the final's motion blur sees):
- *camera jump*: a shot's camera snaps in one step (two moves fighting, or a
  `from` somewhere else than the camera);
- *too fast*: a camera faster than about 2000 px/s outside a transition
  (motion blur turns it into a row of stepped copies);
- *pops twice*: something shows, hides and shows again within 0.6 s (it was
  visible before its own entrance);
- *ghost copy*: the same words twice on screen, on top of each other (two
  copies of one layout crossfading);
- *set twice*: two different `set`s on one property of one element at 0 s
  (on the first frame either can win).

## Motion rules

The motion check catches these, but build them in from the start:

1. **One camera track per shot.** Never drift under a push-in. Let the kit
   chain the moves, or use `P.path`.
2. **Nothing faster than about 2000 px/s** outside a transition. A fast
   change of shot goes under a transition (`whip`, `wipe`, `zoomThrough`).
3. **Never two copies of the same layout.** Don't crossfade a card into a
   near-identical card: move or change ONE element.
4. **Move with transforms.** Animating `fontSize`, `width` or padding re-wraps
   text between motion-blur samples, so the final shows two line breaks.
5. **Hide every element until its own entrance.** A `fromTo` that starts
   later on an element that is already visible makes it appear twice.
6. **One `set` per property at 0 s.** A scene from `Kit.shot` is already
   hidden; show it with a single `Kit.show`.
7. **A caption's plate fades with its words.** Style the plate on
   `.cap-row` (the row that holds the words), never on the `.captions` box.

## Voice and captions

| Call | What it does |
|---|---|
| `Kit.vo(v)` | The voice's word times: `.at("Meet")`, `.at("the", 2)`, `.end("today")`, `.has(word)`. A word the voice doesn't say throws, so a new take can't drift. |
| `Kit.captions(v, parent, { y, maxWords, from, to, fade, hold })` | Captions, a few words at a time, the spoken word highlighted. Each row (words and plate together) fades in after a pause and out before one (`fade` 0.12 s); back-to-back rows swap in place; a row stays `hold` (0.6 s) after its last word |

## Look helpers

`const look = Kit.use(v, "clean")` (or `"bold"`) returns the look's
helpers. The exact names and options are in each look's `LOOK.md`, and the
matching example (`examples/product-video`, `examples/reel`) shows them in use.

- **Clean** (`looks/clean`, product videos): a lit light ground, app windows
  that rise in 3D, a task table that sorts, rolling number tiles with
  sparklines, a chart card, an assistant panel, a toast, match cuts, and an
  end card with a cursor click. One accent colour.
- **Bold** (`looks/bold`, reels): a dark lit ground with light beams or
  stars, huge poster headlines with a light second voice, dark glass
  notifications, a phone with a live screen, a rolling big number, and an
  end card with a tap.

Both looks take a brand colour through `palette` in `config.js`.

**A project's own look.** A project can carry its own look in a `look/`
folder: `look/look.css` and `look/look.js` load after the built-in looks
(a brand pack copies them in). Register it with `Kit.look("name", { init(v)
{ … return helpers } })`, style it under `#stage[data-look="name"]`, and set
`look: "name"` in `config.js`.
