#!/usr/bin/env node
/*
 * voice.mjs: takes the voice-over file the user recorded or downloaded and
 * gets it ready for the video:
 *   1. converts it to <project>/vo/voice.wav (mono, 48 kHz)
 *   2. finds when each word is said → vo/words.js (window.VO_WORDS) and vo/words.json
 *      - with faster-whisper installed (optional, Python): exact word times
 *      - without it: the script's words (script.txt) spread over the speech
 *        that ffmpeg hears between the pauses
 *   3. prints the transcript, the length and a suggested video duration
 *
 *   node scripts/voice.mjs <project> <audio file> [--script file.txt]
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const fail = (msg) => {
  console.error(`\n${msg}\n`)
  process.exit(1)
}
const argv = process.argv.slice(2)
const pos = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--script")
const [target, input] = pos
if (!target || !input) fail("Use: node scripts/voice.mjs <project> <audio file> [--script script.txt]")
const PROJECT = [path.resolve(target), path.join(os.homedir(), "easy-videos", target)].find((p) => fs.existsSync(path.join(p, "config.js")))
if (!PROJECT) fail(`"${target}" is not a video project: there is no config.js in it.`)
if (!fs.existsSync(input)) fail(`I can't find the audio file "${input}".`)

function ffmpegBin() {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) return "ffmpeg"
  try {
    const p = createRequire(path.join(SKILL, "engine", "package.json"))("ffmpeg-static")
    if (p && fs.existsSync(p)) return p
  } catch {}
  fail("ffmpeg is missing. Run: bash scripts/setup.sh")
}
const FF = ffmpegBin()
const ff = (args) => spawnSync(FF, ["-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 28 })

// 1. convert
const VO = path.join(PROJECT, "vo")
fs.mkdirSync(VO, { recursive: true })
const wav = path.join(VO, "voice.wav")
if (path.resolve(input) !== wav) {
  const c = ff(["-i", input, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", wav])
  if (c.status !== 0) fail("That file does not look like audio I can read. Download the voice again as a WAV or MP3 and try once more.")
}

// 2a. the pauses (also gives the length)
const sd = ff(["-i", wav, "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"]).stderr
const dm = sd.match(/Duration: (\d+):(\d+):([\d.]+)/)
const duration = dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0
if (!(duration > 0.2)) fail("The voice file seems to be empty.")
const speech = []
let from = 0
let quiet = false // inside a pause
for (const m of sd.matchAll(/silence_(start|end): ([\d.]+)/g)) {
  const t = +m[2]
  quiet = m[1] === "start"
  if (!quiet) from = t
  else if (t - from > 0.12) speech.push([from, t])
}
if (!quiet && duration - from > 0.12) speech.push([from, duration])
if (!speech.length) speech.push([0, duration])

// 2b. word times: faster-whisper if it is there, else spread the script's words over the speech
let words = null
let how = ""
const PY = `
import json, sys
from faster_whisper import WhisperModel
m = WhisperModel("base", device="cpu", compute_type="int8")
segs, _ = m.transcribe(sys.argv[1], word_timestamps=True, vad_filter=True)
print(json.dumps([{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words if w.word.strip()]))
`
const py = ["python3", "python"].find((p) => spawnSync(p, ["-c", "import faster_whisper"], { stdio: "ignore" }).status === 0)
if (py) {
  console.log("Listening to the voice with Whisper (about as long as the voice itself)…")
  const w = spawnSync(py, ["-c", PY, wav], { encoding: "utf8", maxBuffer: 1 << 26 })
  try {
    words = JSON.parse(w.stdout.trim().split("\n").pop())
    how = "exact, from Whisper"
  } catch {
    console.log("  note: Whisper could not run, so the word times are estimated from the pauses instead.")
  }
}
if (!words) {
  const sArg = argv.includes("--script") ? argv[argv.indexOf("--script") + 1] : null
  const sFile = [sArg, path.join(PROJECT, "script.txt"), path.join(VO, "script.txt")].find((f) => f && fs.existsSync(f))
  const text = sFile ? fs.readFileSync(sFile, "utf8") : ""
  const list = text.split(/\s+/).filter(Boolean)
  if (!list.length) console.log("  note: there is no script.txt in the project, so there are no word times (captions need them). Put the script in script.txt and run this again.")
  // each word gets speaking time in proportion to its length; the time is laid over the speech segments
  const weight = list.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2)
  const total = weight.reduce((a, b) => a + b, 0)
  const talk = speech.reduce((a, [s, e]) => a + (e - s), 0)
  const place = (x) => {
    for (let i = 0; i < speech.length; i++) {
      const [s, e] = speech[i]
      if (x <= e - s || i === speech.length - 1) return { t: s + Math.min(x, e - s), seg: i }
      x -= e - s
    }
  }
  let acc = 0
  words = list.map((w, i) => {
    const a = place((acc / total) * talk)
    acc += weight[i]
    const b = place((acc / total) * talk - 0.001)
    const e = b.seg === a.seg ? b.t : speech[a.seg][1]
    return { w, s: +a.t.toFixed(3), e: +Math.max(e, a.t + 0.05).toFixed(3) }
  })
  how = list.length ? "estimated from the pauses (install faster-whisper for exact times)" : "none"
}

// 3. write and report
fs.writeFileSync(path.join(VO, "words.json"), JSON.stringify(words, null, 1))
fs.writeFileSync(path.join(VO, "words.js"), `// written by scripts/voice.sh: when each word of the voice-over is said (seconds)\nwindow.VO_WORDS = [\n${words.map((w) => `  ${JSON.stringify(w)},`).join("\n")}\n]\n`)
const suggest = Math.ceil(duration + 1.5)
console.log(`Voice ready: ${wav} (${duration.toFixed(1)} s long).`)
console.log(`Word times: ${words.length} words, ${how}.`)
if (words.length) console.log(`Transcript: ${words.map((w) => w.w).join(" ")}`)
console.log(`Suggested video length: ${suggest} s (duration: ${suggest} in config.js).`)
