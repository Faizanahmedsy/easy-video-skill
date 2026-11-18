# CLAUDE.md

To make a video for someone: run `bash scripts/setup.sh` once, then follow
[`SKILL.md`](SKILL.md) step by step. The user may be non-technical: plain
words, no raw errors, say how long each wait is.

## Render rules

- A frame is a pure function of time. `engine/render.mjs` seeks one paused
  GSAP timeline (`v.tl`) to each frame and takes a screenshot.
- In scenes, never use `Math.random`, `setTimeout`, `setInterval`,
  `Date.now`, `requestAnimationFrame` or CSS animations/transitions. Use
  `v.tl`, `v.rand()` (seeded) and `v.onFrame(fn)`.
- Sounds go on the picture's clock with `v.sfx(kind, at)`.
- Check stills (`--at`) before every draft. The final only renders the
  exact inputs of the approved draft.
- Sample data on screen unless the user gives real figures.

## File map

| Path | What it is |
|---|---|
| `SKILL.md` | The guided flow: questions, script, voice, stills, draft, final |
| `engine/kit.js` | The motion kit (`Kit.*`), listed in `docs/kit.md` |
| `engine/kit.css` | Stage layers and shared styles |
| `engine/page.html` | The one page every project renders in |
| `engine/render.mjs` | `--at`, `--estimate`, `--draft`, `--final` |
| `looks/clean/` | Product video look (light, one accent, flat cards, charts) |
| `looks/bold/` | Reel look (dark duotone, huge type, colour blocks) |
| `scripts/setup.sh`, `scripts/selftest.sh` | Install once, then a 2-second test render |
| `scripts/new.sh <name> --type product\|reel` | New project in `~/easy-videos/<name>` |
| `scripts/voice.sh <project> <audio>` | Brings in the voice file, writes `vo/words.js` |
| `scripts/sound.mjs` | Makes the music bed and sound effects, mixes and levels them |
| `scripts/draft.sh`, `scripts/final.sh` | The quick preview and the full-quality video |
| `examples/product-video`, `examples/reel` | Two finished projects to copy from |
| `docs/kit.md`, `docs/voice.md` | Kit reference, voice steps |
| `fonts/` | Open-licence fonts, each with its licence file |

A project (`~/easy-videos/<name>`) holds `config.js`, `scenes.js`,
`assets/` (logo, screenshots), and `vo/` (voice and word times).
