#!/usr/bin/env node
/*
 * render.mjs: turns a video project folder into an MP4, or into a few stills.
 *
 *   node engine/render.mjs <project> --draft       fast check: half size, no motion blur, a DRAFT mark → out/draft.mp4
 *   node engine/render.mjs <project> --final       full size with motion blur → out/video.mp4
 *                                                  (only after a draft of exactly these files; --force skips that check)
 *   node engine/render.mjs <project> --at 1.5,4    PNG stills at those seconds → out/stills/
 *   node engine/render.mjs <project> --stills 6    6 stills spread over the video → out/stills/
 *   node engine/render.mjs <project> --check       the layout and motion checks → out/check.txt:
 *                                                  layout: overlaps, cut-off text, text off the frame or in a
 *                                                  platform's UI areas, empty frames (notes: hard to read, small,
 *                                                  nothing moving); motion: camera jumps, too-fast moves, things
 *                                                  that pop in twice, ghost copies. Every finding has a fix hint.
 *                                                  Exits 1 on a problem; draft.sh runs it first.
 *                                                  --only layout | --only motion runs one of the two
 *   node engine/render.mjs <project> --estimate    how long a draft and a final will take
 *   node engine/render.mjs <project> --cues        the sound-effect cues → out/cues.json (scripts/sound.mjs uses it)
 *   add --guides to stills to draw the safe box and the platform's UI areas
 *   --workers 3: how many pages render frames side by side (default: 3, fewer on a small computer)
 *
 * A project folder holds config.js, scenes.js and, optionally, vo/ and assets/.
 * A small local server serves the project's own files first, then the skill's
 * (engine/page.html, kit.js, kit.css, looks/, fonts/, node_modules/).
 */
import http from "node:http"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import vm from "node:vm"
import crypto from "node:crypto"
import zlib from "node:zlib"
import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const ENGINE = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.dirname(ENGINE)
const SHUTTER = 0.5 // motion blur: the share of a frame's time the "shutter" is open
const SUBFRAMES = 8 // motion blur: pictures averaged into one final frame
const say = (s) => console.log(s)
let cleanup = () => {}
function fail(msg) {
  console.error(`\n${msg}\n`)
  cleanup()
  process.exit(1)
}
const human = (ms) => {
  const s = ms / 1000
  if (s < 50) return `${Math.max(5, Math.round(s / 5) * 5)} seconds`
  const m = Math.round(s / 60)
  return `${m} minute${m === 1 ? "" : "s"}`
}

// ───────────────────────────────────────────────────────── arguments ──

const USAGE = "Use: node engine/render.mjs <project folder> --draft | --final [--force] | --at 1.5,4 | --stills 6 | --check | --estimate | --cues"
const argv = process.argv.slice(2)
const has = (n) => argv.includes(`--${n}`)
const val = (n) => argv[argv.indexOf(`--${n}`) + 1]
const target = argv.find((a, i) => !a.startsWith("--") && !["--at", "--stills", "--workers", "--step", "--only"].includes(argv[i - 1]))
const mode = ["draft", "final", "at", "stills", "check", "estimate", "cues"].find(has)
if (!target || !mode) fail(USAGE)
const PROJECT = [path.resolve(target), path.join(os.homedir(), "easy-videos", target)].find((p) => fs.existsSync(path.join(p, "config.js")))
if (!PROJECT) fail(`"${target}" is not a video project: there is no config.js in it.`)
if (!fs.existsSync(path.join(PROJECT, "scenes.js"))) fail(`The project has no scenes.js yet (${PROJECT}).`)
const OUT = path.join(PROJECT, "out")
fs.mkdirSync(OUT, { recursive: true })

// config.js is read here too, so the browser opens at the right size
const cfg = (() => {
  const box = { window: {} }
  try {
    vm.runInNewContext(fs.readFileSync(path.join(PROJECT, "config.js"), "utf8"), box, { timeout: 2000 })
  } catch (e) {
    fail(`config.js has a mistake in it: ${e.message}`)
  }
  const c = box.window.VIDEO
  if (!c || !(c.duration > 0)) fail("config.js must set window.VIDEO = { …, duration: <seconds> }.")
  return c
})()
const SIZES = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] }
const [W, H] = cfg.width && cfg.height ? [cfg.width, cfg.height] : SIZES[cfg.format] || SIZES["16:9"]

// ──────────────────────────────────────────── fingerprint (draft → final) ──

const FP_FILE = path.join(OUT, "draft.fingerprint")
/** sha256 over every project file (names and contents), except out/ and dotfiles. */
function fingerprint() {
  const hash = crypto.createHash("sha256")
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith(".") || (dir === PROJECT && ["out", "node_modules"].includes(e.name))) continue
      const f = path.join(dir, e.name)
      if (e.isDirectory()) walk(f)
      else if (e.isFile()) hash.update(`${path.relative(PROJECT, f).split(path.sep).join("/")}\0`).update(fs.readFileSync(f)).update("\0")
    }
  }
  walk(PROJECT)
  return hash.digest("hex")
}
if (mode === "final" && !has("force")) {
  const saved = fs.existsSync(FP_FILE) ? fs.readFileSync(FP_FILE, "utf8").trim() : ""
  if (!saved) fail("There is no draft yet. Make a draft first (scripts/draft.sh), check it, then make the final.")
  if (saved !== fingerprint()) fail("The project changed after the last draft. Make a new draft first, so the final is exactly what was approved (or add --force to skip this check).")
}

// ─────────────────────────────────────────────────────────── ffmpeg ──

function ffmpegBin() {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) return "ffmpeg"
  try {
    const p = createRequire(import.meta.url)("ffmpeg-static")
    if (p && fs.existsSync(p)) return p
  } catch {}
  return null
}

