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
- Check stills (`--at`) before every draft, then the layout check
  (`--check`); `scripts/draft.sh` runs the check and stops on a problem
  (`--force` skips it). The final only renders the exact inputs of the
  approved draft, with 8-sample motion blur.
- Craft: frame 0 composed, depth in every shot (`L.shot`), a slow camera
  (`A.P.drift`), motivated transitions, one main movement at a time.
- Sample data on screen unless the user gives real figures.

## File map

| Path | What it is |
|---|---|
| `SKILL.md` | The guided flow: questions, script, voice, stills, draft, final |
| `engine/kit.js` | The motion kit (`Kit.*`), listed in `docs/kit.md` |
| `engine/kit.css` | Stage layers and shared styles |
| `engine/page.html` | The one page every project renders in |
| `engine/render.mjs` | `--at`, `--check`, `--estimate`, `--draft`, `--final` (`--workers N`) |
| `looks/clean/` | Product video look (lit light ground, 3D app windows, soft shadows, one accent) |
| `looks/bold/` | Reel look (dark lit ground, huge poster type, glass, a phone, one accent) |
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
