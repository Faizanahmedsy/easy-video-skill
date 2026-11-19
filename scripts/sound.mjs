#!/usr/bin/env node
/*
 * sound.mjs: the soundtrack, all synthesised here (no audio files from anywhere):
 * a soft music bed, sound effects at the picture's cues (v.sfx in scenes.js),
 * the voice-over (vo/voice.wav, if there is one) with the music ducked under it,
 * and the loudness set to about -14 LUFS. Writes <project>/vo/mix.wav.
 *
 *   node scripts/sound.mjs <project> [--mood calm|bright|punchy] [--no-music]
 *
 * The mood can also come from config.js: music: "calm" | "bright" | "punchy" | false.
 * Sound effects: whoosh, swish, tick, click, pop, hit (cue options: gain in dB, pitch, dur).
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SR = 48000
const fail = (msg) => {
  console.error(`\n${msg}\n`)
  process.exit(1)
}
const argv = process.argv.slice(2)
const target = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--mood")
if (!target) fail("Use: node scripts/sound.mjs <project> [--mood calm|bright|punchy] [--no-music]")
const PROJECT = [path.resolve(target), path.join(os.homedir(), "easy-videos", target)].find((p) => fs.existsSync(path.join(p, "config.js")))
if (!PROJECT) fail(`"${target}" is not a video project: there is no config.js in it.`)

function ffmpegBin() {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) return "ffmpeg"
  try {
    const p = createRequire(path.join(SKILL, "engine", "package.json"))("ffmpeg-static")
    if (p && fs.existsSync(p)) return p
  } catch {}
  fail("ffmpeg is missing. Run: bash scripts/setup.sh")
}
const FF = ffmpegBin()
const ff = (args, input) => spawnSync(FF, ["-hide_banner", "-y", ...args], { input, maxBuffer: 1 << 30 })

// ── 1. the picture's cues and length (render.mjs opens the page and lists them)
const r = spawnSync(process.execPath, [path.join(SKILL, "engine", "render.mjs"), PROJECT, "--cues"], { stdio: ["ignore", "ignore", "inherit"] })
if (r.status !== 0) fail("Could not read the sound cues from the video (see above).")
const info = JSON.parse(fs.readFileSync(path.join(PROJECT, "out", "cues.json"), "utf8"))
const N = Math.round(info.duration * SR)
const L = new Float32Array(N)
const R = new Float32Array(N)

let seed = 1234
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const noise = () => rnd() * 2 - 1
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
const db = (g) => 10 ** (g / 20)
/** add a mono sound into T (the mix, or the music) at `at` s, with gain and pan (-1 left … 1 right) */
function add(buf, at, gain = 1, pan = 0, T = { L, R }) {
  const o = Math.round(at * SR)
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2
  for (let i = Math.max(0, -o); i < buf.length && o + i < N; i++) {
    T.L[o + i] += buf[i] * gl
    T.R[o + i] += buf[i] * gr
  }
}
/** a one-pole low-pass, coefficient from a cutoff in Hz */
const lp = (fc) => {
  const a = Math.exp((-2 * Math.PI * fc) / SR)
  let y = 0
  return (x) => (y = x * (1 - a) + y * a)
}
/** a state-variable band-pass whose centre can move every sample */
const bp = (q = 0.6) => {
  let low = 0
  let band = 0
  return (x, fc) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR)
    low += f * band
    band += f * (x - low - q * band)
    return band
  }
}

// ── 2. music: pad chords, a soft bass, a plucked arpeggio, light drums for "punchy"
const MOODS = {
  calm: { bpm: 84, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]], arp: 2, drums: false, level: 0.9 },
  bright: { bpm: 104, root: 60, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], arp: 4, drums: false, level: 0.8 },
  punchy: { bpm: 118, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], arp: 4, drums: true, level: 0.75 },
}
const moodArg = argv.includes("--mood") ? argv[argv.indexOf("--mood") + 1] : undefined
const mood = argv.includes("--no-music") || info.music === false ? null : moodArg || (typeof info.music === "string" ? info.music : "calm")
if (mood && !MOODS[mood]) fail(`There is no music mood called "${mood}". Pick calm, bright or punchy.`)
const music = { L: new Float32Array(N), R: new Float32Array(N) }

function tone(f, len, o = {}) {
  const n = Math.round(len * SR)
  const b = new Float32Array(n)
  const att = (o.attack ?? 0.005) * SR
  const rel = (o.release ?? 0.1) * SR
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let s = 0
    for (let hN = 1; hN <= (o.harm ?? 1); hN++) s += Math.sin(2 * Math.PI * f * hN * t) / (hN * hN)
    const env = o.decay ? Math.exp(-t / o.decay) : 1
    b[i] = s * env * Math.min(1, i / att) * Math.min(1, (n - i) / rel)
  }
  return b
}