/** An ffmpeg process that takes JPEG frames on stdin and writes an MP4. */
function encoder(file, o) {
  const fps = cfg.fps || 30
  const sub = o.sub || 1
  const vf = [
    // motion blur: average each group of `sub` pictures, keep one frame per group
    sub > 1 && `tmix=frames=${sub},select=eq(mod(n\\,${sub})\\,${sub - 1}),setpts=N/(${fps}*TB)`,
    "scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv",
    "format=yuv420p",
    "setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv",
  ].filter(Boolean)
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps * sub), "-c:v", "mjpeg", "-i", "-"]
  if (o.audio) args.push("-i", o.audio)
  args.push("-vf", vf.join(","), "-r", String(fps), "-c:v", "libx264", "-preset", o.preset, "-crf", String(o.crf), "-pix_fmt", "yuv420p")
  args.push("-movflags", "+faststart")
  if (o.audio) args.push("-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k")
  args.push("-t", String(cfg.duration), file)
  const ff = spawn(o.bin, args, { stdio: ["pipe", "ignore", "pipe"] })
  let err = ""
  ff.stderr.on("data", (d) => (err += d))
  ff.stdin.on("error", () => {})
  const done = new Promise((r) => ff.on("close", r))
  const why = () => err.trim().split("\n").pop() || "it stopped"
  return {
    async write(buf) {
      if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once("drain", r)), done])
      if (ff.exitCode !== null) fail(`ffmpeg could not write the video: ${why()}`)
    },
    async end() {
      ff.stdin.end()
      if ((await done) !== 0) fail(`ffmpeg could not write the video: ${why()}`)
    },
  }
}

// ─────────────────────────────────────────────────────────── server ──

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ttf": "font/ttf",
  ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
}
const isFile = (f) => fs.statSync(f, { throwIfNoEntry: false })?.isFile()
function lookup(rel) {
  const inside = (root, p) => {
    const f = path.resolve(root, p)
    return f.startsWith(root + path.sep) && isFile(f) ? f : null
  }
  const fromSkill = /^(page\.html|kit\.js|kit\.css)$/.test(rel) || rel.startsWith("node_modules/") ? `engine/${rel}` : /^(looks|fonts)\//.test(rel) ? rel : null
  return inside(PROJECT, rel) || (fromSkill && inside(SKILL, fromSkill))
}
const missing = new Set()
const server = http.createServer((req, res) => {
  let rel = ""
  try {
    rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "page.html"
  } catch {}
  const file = rel && lookup(rel)
  if (file) {
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" })
    fs.createReadStream(file).pipe(res)
  } else if (rel === "vo/words.js") {
    res.writeHead(200, { "content-type": TYPES[".js"] })
    res.end("window.VO_WORDS = window.VO_WORDS || []\n")
  } else {
    if (rel !== "favicon.ico") missing.add(rel)
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const BASE = `http://127.0.0.1:${server.address().port}/`

// ────────────────────────────────────────────────────────── browser ──

let chromium
try {
  ;({ chromium } = await import("playwright"))
} catch {
  fail("The video engine is not set up yet. Run: bash scripts/setup.sh")
}
const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--hide-scrollbars", "--mute-audio"] }).catch(() => fail("Chromium could not start. Run: bash scripts/setup.sh"))
cleanup = () => {
  browser.close().catch(() => {})
  server.close()
}

/** Open the video page at `scale` (0.5 = half size) and wait until it is built. */
async function open(scale) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()) && !/Failed to load resource/.test(m.text())) say(`  page: ${m.text()}`)
  })
  await page.goto(BASE + (has("guides") ? "?guides=1" : ""))
  await page.addStyleTag({ content: "html,body{margin:0!important;padding:0!important;overflow:hidden!important}#stage{position:absolute!important;left:0!important;top:0!important}" })
  const ready = page.waitForFunction(() => window.__video && window.__video.ready, null, { timeout: 60000, polling: 50 }).then(() => true, () => false)
  const broke = new Promise((r) => page.on("pageerror", () => setTimeout(r, 1500))).then(() => page.evaluate(() => !!(window.__video && window.__video.ready)))
  if (!(await Promise.race([ready, broke]))) {
    fail(`The video did not start. ${errors.length ? `The first problem: ${errors[0]}` : "Check that scenes.js calls Kit.start(window.VIDEO, (v) => { … })."}`)
  }
  for (const m of missing) if (!/^(looks\/[^/]+|look)\/look\.(css|js)$/.test(m)) say(`  note: the page asked for ${m}, which is not there`)
  missing.clear()
  const info = await page.evaluate((fps) => {
    const v = window.__video
    if (v.setFps) v.setFps(fps)
    return { duration: v.duration, fps: v.fps || fps, width: v.width, height: v.height, audio: v.audio || null, cues: v.cues || [], busy: v.busy || [], warnings: v.warnings || [] }
  }, cfg.fps || 30)
  if (info.width !== W || info.height !== H) await page.setViewportSize({ width: info.width, height: info.height })
  const cdp = await ctx.newCDPSession(page)
  const clip = { x: 0, y: 0, width: info.width, height: info.height, scale }
  /** Seek to t seconds and take the picture (JPEG, or PNG for stills). */
  const grab = async (t, png = false) => {
    await page.evaluate((t) => window.__video.seek(t), t)
    const { data } = await cdp.send("Page.captureScreenshot", png ? { format: "png", clip } : { format: "jpeg", quality: scale < 1 ? 88 : 95, optimizeForSpeed: true, clip })
    return Buffer.from(data, "base64")
  }
  return { page, grab, info, close: () => ctx.close() }
}

// ──────────────────────────────────────────────────────────── modes ──

