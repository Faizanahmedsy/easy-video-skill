# Bold

A dark night look for reels. 9:16 first; works in 16:9.

- A near-black ground `#0A0B10` lit by slow pools of deep colour (`backdrop: "glow dots"`)
- ONE volt accent `#C8FF2E` and off-white `#F4F5F0`
- Anton for huge words, each line fitted to the same width so a headline reads as one poster;
  Archivo light and wide for the quiet second voice, labels and captions
- Dark glass cards, a phone with a real-looking screen, light beams or a star field behind (`scenery`)
- Every shot has depth: three planes, faint discs of light, a slow camera drift

![Bold](../../docs/images/bold-opening.webp)

## Helpers

`const L = Kit.use(v, "bold")`, then:

| Call | What it makes |
| --- | --- |
| `L.shot(name, { scenery })` | a scene with three depth planes and discs of light; scenery `"rays"`, `"stars"` or `"studio"` |
| `L.kicker(parent, text, { x, y, at })` | a small uppercase label with an accent bar |
| `L.big(parent, lines, { x, y, w, at })` | huge stacked lines; a line is a string or `{ text, kind: "accent" \| "lite", max }`; `.out(at)` takes them away |
| `L.count(parent, { y, value, suffix, at })` | a big number that rolls into place, digit by digit |
| `L.notif(parent, { x, y, icon, color, title, sub, time })` | a notification in dark glass |
| `L.phone(parent, { x, y, w, at })` | a phone that rises and untilts; build the app in `.screen` |
| `L.screenText(screen, text, { x, y, size, cls, align })` | text on the phone screen |
| `L.button(parent, text, { x, y, w, h })`, `L.tap(el, at, x, y, g)` | an accent button, and a tap with a ring of light |
| `L.logo(parent, { size, name })`, `L.logoIn(logo, at)` | the mark (a ring holding a dot) and name |
| `L.endCard(A, { name, tagline, cta, at, tap })` | logo, line and button, with a sheen and a tap |
| `L.words(text, at, each)`, `L.captions(parent, { words, y })` | captions on a dark pill, the spoken word in the accent |

## Transitions

- `L.zoomThrough(A, B, at, x, y)`: dive into a word or a card
- `L.wipe(at)`: an accent edge and the dark ground sweep up on a slant; swap shots at `.mid`
- `L.whip(A, B, at)`: a fast pan up, streaked by motion blur
- `L.push(A, B, at)`, `L.cut(A, B, at)` (with a 2-frame accent flash), `L.panels(at)`

See `examples/reel` for all of these in one video.