if (mood) {
  const M = MOODS[mood]
  const beat = 60 / M.bpm
  const bar = beat * 4
  const put = (buf, at, gain, pan = 0) => add(buf, at, gain, pan, music)
  for (let b = 0, t = 0; t < info.duration; b++, t += bar) {
    const ch = M.chords[b % M.chords.length]
    // pad: two slightly detuned voices per note, spread left and right
    for (const n of ch) {
      put(tone(hz(M.root + n), bar + 0.6, { harm: 3, attack: 0.5, release: 0.7 }), t, 0.05, -0.5)
      put(tone(hz(M.root + n) * 1.004, bar + 0.6, { harm: 3, attack: 0.6, release: 0.7 }), t, 0.05, 0.5)
    }
    // bass on beats 1 and 3
    for (const k of [0, 2]) put(tone(hz(M.root + ch[0] - 24), beat * 1.8, { harm: 2, attack: 0.01, decay: 0.6, release: 0.15 }), t + k * beat, 0.16)
    // arpeggio
    const step = beat / (M.arp / 2)
    for (let i = 0; i < 4 * (M.arp / 2); i++) {
      const n = ch[i % ch.length] + 12 + (i % 4 === 3 ? 12 : 0)
      put(tone(hz(M.root + n), 0.45, { harm: 2, decay: 0.14, release: 0.05 }), t + i * step, 0.045, i % 2 ? 0.35 : -0.35)
    }
    if (M.drums) {
      for (let k = 0; k < 4; k++) {
        const at = t + k * beat
        const kick = new Float32Array(Math.round(0.3 * SR))
        let ph = 0
        for (let i = 0; i < kick.length; i++) {
          const tt = i / SR
          ph += (2 * Math.PI * (45 + 90 * Math.exp(-tt / 0.03))) / SR
          kick[i] = Math.sin(ph) * Math.exp(-tt / 0.12)
        }
        put(kick, at, 0.3)
        const hat = new Float32Array(Math.round(0.05 * SR))
        let prev = 0
        for (let i = 0; i < hat.length; i++) {
          const x = noise()
          hat[i] = (x - prev) * Math.exp(-i / SR / 0.012)
          prev = x
        }
        put(hat, at + beat / 2, 0.06, 0.2)
      }
    }
  }
  // fade in and out
  for (let i = 0; i < N; i++) {
    const g = Math.min(1, i / (0.6 * SR), (N - i) / (1.2 * SR)) * M.level
    music.L[i] *= g
    music.R[i] *= g
  }
}

// ── 3. sound effects at the cues
const SFX = {
  whoosh(o) {
    const len = o.dur ?? 0.6
    const b = new Float32Array(Math.round(len * SR))
    const f = bp(0.9)
    for (let i = 0; i < b.length; i++) {
      const x = i / b.length
      b[i] = f(noise(), (300 + 2600 * Math.sin(Math.PI * x) ** 2) * (o.pitch ?? 1)) * Math.sin(Math.PI * x) ** 2 * 1.6
    }
    return b
  },
  swish(o) {
    const len = Math.min(o.dur ?? 0.32, 1.2)
    const b = new Float32Array(Math.round(len * SR))
    const f = bp(1.1)
    for (let i = 0; i < b.length; i++) {
      const x = i / b.length
      b[i] = f(noise(), (1400 + 4200 * x) * (o.pitch ?? 1)) * Math.sin(Math.PI * x) ** 1.5
    }
    return b
  },
  tick: (o) => tone(2600 * (o.pitch ?? 1), 0.06, { decay: 0.012, release: 0.01 }),
  click(o) {
    const b = tone(1800 * (o.pitch ?? 1), 0.05, { decay: 0.01, release: 0.01 })
    for (let i = 0; i < 200; i++) b[i] += noise() * (1 - i / 200) * 0.6
    return b
  },
  pop(o) {
    const b = new Float32Array(Math.round(0.14 * SR))
    let ph = 0
    for (let i = 0; i < b.length; i++) {
      const t = i / SR
      ph += (2 * Math.PI * (320 + 700 * Math.min(1, t / 0.05)) * (o.pitch ?? 1)) / SR
      b[i] = Math.sin(ph) * Math.exp(-t / 0.045) * Math.min(1, i / 48)
    }
    return b
  },
  hit(o) {
    const b = new Float32Array(Math.round(0.45 * SR))
    const f = lp(900)
    let ph = 0
    for (let i = 0; i < b.length; i++) {
      const t = i / SR
      ph += (2 * Math.PI * (40 + 80 * Math.exp(-t / 0.05)) * (o.pitch ?? 1)) / SR
      b[i] = Math.sin(ph) * Math.exp(-t / 0.16) + f(noise()) * Math.exp(-t / 0.05) * 1.5
    }
    return b
  },
  // a soft key press: a short filtered tap
  key(o) {
    const b = new Float32Array(Math.round(0.07 * SR))
    const f = bp(1.4)
    for (let i = 0; i < b.length; i++) b[i] = f(noise(), 3200 * (o.pitch ?? 1)) * Math.exp(-i / SR / 0.012) * 1.4
    return b
  },
  // a bright two-note bell for a confirmation
  chime(o) {
    const p = o.pitch ?? 1
    const a = tone(1318.5 * p, 0.9, { harm: 2, decay: 0.32, release: 0.1 })
    const c = tone(1975.5 * p, 0.8, { harm: 2, decay: 0.28, release: 0.1 })
    const b = new Float32Array(a.length + Math.round(0.08 * SR))
    for (let i = 0; i < a.length; i++) b[i] += a[i] * 0.6
    for (let i = 0; i < c.length; i++) b[i + Math.round(0.08 * SR)] += c[i] * 0.5
    return b
  },
  // filtered noise that swells up into a cut
  riser(o) {
    const len = o.dur ?? 0.8
    const b = new Float32Array(Math.round(len * SR))
    const f = bp(0.8)
    for (let i = 0; i < b.length; i++) {
      const x = i / b.length
      b[i] = f(noise(), (400 + 5200 * x * x) * (o.pitch ?? 1)) * x ** 2.2 * 1.3
    }
    return b
  },
}
const LEVEL = { whoosh: 0.32, swish: 0.22, tick: 0.16, click: 0.3, pop: 0.3, hit: 0.45, key: 0.12, chime: 0.18, riser: 0.22 }
const skipped = new Set()
let used = 0
for (const c of info.cues) {
  if (!SFX[c.kind]) {
    skipped.add(c.kind)
    continue
  }
  add(SFX[c.kind](c), c.at, LEVEL[c.kind] * db(c.gain ?? 0), c.pan ?? (rnd() - 0.5) * 0.3)
  used++
}