async function video(kind) {
  const draft = kind === "draft"
  const S = draft ? { scale: 0.5, sub: 1, crf: 23, preset: "veryfast", name: "draft.mp4" } : { scale: 1, sub: SUBFRAMES, crf: 17, preset: "medium", name: "video.mp4" }
  const bin = ffmpegBin()
  if (!bin) fail("ffmpeg is missing. Run: bash scripts/setup.sh")
  const print = draft ? fingerprint() : null // taken before rendering: a later edit means a new draft
  // several pages render whole frames side by side; ffmpeg still receives them strictly in order
  const workers = Math.max(1, Math.min(8, parseInt(val("workers"), 10) || Math.min(3, Math.max(1, os.cpus().length - 1))))
  const pages = []
  for (let w = 0; w < workers; w++) pages.push(await open(S.scale))
  const { info } = pages[0]
  if (draft) for (const { page } of pages) {
    await page.evaluate(() => {
      const stage = document.getElementById("stage")
      const k = parseFloat(stage.style.getPropertyValue("--k")) || 1
      const d = document.createElement("div")
      d.textContent = "DRAFT"
      Object.assign(d.style, { position: "absolute", right: `${28 * k}px`, top: `${24 * k}px`, zIndex: "2147483647", font: `700 ${30 * k}px/1 system-ui, sans-serif`, letterSpacing: "0.14em", color: "rgba(250,250,250,0.95)", background: "rgba(0,0,0,0.55)", padding: `${8 * k}px ${14 * k}px`, borderRadius: `${6 * k}px` })
      stage.appendChild(d)
    })
  }
  let audio = null
  if (info.audio) {
    audio = path.resolve(PROJECT, info.audio)
    if (!isFile(audio)) {
      say(`  note: config.js names the sound ${info.audio}, but that file is not there, so this video has no sound.`)
      audio = null
    }
  }
  const final = path.join(OUT, S.name)
  const part = path.join(OUT, S.name.replace(/\.mp4$/, ".part.mp4"))
  const enc = encoder(part, { ...S, audio, bin })
  const N = Math.round(info.duration * info.fps)
  say(`Rendering the ${draft ? "draft" : "final video"}: ${N} frames (${info.duration} s at ${info.fps} fps)${audio ? ", with sound" : ""}.`)
  const t0 = Date.now()
  let last = t0
  const ready = new Map()
  let next = 0
  let written = 0
  let wake = null
  const work = async ({ grab }) => {
    for (;;) {
      // stay at most a few frames ahead of the writer, so memory stays small
      while (next - written > workers * 2) await new Promise((r) => setTimeout(r, 4))
      const f = next++
      if (f >= N) return
      const bufs = []
      for (let i = 0; i < S.sub; i++) bufs.push(await grab((f + (SHUTTER * i) / S.sub) / info.fps))
      ready.set(f, bufs)
      if (wake) wake()
    }
  }
  const running = Promise.all(pages.map(work))
  running.catch((e) => fail(`The render stopped: ${e && e.message ? e.message.split("\n")[0] : e}`))
  while (written < N) {
    if (!ready.has(written)) {
      await new Promise((r) => {
        wake = r
        setTimeout(r, 50)
      })
      wake = null
      continue
    }
    for (const buf of ready.get(written)) await enc.write(buf)
    ready.delete(written)
    const f = written++
    const now = Date.now()
    if (f >= 4 && now - last > 4000 && f < N - 1) {
      last = now
      say(`Rendering frame ${f + 1} of ${N}, about ${human(((now - t0) / (f + 1)) * (N - f - 1))} left`)
    }
  }
  await running
  await enc.end()
  fs.renameSync(part, final)
  if (draft) fs.writeFileSync(FP_FILE, `${print}\n`)
  say(`${draft ? "Draft" : "Final video"} ready: ${final} (made in ${human(Date.now() - t0)})`)
}

async function stills() {
  const { grab, info } = await open(1)
  let times
  if (mode === "at") {
    times = String(val("at") || "").split(",").map(Number)
    if (!times.length || times.some((t) => !Number.isFinite(t))) fail("--at needs seconds, like: --at 1.5,4")
  } else {
    const n = Math.max(1, Math.min(60, parseInt(val("stills"), 10) || 6))
    times = Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * info.duration * 100) / 100)
  }
  const dir = path.join(OUT, "stills")
  fs.mkdirSync(dir, { recursive: true })
  for (const t of times) {
    const at = Math.max(0, Math.min(info.duration, t))
    const file = path.join(dir, `still-${at.toFixed(2)}s.png`)
    fs.writeFileSync(file, await grab(at, true))
    say(file)
  }
}

async function cues() {
  const { info } = await open(0.5)
  const file = path.join(OUT, "cues.json")
  fs.writeFileSync(file, JSON.stringify({ duration: info.duration, fps: info.fps, audio: info.audio, music: cfg.music ?? "calm", cues: info.cues }, null, 1))
  say(`${info.cues.length} sound cues → ${file}`)
}

// ─────────────────────────────────────────────────────── the checks ──

