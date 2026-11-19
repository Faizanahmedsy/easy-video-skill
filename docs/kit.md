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
| `P.move(at, dur, to, { from, ease })` | Camera move: `{ x, y, zoom, rotate }`, near planes move more |
| `P.aim(x, y, zoom)` | A move target that zooms toward a stage point (that point stays put) |
| `P.drift(at, dur, { x, y, zoom })` | The slow drift and push-in every shot should have |
| `Kit.tilt(v, el, at, dur, to, { from })` | Turn a window, card or phone in 3D: `{ rx, ry, rz }` in degrees |
| `Kit.focus(v, el, at, { from, blur, dur })` | Rack focus: blur a plane in or out like a lens |
| `Kit.scenery(v, A.P.bg, kind, { from, to })` | A full-scene background in a plane, larger than the frame: `"studio"`, `"rays"`, `"stars"` |
| `Kit.show(v, els, at)`, `Kit.hide(v, els, at)` | Show or hide at a time |
| `Kit.finish(v, { grain, vignette, tint, leaks })` | Fine film grain, a soft vignette, optional drifting light washes |
| `Kit.bokeh(v, parent, { count, size, opacity, soft })` | Soft out-of-focus discs for depth (small ones behind, big ones in front) |
| `Kit.leak(v, at)` | A band of light sweeps across the frame (on a reveal) |
| `Kit.sheen(v, el, at)` | A glossy highlight sweeps across one element |

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

## The layout check

`node engine/render.mjs <project> --check` steps through the whole video
(outside transitions) and lists, in plain words: text on top of text, text
cut off by its card or the frame, text under a platform's buttons or caption
(tall videos), and frames with nothing on screen. `scripts/draft.sh` runs it
first and stops if it finds a problem (`--force` skips it). Give decoration
that is meant to sit behind text the class `no-check`.

## Voice and captions

| Call | What it does |
|---|---|
| `Kit.vo(v)` | The voice's word times: `.at("Meet")`, `.at("the", 2)`, `.end("today")`, `.has(word)`. A word the voice doesn't say throws, so a new take can't drift. |
| `Kit.captions(v, parent, { y, maxWords, from, to })` | Captions, a few words at a time, the spoken word highlighted |

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
