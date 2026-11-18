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

`config.js` sets `window.VIDEO`: `format`, `look`, `duration`, `fps`,
`seed`, `backdrop` (`"grid"`, `"spot"`, `"none"`), `palette` (CSS colour
variables) and `audio`.

## Scenes and camera

| Call | What it does |
|---|---|
| `Kit.shot(v, name, depths?)` | A scene with three depth planes → `{ S, P }` |
| `Kit.planes(v, scene, depths?)` | Depth planes for an existing scene |
| `P.bg`, `P.mid`, `P.fg` | Each plane: `.el` (for HTML) and `.g` (for SVG) |
| `P.move(at, dur, to, { from, ease })` | Camera move: `{ x, y, zoom, rotate }`, near planes move more |
| `P.aim(x, y, zoom)` | A move target that zooms toward a stage point |
| `Kit.show(v, els, at)`, `Kit.hide(v, els, at)` | Show or hide at a time |
| `Kit.finish(v, { grain, vignette })` | Fine film grain and a soft vignette |

## Text

| Call | What it does |
|---|---|
| `Kit.title(parent, str, { x, y, w, size, align, cls, color })` | A masked title. `*word*` highlights, `\|` breaks a line. → `{ el, lines, words, chars, em }` |
| `Kit.reveal(v, t, at, { by, each, dur })` | Lines, words or chars rise out of their masks |
| `Kit.unreveal(v, t, at, { to, each, dur })` | They slide away again |
| `Kit.sayWords(v, t, times)` | Each word rises at its own time (spoken words) |
| `Kit.mark(v, span, at, { kind, color, dur })` | A mark on a highlight: `bar` under it, `box` behind it |
| `Kit.typeOn(v, el, str, at, cps)` | Types text in |
| `Kit.count(v, el, from, to, at, dur, fmt)` | Counts a number up |
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
| `Kit.bars(v, parent, { x, y, w, h, values, at, max, gap })` | Bars that grow from the baseline |
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

Eases: `out`, `inout`, `pop`, `dash`.

## Voice and captions

| Call | What it does |
|---|---|
| `Kit.vo(v)` | The voice's word times: `.at("Meet")`, `.at("the", 2)`, `.end("today")`, `.has(word)`. A word the voice doesn't say throws, so a new take can't drift. |
| `Kit.captions(v, parent, { y, maxWords, from, to })` | Captions, a few words at a time, the spoken word highlighted |

## Look helpers

`const look = Kit.use(v, "clean")` (or `"bold"`) returns the look's
helpers. The exact names and options are in each look's `LOOK.md`, and its
`starter/` shows them in use.

- **Clean** (`looks/clean`, product videos): an app window with a top bar
  and side menu, number tiles with change chips, a line chart with a value
  tag, an assistant side panel, a toast, and an end card (logo, name,
  tagline, button, pointer click). Light grid backdrop, one accent colour.
- **Bold** (`looks/bold`, reels): huge fitted headlines, text on solid
  colour blocks that slide in and stack, a full-colour ground per shot,
  drifting block shapes behind, a big count-up, and captions on a black
  block with the spoken word in the accent.

Both looks take a brand colour through `palette` in `config.js`.