/** Decode a PNG from Chromium (8-bit RGB/RGBA, not interlaced) into RGB pixels, in memory. */
function decodePNG(buf) {
  let pos = 8
  let w = 0
  let h = 0
  let ct = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString("ascii", pos + 4, pos + 8)
    if (type === "IHDR") {
      w = buf.readUInt32BE(pos + 8)
      h = buf.readUInt32BE(pos + 12)
      ct = buf[pos + 17]
      if (buf[pos + 16] !== 8 || buf[pos + 20] !== 0 || (ct !== 2 && ct !== 6)) return null
    } else if (type === "IDAT") idat.push(buf.subarray(pos + 8, pos + 8 + len))
    else if (type === "IEND") break
    pos += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = ct === 6 ? 4 : 3
  const stride = w * bpp
  const px = new Uint8Array(w * h * 3)
  let prev = new Uint8Array(stride)
  let cur = new Uint8Array(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const off = y * (stride + 1) + 1
    for (let i = 0; i < stride; i++) {
      const x = raw[off + i]
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v
      if (f === 0) v = x
      else if (f === 1) v = x + a
      else if (f === 2) v = x + b
      else if (f === 3) v = x + ((a + b) >> 1)
      else {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      cur[i] = v & 255
    }
    for (let xx = 0; xx < w; xx++) for (let k = 0; k < 3; k++) px[(y * w + xx) * 3 + k] = cur[xx * bpp + k]
    ;[prev, cur] = [cur, prev]
  }
  return { w, h, px }
}
const luminance = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** The contrast of a text box against what is behind it, from a screenshot: drop the pixels near
 *  the text colour (the letters), take the most common colour left as the background. */
function contrastOf(img, box, color, alpha) {
  const tc = color.slice(0, 3)
  const x0 = Math.max(0, Math.floor(box.x0))
  const y0 = Math.max(0, Math.floor(box.y0))
  const x1 = Math.min(img.w, Math.ceil(box.x1))
  const y1 = Math.min(img.h, Math.ceil(box.y1))
  const n = (x1 - x0) * (y1 - y0)
  if (n < 16) return null
  const step = Math.max(1, Math.floor(Math.sqrt(n / 1600)))
  const buckets = new Map()
  let total = 0
  let kept = 0
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const o = (y * img.w + x) * 3
      const c = [img.px[o], img.px[o + 1], img.px[o + 2]]
      total++
      if (Math.hypot(c[0] - tc[0], c[1] - tc[1], c[2] - tc[2]) < 60) continue
      kept++
      const key = (c[0] >> 4) * 256 + (c[1] >> 4) * 16 + (c[2] >> 4)
      const bk = buckets.get(key) || [0, 0, 0, 0]
      bk[0]++
      bk[1] += c[0]
      bk[2] += c[1]
      bk[3] += c[2]
      buckets.set(key, bk)
    }
  }
  let bg = tc
  if (kept >= total * 0.2) {
    const best = [...buckets.values()].reduce((a, b) => (b[0] > a[0] ? b : a))
    bg = [best[1] / best[0], best[2] / best[0], best[3] / best[0]]
  }
  const a = Math.min(1, alpha)
  const seen = tc.map((c, j) => c * a + bg[j] * (1 - a))
  return { ratio: contrast(seen, bg), bg, light: luminance(bg) > 0.4 }
}

/**
 * The layout check. At every tenth of a second (outside transitions and the
 * spans a scene marked with v.quiet), it measures every piece of text on screen
 * and reports, in plain words, each with a "fix:" hint (how far to move it,
 * how many words to keep):
 *   overlap   two pieces of text on top of each other
 *   cut off   text clipped by its card, its box or the edge of the frame
 *   UI area   tall videos: text under the platform's buttons or caption
 *   empty     nothing on screen but the background for more than half a second
 * and, as notes that do not stop the draft:
 *   outside the safe box (big text), hard to read (contrast under 3:1, from a
 *   screenshot every half second), small text, and nothing moving for 3 s.
 */