// ── 4. the voice, and the music ducked under it
let voice = null
const vfile = path.join(PROJECT, "vo", "voice.wav")
if (fs.existsSync(vfile)) {
  const out = ff(["-i", vfile, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"])
  if (out.status !== 0) fail("Could not read vo/voice.wav. Run scripts/voice.sh again with the voice file.")
  voice = new Float32Array(out.stdout.buffer, out.stdout.byteOffset, Math.floor(out.stdout.length / 4))
}
let env = 0
let duck = 1
const attack = Math.exp(-1 / (0.01 * SR))
const release = Math.exp(-1 / (0.3 * SR))
const duckIn = Math.exp(-1 / (0.08 * SR))
const duckOut = Math.exp(-1 / (0.45 * SR))
for (let i = 0; i < N; i++) {
  const vx = voice && i < voice.length ? voice[i] : 0
  const a = Math.abs(vx)
  env = a > env ? a + (env - a) * attack : a + (env - a) * release
  const want = env > 0.02 ? 0.3 : 1 // about -10 dB while someone speaks
  duck = want < duck ? want + (duck - want) * duckIn : want + (duck - want) * duckOut
  L[i] += music.L[i] * duck + vx
  R[i] += music.R[i] * duck + vx
}

// ── 5. loudness to about -14 LUFS (two passes of ffmpeg loudnorm), then vo/mix.wav
const pcm = new Float32Array(N * 2)
for (let i = 0; i < N; i++) {
  pcm[i * 2] = L[i]
  pcm[i * 2 + 1] = R[i]
}
const raw = Buffer.from(pcm.buffer)
const IN = ["-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "-"]
const LN = "loudnorm=I=-14:TP=-1.5:LRA=11"
const m = ff([...IN, "-af", `${LN}:print_format=json`, "-f", "null", "-"], raw)
const j = (() => {
  try {
    return JSON.parse(m.stderr.toString().match(/\{[^{}]*"input_i"[^{}]*\}/)[0])
  } catch {
    return null
  }
})()
const filter = j && Number.isFinite(parseFloat(j.input_i)) ? `${LN}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true` : "anull"
fs.mkdirSync(path.join(PROJECT, "vo"), { recursive: true })
const dest = path.join(PROJECT, "vo", "mix.wav")
const w = ff([...IN, "-af", filter, "-ar", String(SR), "-c:a", "pcm_s16le", dest], raw)
if (w.status !== 0) fail(`Could not write vo/mix.wav: ${w.stderr.toString().trim().split("\n").pop()}`)

const parts = [mood ? `${mood} music` : "no music", `${used} sound effect${used === 1 ? "" : "s"}`, voice ? "the voice, with the music ducked under it" : "no voice"]
console.log(`Sound ready: ${dest} (${parts.join(", ")}; about -14 LUFS).`)
if (skipped.size) console.log(`  note: there is no sound called ${[...skipped].join(", ")}; those cues were left silent.`)
if (info.audio !== "vo/mix.wav") console.log('  note: set audio: "vo/mix.wav" in config.js so the render uses this sound.')
