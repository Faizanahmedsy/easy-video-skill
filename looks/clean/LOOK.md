# Clean

A light, calm look for product videos. 16:9 first; works in 9:16 and 1:1.

- Ground `#F2F3F5` under a fine drafting grid (set `backdrop: "grid"` in config.js)
- White flat cards, 1 px border `#E1E3E8`, corner radius 14 px
- Ink `#0A0A0C`, muted `#5B606B`, ONE accent: cobalt `#0A5CFF`; gain `#139E4B`, loss `#E5342B`
- Outfit for headlines and figures, DM Sans for interface text
- Labels in sentence case with a small accent square

![Clean](../../docs/images/clean-feature.webp)

## Helpers

`const L = Kit.use(v, "clean")`, then:

| Call | What it makes |
| --- | --- |
| `L.shot(name)` | a scene with three depth planes (`A.S`, `A.P.bg / mid / fg`) |
| `L.label(parent, text, { x, y, at })` | a small label with an accent square |
| `L.title(parent, "Line one\|in *accent.*", { x, y, size, w, align })` | a headline (reveal it with `Kit.reveal`) |
| `L.text(parent, text, { x, y, w, at })` | a line of muted body text |
| `L.logo(parent, { x, y, size, name })` | the product mark (accent square + check) and name |
| `L.app(parent, { x, y, w, h, name, nav, active, search, at })` | an app window: top bar + text-and-icon left nav; returns `body` and its stage `box` |
| `L.heading`, `L.button`, `L.press`, `L.chip` | parts for inside the app |
| `L.note(parent, text, { x, y, tag, rotate })` | a small floating to-do card |
| `L.table(parent, { x, y, w, cols, rows, at, sortAt, sortBy })` | a table that slides in and can re-sort |
| `L.kpis(parent, items, { x, y, w, at })` | KPI tiles with delta chips (`delta: "12%"`, `down: true`) |
| `L.chart(parent, { x, y, w, h, title, values, at, tag, labels })` | a line chart card with a hairline grid and a value tag |
| `L.assistant(parent, { w })` | an assistant side panel with a spark icon: `.ask(at, text)`, `.answer(at, text)`, `.steps(at, list)` |
| `L.toast(parent, text, { x, y, at, out })` | a toast that slides up and leaves |
| `L.endCard(A, { name, tagline, cta, url, at, click })` | logo, name, tagline, CTA and a cursor click |
| `L.cursor(A.P.fg.g)` | a cursor: `.glide`, `.click`, `.leave` |

## Transitions

- `L.push(A, B, at, { dir })`: slide to the next shot (left by default)
- `L.zoomThrough(A, B, at, x, y)`: dive into a point of the old shot
- `L.fly(el, at, from, to)`: an element flies between two places (a match cut)
- `L.panels(at)`: ink and cobalt panels sweep across; swap shots at `.mid`

See `examples/product-video` for all of these in one video.