async function layout(page, info) {
  const step = Number(val("step")) > 0 ? Number(val("step")) : 0.1
  const busy = info.busy
  const quiet = (t) => busy.some(([a, b]) => t >= a - 0.02 && t <= b + 0.02)
  const found = new Map()
  const note = (kind, what, t, hint) => {
    const key = `${kind}\u0000${what}`
    const r = found.get(key) || { kind, what, from: t, to: t, n: 0, hint }
    r.to = t
    r.n++
    found.set(key, r)
  }
  // under this, words are hard to read on a phone (1080-class px; small interface detail on a
  // mock screen may stay small, so these are summed up in one note)
  const minPx = (info.width > info.height ? 20 : 28) * (Math.min(info.width, info.height) / 1080)
  let emptySince = null
  let stillFrom = null
  let lastHash = null
  let lastT = null
  const stills = []
  let sample = 0
  for (let t = 0; t <= info.duration - 1 / info.fps + 1e-6; t = Math.round((t + step) * 1000) / 1000, sample++) {
    await page.evaluate((t) => window.__video.seek(t), t)
    if (quiet(t)) {
      emptySince = null
      // a transition is motion: the "nothing moves" clock starts again after it
      if (stillFrom !== null && lastT - stillFrom > 3) stills.push([stillFrom, lastT])
      stillFrom = null
      lastHash = null
      continue
    }
    const r = await page.evaluate((minPx) => {
      const stage = document.getElementById("stage")
      const S = stage.getBoundingClientRect()
      const sc = S.width / stage.offsetWidth || 1
      const vid = window.__video
      const alpha = (el) => {
        let a = 1
        for (let e = el; e && e !== stage; e = e.parentElement) {
          const cs = getComputedStyle(e)
          if (cs.display === "none" || cs.visibility === "hidden") return 0
          a *= Number(cs.opacity)
          if (e.classList.contains("no-check")) return 0
        }
        return a
      }
      const rel = (b) => ({ x0: (b.left - S.left) / sc, y0: (b.top - S.top) / sc, x1: (b.right - S.left) / sc, y1: (b.bottom - S.top) / sc })
      const label = (el) => (el.dataset.text || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)
      const rgba = (s) => {
        const m = String(s).match(/rgba?\(([^)]+)\)/)
        if (!m) return [0, 0, 0, 1]
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
      }
      // text owners: a title line, else the element that holds the text
      const owners = new Map()
      const walker = document.createTreeWalker(document.getElementById("cam"), NodeFilter.SHOW_TEXT)
      const over = document.createTreeWalker(document.getElementById("over"), NodeFilter.SHOW_TEXT)
      for (const w of [walker, over]) {
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.textContent.trim()) continue
          const p = n.parentElement
          if (!p || p.closest(".roll-strip,.ghost")) continue
          const own = p.closest(".ln,.roll") || p
          const range = document.createRange()
          range.selectNodeContents(n)
          const cs = getComputedStyle(p)
          // a glyph box includes the font's whole ascent and descent; the em box around its
          // centre is much closer to the ink people see
          const em = (parseFloat(cs.fontSize) || 16) * sc
          const rects = [...range.getClientRects()]
            .filter((b) => b.width > 0.5 && b.height > 0.5)
            .map((b) => {
              const hh = Math.min(b.height, em)
              const c = (b.top + b.bottom) / 2
              return { left: b.left, right: b.right, top: c - hh / 2, bottom: c + hh / 2 }
            })
          if (!rects.length) continue
          const svg = p instanceof SVGElement
          const paint = svg ? cs.fill : cs.color
          if (/rgba\(.*,\s*0\)$/.test(paint) || paint === "transparent" || paint === "none") continue
          // the size people see: the font size times how much the element is scaled on screen
          let k = 1
          if (!svg && p.offsetHeight > 0) k = p.getBoundingClientRect().height / sc / p.offsetHeight
          const o = owners.get(own) || { el: own, rects: [], size: 0, px: Infinity, chars: 0 }
          o.rects.push(...rects)
          o.size = Math.max(o.size, parseFloat(cs.fontSize) || 0)
          const len = n.textContent.trim().length
          if (len >= 3 || o.px === Infinity) o.px = Math.min(o.px, (parseFloat(cs.fontSize) || 16) * k)
          if (len > o.chars) {
            o.chars = len
            o.color = rgba(paint)
            o.decor = cs.textShadow !== "none" || parseFloat(cs.webkitTextStrokeWidth || 0) > 0 || cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text"
          }
          owners.set(own, o)
        }
      }
      const boxes = []
      for (const o of owners.values()) {
        const a = alpha(o.el)
        if (a < 0.6) continue
        const u = { left: Math.min(...o.rects.map((b) => b.left)), top: Math.min(...o.rects.map((b) => b.top)), right: Math.max(...o.rects.map((b) => b.right)), bottom: Math.max(...o.rects.map((b) => b.bottom)) }
        // a title line still rising out of its mask is not a settled layout
        const mask = o.el.classList.contains("ln") ? o.el.parentElement : null
        if (mask) {
          const m = mask.getBoundingClientRect()
          const tol = (u.bottom - u.top) * 0.3 // glyph boxes are a little taller than the mask
          if (u.top < m.top - tol || u.bottom > m.bottom + tol) continue
        }
        const b = rel(u)
        // clipped: by an ancestor that hides overflow (a card, a box), or by an ellipsis
        let cut = null
        let cutBy = 0
        for (let e = o.el; e && e !== stage; e = e.parentElement) {
          const cs = getComputedStyle(e)
          if (e !== o.el && (cs.overflow !== "visible" || cs.clipPath !== "none") && !e.classList.contains("ln-mask") && !/^(ln|wd|ch)$/.test(e.className)) {
            const c = rel(e.getBoundingClientRect())
            cutBy = Math.max(c.x0 - b.x0, b.x1 - c.x1, c.y0 - b.y0, b.y1 - c.y1)
            if (b.x0 < c.x0 - 2 || b.x1 > c.x1 + 2 || b.y0 < c.y0 - 3 || b.y1 > c.y1 + 3) cut = "its box"
            break
          }
        }
        if (ellipsis(o.el) && o.el.scrollWidth > o.el.clientWidth + 1) {
          cut = "its width (it ends in …)"
          cutBy = o.el.scrollWidth - o.el.clientWidth
        }
        // the nearest ancestor turned in 2D or 3D: inside it, bounding boxes swell, so two
        // lines in the same turned card are not compared with each other
        let tilt = null
        for (let e = o.el; e && e !== stage; e = e.parentElement) {
          const tf = getComputedStyle(e).transform
          if (tf && tf !== "none" && (/^matrix3d/.test(tf) || (/^matrix\(/.test(tf) && tf.split(",").slice(1, 3).some((n) => Math.abs(parseFloat(n)) > 0.002)))) tilt = e
        }
        boxes.push(Object.assign(b, { what: label(o.el), size: o.size / sc, px: o.px, cut, cutBy, el: o.el, tilt, color: o.color, alpha: a * (o.color ? o.color[3] : 1), decor: o.decor }))
      }
      function ellipsis(el) {
        const cs = getComputedStyle(el)
        return cs.textOverflow === "ellipsis" && cs.overflow !== "visible"
      }
      const words = (a) => Math.max(1, a.what.split(" ").length)
      const keep = (a, have, need) => Math.max(1, Math.floor((words(a) * have) / Math.max(1, need)))
      const out = []
      const W = stage.offsetWidth
      const H = stage.offsetHeight
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i]
        const bw = a.x1 - a.x0
        if (a.cut) out.push(["cut off", `"${a.what}" is cut off by ${a.cut}`, `make its box at least ${Math.ceil(a.cutBy + 8)} px bigger, or shorten it to about ${keep(a, bw - a.cutBy, bw)} words`])
        const edge = [["right", -a.x0], ["left", a.x1 - W], ["down", -a.y0], ["up", a.y1 - H]].reduce((m, x) => (x[1] > m[1] ? x : m))
        if (edge[1] > 2) out.push(["cut off", `"${a.what}" runs off the edge of the frame`, `move it ${edge[0]} at least ${Math.ceil(edge[1] + 16)} px, or shorten it to about ${keep(a, bw - edge[1], bw)} words`])
        for (const z of vid.ui || []) {
          if (a.x0 < z.x + z.w && a.x1 > z.x && a.y0 < z.y + z.h && a.y1 > z.y) {
            const moves = [["up", a.y1 - z.y], ["down", z.y + z.h - a.y0], ["left", a.x1 - z.x], ["right", z.x + z.w - a.x0]].filter(([d, n]) => n > 0 && !(d === "down" && z.y + z.h >= H) && !(d === "up" && z.y <= 0) && !(d === "right" && z.x + z.w >= W) && !(d === "left" && z.x <= 0))
            const [dir, n] = moves.length ? moves.reduce((m, x) => (x[1] < m[1] ? x : m)) : ["away", 0]
            out.push(["UI area", `"${a.what}" is under the ${z.name}`, `move it ${dir} at least ${Math.ceil(n + 8)} px`])
          }
        }
        const s = vid.safe
        if (a.size >= 40) {
          const off = [["right", s.x - a.x0], ["down", s.y - a.y0], ["left", a.x1 - s.r], ["up", a.y1 - s.b]].filter(([, n]) => n > 30)
          if (off.length) out.push(["note", `"${a.what}" is outside the safe box`, bw > s.w ? `shorten it to about ${keep(a, s.w, bw)} words or make it smaller` : off.map(([d, n]) => `move it ${d} at least ${Math.ceil(n)} px`).join(" and ")])
        }
        if (a.px < minPx - 0.5) out.push(["small", `"${a.what}"`, String(Math.round(a.px))])
        for (let j = i + 1; j < boxes.length; j++) {
          const b = boxes[j]
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue
          if (a.tilt && a.tilt === b.tilt) continue
          const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
          const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
          if (ox > 3 && oy > 3) {
            const [hi, lo] = a.y0 <= b.y0 ? [a, b] : [b, a]
            const dy = Math.ceil(hi.y1 - lo.y0 + 16)
            out.push(["overlap", `"${a.what}" and "${b.what}" overlap`, `move "${lo.what}" down at least ${dy} px (or "${hi.what}" up), or let one leave before the other comes in`])
          }
        }
      }
      // empty: nothing in the scenes bigger than 2 % of the frame is visible
      let filled = boxes.length > 0
      if (!filled) {
        for (const el of document.querySelectorAll("#scenes *, #over > *")) {
          const b = el.getBoundingClientRect()
          if ((b.width * b.height) / (S.width * S.height) < 0.02) continue
          if (el.classList.contains("plane") || el.classList.contains("scene") || el.classList.contains("stage-svg") || el.classList.contains("grain") || el.classList.contains("bokeh")) continue
          if (alpha(el) > 0.3) {
            filled = true
            break
          }
        }
      }
      // "nothing moves": a hash of what is on screen (inline styles, SVG shapes, text), leaving
      // out the backdrop, grain, light leaks and the always-floating discs
      let hash = 2166136261
      const mix = (s) => {
        for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619)
      }
      const skip = (el) => el.classList && (el.classList.contains("grain") || el.classList.contains("bokeh") || el.classList.contains("leak") || el.classList.contains("sweep"))
      const walk = (el) => {
        if (skip(el)) return
        const cs = getComputedStyle(el)
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.02) return
        if (el instanceof SVGElement) for (const n of el.getAttributeNames()) mix(el.getAttribute(n))
        else mix(el.getAttribute("style") || "")
        for (const c of el.childNodes) {
          if (c.nodeType === 3) mix(c.nodeValue)
          else if (c.nodeType === 1) walk(c)
        }
      }
      walk(document.getElementById("cam"))
      walk(document.getElementById("over"))
      const text = boxes.filter((b) => !b.decor && b.color && b.alpha > 0.05 && !b.tilt).map((b) => ({ what: b.what, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, color: b.color, alpha: b.alpha }))
      return { out, filled, hash: hash >>> 0, text }
    }, minPx)
    for (const [kind, what, hint] of r.out) note(kind, what, t, hint)
    if (!r.filled) {
      emptySince ??= t
      if (t - emptySince >= 0.5) note("empty", "nothing on screen but the background", emptySince, "show the next shot sooner, or keep the last one on screen until then")
    } else emptySince = null
    // hard to read: one screenshot every half second
    if (r.text.length && sample % Math.max(1, Math.round(0.5 / step)) === 0) {
      const img = decodePNG(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: info.width, height: info.height } }))
      if (img) {
        const k = img.w / info.width
        for (const b of r.text) {
          const c = contrastOf(img, { x0: b.x0 * k, y0: b.y0 * k, x1: b.x1 * k, y1: b.y1 * k }, b.color, b.alpha)
          if (c && c.ratio < 3) note("hard to read", `"${b.what}" stands out too little from what is behind it (${c.ratio.toFixed(1)}:1)`, t, `${c.light ? "darker" : "lighter"} text, or a solid plate behind it`)
        }
      }
    }
    if (r.hash !== lastHash) {
      if (stillFrom !== null && lastT - stillFrom > 3) stills.push([stillFrom, lastT])
      stillFrom = t
    }
    lastHash = r.hash
    lastT = t
  }
  if (stillFrom !== null && lastT - stillFrom > 3) stills.push([stillFrom, lastT])
  for (const [a, b] of stills) found.set(`still${a}`, { kind: "still", what: `nothing moves for ${(b - a).toFixed(1)} s`, from: a, to: b, n: 2, hint: "add a beat in that time: a slow camera push, a highlight, a number counting" })
  const rows = [...found.values()].sort((a, b) => a.from - b.from)
  const NOTES = ["note", "small", "hard to read", "still"]
  // one-frame blips (a word passing another mid-move) are not layout problems
  const bad = rows.filter((r) => !NOTES.includes(r.kind) && (r.n >= 2 || r.kind === "empty"))
  const notes = rows.filter((r) => NOTES.includes(r.kind) && r.kind !== "small" && r.n >= 2)
  // small text: one line for all of it, smallest first
  const small = rows.filter((r) => r.kind === "small" && r.n >= 2).sort((a, b) => Number(a.hint) - Number(b.hint))
  if (small.length) {
    notes.push({
      kind: "small",
      from: Math.min(...small.map((r) => r.from)),
      to: Math.max(...small.map((r) => r.to)),
      what: `${small.length} piece${small.length === 1 ? " of text is" : "s of text are"} under ${Math.ceil(minPx)} px (smallest: ${small.slice(0, 4).map((r) => `${r.what} ${r.hint} px`).join(", ")})`,
      hint: `make the words people must read at least ${Math.ceil(minPx)} px; small detail on a mock screen can stay`,
    })
    notes.sort((a, b) => a.from - b.from)
  }
  return { bad, notes }
}

/**
 * The motion check. It steps through the video twice per frame (what the
 * final's motion blur averages) and reports, in plain words:
 *   camera jump   a shot's camera snaps in one step: two moves fight over it,
 *                 or a move starts somewhere else than where the camera is
 *   too fast      a camera faster than about 2000 px/s outside a transition:
 *                 motion blur shows it as a row of stepped copies
 *   pops twice    something shows, hides and shows again within 0.6 s (it was
 *                 visible before its own entrance)
 *   ghost copy    the same words on screen twice, on top of each other (two
 *                 copies of one layout crossfading)
 *   set twice     two different `set`s on one property of one element at 0 s
 * Transitions (and v.quiet spans) are skipped for the camera checks.
 */
async function motion(page, info) {
  const sps = Math.round(info.fps * 2)
  const k = Math.min(info.width, info.height) / 1080
  const busy = info.busy
  const quiet = (t) => busy.some(([a, b]) => t >= a - 0.02 && t <= b + 0.02)
  await page.evaluate(() => {
    let n = 0
    const tw = document.createTreeWalker(document.getElementById("stage"), NodeFilter.SHOW_TEXT)
    for (let x = tw.nextNode(); x; x = tw.nextNode()) {
      const p = x.parentElement
      if (!x.textContent.trim() || !p || p.closest(".roll-strip,.ghost")) continue
      const own = p.closest(".ln,.roll") || p
      if (!own.dataset.mid) own.dataset.mid = `m${n++}`
    }
    for (const el of document.querySelectorAll("[data-ghost]")) if (!el.dataset.mid) el.dataset.mid = `m${n++}`
  })
  const cams = new Map() // scene → [{ i, t, corners }]
  const vis = new Map() // id → [[t, visible]]
  const labels = new Map()
  const ghosts = new Map()
  const N = Math.floor((info.duration - 1 / info.fps) * sps + 1e-6)
  for (let i = 0; i <= N; i++) {
    const t = i / sps
    const snap = await page.evaluate(async (t) => {
      await window.__video.seek(t)
      const stage = document.getElementById("stage")
      const S = stage.getBoundingClientRect()
      const sc = S.width / stage.offsetWidth || 1
      const planes = {}
      const seen = []
      const texts = []
      const walk = (el, op, scene) => {
        const cs = getComputedStyle(el)
        if (cs.display === "none" || cs.visibility === "hidden") return
        const o = op * Number(cs.opacity)
        if (o < 0.05) return
        if (el.classList.contains("scene")) scene = el.className.replace(/^.*scene-/, "").split(" ")[0]
        if (el.classList.contains("plane") && scene) {
          const b = el.getBoundingClientRect()
          ;(planes[scene] ||= []).push([(b.left - S.left) / sc, (b.top - S.top) / sc, (b.right - S.left) / sc, (b.bottom - S.top) / sc])
        }
        if (el.dataset && el.dataset.mid) {
          seen.push(el.dataset.mid)
          const txt = el.textContent.replace(/\s+/g, " ").trim()
          if (txt.length > 6) {
            const b = el.getBoundingClientRect()
            if (b.width > 1 && b.height > 1) texts.push([scene || "over", txt.slice(0, 40), b.left, b.top, b.right, b.bottom, el.dataset.mid])
          }
        }
        for (const c of el.children) walk(c, o, scene)
      }
      walk(stage, 1, null)
      return { planes, seen, texts }
    }, t)
    const q = quiet(t)
    for (const [scene, list] of Object.entries(snap.planes)) {
      const a = cams.get(scene) || []
      a.push({ i, t, q, corners: list })
      cams.set(scene, a)
    }
    const on = new Set(snap.seen)
    for (const id of on) if (!vis.has(id)) vis.set(id, [[t, true]])
    for (const [id, h] of vis) {
      const v = on.has(id)
      if (h[h.length - 1][1] !== v) h.push([t, v])
    }
    const T = snap.texts
    for (const x of T) labels.set(x[6], x[1])
    for (let a = 0; a < T.length; a++) {
      for (let b = a + 1; b < T.length; b++) {
        const A = T[a]
        const B = T[b]
        if (A[0] === B[0] && A[1] === B[1] && A[2] < B[4] && B[2] < A[4] && A[3] < B[5] && B[3] < A[5]) {
          const key = A[1]
          const g = ghosts.get(key) || { from: t, to: t, n: 0, last: -2 }
          if (g.last === i - 1 || g.n === 0) g.to = t
          g.n++
          g.last = i
          ghosts.set(key, g)
        }
      }
    }
  }
  const bad = []
  // the camera: how far the corners of each plane moved between two samples
  for (const [scene, list] of cams) {
    const d = list.map((s, j) => {
      const p = list[j - 1]
      if (!p || p.i !== s.i - 1 || s.q || p.q || p.corners.length !== s.corners.length) return 0
      let m = 0
      s.corners.forEach((c, n) => {
        const o = p.corners[n]
        m = Math.max(m, Math.hypot(c[0] - o[0], c[1] - o[1]), Math.hypot(c[2] - o[2], c[3] - o[3]))
      })
      return m
    })
    let fast = null
    const flush = () => {
      if (fast && fast.n >= 3) bad.push({ kind: "too fast", from: fast.from, to: fast.to, what: `the "${scene}" shot's camera moves about ${Math.round(fast.peak / 10) * 10} px/s; motion blur will show stepped copies`, hint: "make that move longer and gentler (under 2000 px/s), or hide the change under a transition" })
      fast = null
    }
    d.forEach((x, j) => {
      const s = list[j]
      const jump = x > 40 * k && x > 3 * Math.max(d[j - 1] || 0, d[j + 1] || 0)
      if (jump) bad.push({ kind: "camera jump", from: s.t, to: s.t, what: `the "${scene}" shot's camera snaps ${Math.round(x)} px in one step`, hint: "give the shot one camera track: start each move where the last one ends (leave out `from`), or use P.path for one smooth move through several poses" })
      const speed = x * sps
      if (!jump && speed > 2000 * k) {
        if (!fast) fast = { from: s.t, to: s.t, n: 0, peak: 0 }
        fast.to = s.t
        fast.n++
        fast.peak = Math.max(fast.peak, speed)
      } else flush()
    })
    flush()
  }
  // shows, hides and shows again within 0.6 s
  for (const [id, h] of vis) {
    for (let j = 2; j < h.length; j++) {
      if (h[j][1] && !h[j - 1][1] && h[j - 2][1] && h[j][0] - h[j - 1][0] < 0.6) {
        bad.push({ kind: "pops twice", from: h[j - 2][0], to: h[j][0], what: `"${labels.get(id) || id}" shows, hides and shows again`, hint: "hide it from the start (a set at 0 s) until its own entrance" })
      }
    }
  }
  for (const [what, g] of ghosts) {
    if (g.n >= 2) bad.push({ kind: "ghost copy", from: g.from, to: g.to, what: `"${what}" is on screen twice, on top of itself`, hint: "never crossfade two copies of the same layout; move or change ONE element instead" })
  }
  for (const w of info.warnings || []) bad.push({ kind: "set twice", from: 0, to: 0, what: w, hint: "keep one set per property at 0 s (a scene is already hidden; show it with a single set)" })
  bad.sort((a, b) => a.from - b.from)
  return { bad }
}

async function check() {
  const { page, info } = await open(1)
  const only = val("only")
  const line = (r) => `  ${r.from.toFixed(1)}–${r.to.toFixed(1)} s  ${r.kind}: ${r.what}${r.hint ? ` → fix: ${r.hint}` : ""}`
  const plural = (n, s) => `${n} ${s}${n === 1 ? "" : "s"}`
  const out = []
  let bad = 0
  if (only !== "motion") {
    const L = await layout(page, info)
    bad += L.bad.length
    out.push(L.bad.length ? `The layout check found ${plural(L.bad.length, "problem")}:` : "Layout check passed: no overlaps, nothing cut off, nothing in the UI areas, no empty frames.")
    out.push(...L.bad.map(line))
    if (L.notes.length) {
      out.push("Notes (these do not stop the draft):")
      // three of each kind, then a count: the same fix applies
      const per = {}
      for (const r of L.notes) {
        per[r.kind] = (per[r.kind] || 0) + 1
        if (per[r.kind] <= 3) out.push(line(r))
      }
      for (const [kind, n] of Object.entries(per)) if (n > 3) out.push(`  … and ${n - 3} more "${kind}" notes like these`)
    }
  }
  if (only !== "layout") {
    const M = await motion(page, info)
    bad += M.bad.length
    out.push(M.bad.length ? `The motion check found ${plural(M.bad.length, "problem")}:` : "Motion check passed: one camera move at a time, nothing too fast, nothing pops in twice, no ghost copies.")
    out.push(...M.bad.map(line))
  }
  const text = out.join("\n")
  fs.writeFileSync(path.join(OUT, "check.txt"), text + "\n")
  say(text)
  return bad === 0
}

async function estimate() {
  const sample = async (scale, sub) => {
    const { grab, info, close } = await open(scale)
    await grab(0)
    const k = 6
    const t0 = Date.now()
    for (let i = 0; i < k; i++) for (let j = 0; j < sub; j++) await grab(((i + 0.5) / k) * info.duration + j * 0.004)
    await close()
    return { per: (Date.now() - t0) / k, N: Math.round(info.duration * info.fps) }
  }
  const d = await sample(0.5, 1)
  const f = await sample(1, SUBFRAMES)
  // the render runs several pages side by side; on a typical laptop that is about this much faster
  const workers = Math.max(1, Math.min(8, parseInt(val("workers"), 10) || Math.min(3, Math.max(1, os.cpus().length - 1))))
  const speed = 1 + (workers - 1) * 0.45
  say(`This ${cfg.duration} s video has ${d.N} frames. A draft takes about ${human((d.per * d.N * 1.2) / speed + 6000)}; the final takes about ${human((f.per * f.N * 1.3) / speed + 6000)}.`)
}

try {
  if (mode === "draft" || mode === "final") await video(mode)
  else if (mode === "check") {
    if (!(await check())) {
      cleanup()
      process.exit(1)
    }
  } else if (mode === "at" || mode === "stills") await stills()
  else if (mode === "cues") await cues()
  else await estimate()
} catch (e) {
  fail(`The render stopped: ${e && e.message ? e.message.split("\n")[0] : e}`)
}
await browser.close()
server.close()
process.exit(0)
