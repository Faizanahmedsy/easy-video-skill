/*
 * kit.js: the small motion kit every video is built from.
 *
 * One paused GSAP timeline (v.tl) drives everything, so a frame is a pure
 * function of time: render.mjs seeks the timeline to each frame and takes a
 * screenshot. Never use setTimeout, Date.now(), Math.random() or CSS
 * animations in a video: use v.tl, v.onFrame and v.rand().
 *
 *   Kit.start(window.VIDEO, (v) => {
 *     const look = Kit.use(v, "clean")
 *     const A = Kit.shot(v, "intro")                       // a scene with 3 depth planes
 *     Kit.show(v, A.S, 0)
 *     const t = Kit.title(A.P.mid.el, "Ship *faster.*", { x: v.safe.x, y: 300, size: 120 })
 *     Kit.reveal(v, t, 0.2, { by: "words" })
 *     Kit.mark(v, t.em[0], 0.8, { kind: "bar" })
 *     A.P.move(0, 3, { zoom: 1.04 }, { from: { zoom: 1 } })   // slow camera push
 *     v.sfx("swish", 0.2)
 *   })
 *
 * Coordinates are stage pixels (1920 × 1080 for 16:9). v.k is 1 when the
 * short side is 1080 px. Every call is listed in docs/kit.md.
 */
;(function () {
  const G = window.gsap
  G.registerPlugin(...[window.CustomEase, window.SplitText, window.DrawSVGPlugin, window.MotionPathPlugin].filter(Boolean))
  const CE = window.CustomEase
  CE.create("out", "0.16,1,0.3,1") // fast start, long soft landing
  CE.create("inout", "0.65,0,0.35,1") // camera and UI moves
  CE.create("pop", "M0,0 C0.18,0.7 0.28,1.08 0.52,1.03 0.74,0.99 0.86,1 1,1") // a small overshoot
  CE.create("dash", "0.8,0,0.12,1") // very fast middle: slides and pushes

  const SVGNS = "http://www.w3.org/2000/svg"
  const SVG_TAGS = /^(svg|g|path|circle|ellipse|rect|line|polyline|polygon|text|tspan|defs|clipPath|linearGradient|radialGradient|stop|mask|pattern|image)$/

  /** A deterministic random number generator (mulberry32). */
  function seeded(seed) {
    let a = seed >>> 0 || 1
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /** Make an element: h("div", { class: "card", style: { left: "10px" } }, parent, "text"). */
  function h(tag, attrs, parent, text) {
    const el = SVG_TAGS.test(tag) ? document.createElementNS(SVGNS, tag) : document.createElement(tag)
    for (const [k, val] of Object.entries(attrs || {})) {
      if (val === undefined || val === null) continue
      if (k === "style" && typeof val === "object") {
        for (const [sk, sv] of Object.entries(val)) if (sv !== undefined && sv !== null) el.style[sk] = sv
      } else el.setAttribute(k, String(val))
    }
    if (text !== undefined) el.textContent = text
    if (parent) parent.appendChild(el)
    return el
  }

  // ───────────────────────────────────────────────────────── formats ──

  /**
   * safe = the box words and logos stay inside: [left, top, right, bottom]
   * margins at 1080 px on the short side. ui = the areas a platform covers
   * with its own buttons and captions (vertical video): keep text out.
   */
  const FORMATS = {
    "16:9": { size: [1920, 1080], safe: [120, 84, 120, 84], ui: [] },
    "9:16": {
      size: [1080, 1920],
      safe: [72, 230, 168, 440],
      ui: [
        { name: "top bar", x: 0, y: 0, w: 1, h: 0.105 },
        { name: "caption and buttons", x: 0, y: 0.775, w: 1, h: 0.225 },
        { name: "side buttons", x: 0.85, y: 0.44, w: 0.15, h: 0.42 },
      ],
    },
    "1:1": { size: [1080, 1080], safe: [84, 84, 84, 84], ui: [] },
  }
  function formatOf(cfg) {
    if (FORMATS[cfg.format]) return cfg.format
    const a = (cfg.width || 1920) / (cfg.height || 1080)
    return a > 1.3 ? "16:9" : a < 0.8 ? "9:16" : "1:1"
  }

  // ─────────────────────────────────────────────────────────── stage ──

  function create(cfg) {
    const fmt = formatOf(cfg)
    const F = FORMATS[fmt]
    if (!cfg.width || !cfg.height) [cfg.width, cfg.height] = F.size
    const W = cfg.width
    const H = cfg.height
    const k = Math.min(W, H) / 1080
    const [sl, st, sr, sb] = F.safe.map((m) => m * k)
    const stage = document.getElementById("stage")
    Object.assign(stage.style, { width: `${W}px`, height: `${H}px` })
    stage.dataset.look = cfg.look || "clean"
    stage.dataset.format = fmt
    stage.style.setProperty("--k", String(k))
    for (const [name, val] of Object.entries(cfg.palette || {})) stage.style.setProperty(`--${name}`, val)

    const tl = G.timeline({ paused: true, defaults: { ease: "out" } })
    // A tween placed at a negative time makes GSAP shift the whole timeline:
    // clamp such positions to 0 (and say so once).
    let warned = false
    for (const [m, i] of [["to", 2], ["from", 2], ["fromTo", 3], ["set", 2], ["add", 1], ["call", 2]]) {
      const orig = tl[m].bind(tl)
      tl[m] = (...a) => {
        if (typeof a[i] === "number" && a[i] < 0) {
          if (!warned) console.warn(`kit: something was placed at ${a[i].toFixed(2)} s; moved to 0`)
          warned = true
          a[i] = 0
        }
        return orig(...a)
      }
    }
    const fx = document.getElementById("fx")
    fx.setAttribute("viewBox", `0 0 ${W} ${H}`)
    const v = {
      cfg,
      W,
      H,
      k,
      format: fmt,
      portrait: H > W * 1.05,
      safe: { x: sl, y: st, w: W - sl - sr, h: H - st - sb, r: W - sr, b: H - sb, cx: sl + (W - sl - sr) / 2, cy: st + (H - st - sb) / 2 },
      ui: F.ui.map((z) => ({ name: z.name, x: z.x * W, y: z.y * H, w: z.w * W, h: z.h * H })),
      tl,
      stage,
      cam: document.getElementById("cam"),
      fx,
      over: document.getElementById("over"),
      defs: h("defs", {}, fx),
      rand: seeded(cfg.seed || 11),
      fps: cfg.fps || 30,
      frameFns: [],
      pending: [],
      cues: [],
      looks: {},
    }
    let uid = 0
    v.uid = (p = "u") => `${p}${++uid}`
    /** A sound effect locked to the picture: v.sfx("whoosh", 2.4, { gain: -3, pitch: 1.1 }). */
    v.sfx = (kind, at, o = {}) => {
      v.cues.push(Object.assign({ kind, at: Math.round(at * 1000) / 1000 }, o))
      return v
    }
    /** A full-stage SVG inside `parent` (stage-pixel coordinates); returns its root <g>. */
    v.svg = (parent) => h("g", {}, h("svg", { class: "stage-svg", viewBox: `0 0 ${W} ${H}` }, parent))
    /** Wait for something (an image) before the first frame. */
    v.wait = (p) => {
      v.pending.push(Promise.resolve(p).catch((e) => console.error(`kit: could not load ${e && e.message ? e.message : e}`)))
      return p
    }
    /** Run fn(t) on every frame (things drawn by hand). */
    v.onFrame = (fn) => v.frameFns.push(fn)
    /** A full-stage scene, hidden until Kit.show. */
    v.scene = (name) => {
      const el = h("div", { class: `scene scene-${name}` }, document.getElementById("scenes"))
      G.set(el, { autoAlpha: 0 })
      return el
    }
    backdrop(v, cfg.backdrop)
    return v
  }

  // ──────────────────────────────────────────────────────── backdrop ──

  /**
   * The ground behind every scene (outside the camera):
   *   "grid"  light ground, a fine drafting grid, a soft spotlight that drifts
   *   "spot"  dark ground, one large spotlight that drifts
   *   "none"  just the ground colour (--ground)
   */
  function backdrop(v, kind = "none") {
    const bd = document.querySelector("#stage .backdrop")
    const { W, H, k, tl, cfg } = v
    const dur = cfg.duration
    if (kind === "grid") {
      const g = h("g", {}, h("svg", { class: "stage-svg", viewBox: `0 0 ${W} ${H}` }, bd))
      const step = 64 * k
      let minor = ""
      let major = ""
      let n = 0
      for (let x = -step; x <= W + step; x += step, n++) (n % 4 ? (minor += `M${x},${-step}V${H + step}`) : (major += `M${x},${-step}V${H + step}`))
      n = 0
      for (let y = -step; y <= H + step; y += step, n++) (n % 4 ? (minor += `M${-step},${y}H${W + step}`) : (major += `M${-step},${y}H${W + step}`))
      h("path", { d: minor, class: "grid-minor", fill: "none" }, g)
      h("path", { d: major, class: "grid-major", fill: "none" }, g)
      // the grid creeps one cell over the whole video: alive, never busy
      tl.fromTo(g, { x: 0, y: 0 }, { x: -step, y: -step * 0.5, duration: dur, ease: "none", immediateRender: true }, 0)
    }
    if (kind === "grid" || kind === "spot") {
      const s = h("div", { class: `spot spot-${kind}`, style: { width: `${W * 1.1}px`, height: `${W * 1.1}px`, left: `${-W * 0.05}px`, top: `${H / 2 - W * 0.55}px` } }, bd)
      const period = 9
      tl.add(G.fromTo(s, { xPercent: -18, yPercent: -8 }, { xPercent: 18, yPercent: 8, duration: period, repeat: Math.ceil(dur / period), yoyo: true, ease: "sine.inOut", immediateRender: true }), 0)
    }
  }

  /** Film finish: fine frame-locked grain and a soft vignette. o: { grain: 0.06, vignette: 0.25 } */
  function finish(v, o = {}) {
    const vig = document.getElementById("vignette")
    vig.style.opacity = String(o.vignette ?? 0.25)
    if (!o.grain && o.grain !== undefined) return
    const size = 192
    const tiles = []
    const wrap = h("div", { class: "grain", style: { opacity: String(o.grain ?? 0.06) } }, v.over)
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("canvas")
      c.width = c.height = size
      const ctx = c.getContext("2d")
      const img = ctx.createImageData(size, size)
      const rnd = seeded(900 + i * 17)
      for (let p = 0; p < size * size; p++) {
        const g = 128 + (rnd() + rnd() - 1) * 180
        img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = g
        img.data[p * 4 + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      tiles.push(h("div", { class: "grain-tile", style: { backgroundImage: `url(${c.toDataURL()})`, visibility: "hidden" } }, wrap))
    }
    let last = -1
    v.onFrame((t) => {
      // every motion-blur sub-frame of one output frame gets the same grain
      const f = Math.floor(t * v.fps + 1e-3)
      if (f === last) return
      last = f
      tiles.forEach((el, i) => (el.style.visibility = i === ((f % 4) + 4) % 4 ? "visible" : "hidden"))
    })
  }

  // ─────────────────────────────────────────────────── scenes + camera ──

  function show(v, els, at) {
    v.tl.set(els, { autoAlpha: 1 }, at)
  }
  function hide(v, els, at) {
    v.tl.set(els, { autoAlpha: 0 }, at)
  }

  /**
   * Depth planes inside a scene: each is a full-stage div (pl.el, for HTML)
   * with a full-stage SVG group (pl.g). P.move() shifts every plane by its
   * depth, so near things move more than far ones (parallax).
   *   P.move(at, dur, { x: -40, y: 0, zoom: 1.05, rotate: 0 }, { from: { zoom: 1 }, ease })
   *   P.aim(x, y, zoom)  a move target that zooms toward the stage point (x, y)
   */
  function planes(v, scene, depths = { bg: 0.35, mid: 0.75, fg: 1.3 }) {
    const P = { list: [] }
    for (const [name, depth] of Object.entries(depths)) {
      const el = h("div", { class: `plane plane-${name}` }, scene)
      const pl = { name, el, depth, g: v.svg(el) }
      P[name] = pl
      P.list.push(pl)
    }
    const state = (o, d) => ({ x: (o.x ?? 0) * d, y: (o.y ?? 0) * d, scale: 1 + ((o.zoom ?? 1) - 1) * d, rotation: (o.rotate ?? 0) * d })
    P.aim = (fx, fy, zoom, extra = {}) => Object.assign({ x: (v.W / 2 - fx) * (zoom - 1), y: (v.H / 2 - fy) * (zoom - 1), zoom }, extra)
    P.move = (at, dur, to = {}, o = {}) => {
      for (const pl of P.list) {
        if (o.from) v.tl.set(pl.el, state(Object.assign({ x: 0, y: 0, zoom: 1, rotate: 0 }, o.from), pl.depth), at)
        v.tl.to(pl.el, Object.assign(state(Object.assign({ x: 0, y: 0, zoom: 1, rotate: 0 }, to), pl.depth), { duration: dur, ease: o.ease || "sine.inOut" }), at)
      }
      return P
    }
    return P
  }

  /** A scene with depth planes in one call: const A = Kit.shot(v, "intro") → { S, P }. */
  function shot(v, name, depths) {
    const S = v.scene(name)
    return { S, P: planes(v, S, depths) }
  }

  // ──────────────────────────────────────────────────────────── text ──

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  /** "|" breaks a line, *word* marks the highlight (class "em"). */
  function markup(str) {
    return str
      .split("|")
      .map((line) => esc(line.trim()).replace(/\*([^*]+)\*/g, '<span class="em">$1</span>'))
      .join("<br>")
  }

  /** Put a block at x (its left, centre or right edge, by align) and y (its top). */
  function place(el, o) {
    const w = o.w ?? 1400
    const align = o.align || "left"
    if (o.x !== undefined) {
      el.style.left = `${align === "center" ? o.x - w / 2 : align === "right" ? o.x - w : o.x}px`
      el.style.width = `${w}px`
    }
    el.style.textAlign = align
    if (o.y !== undefined) el.style.top = `${o.y}px`
    if (o.size) el.style.fontSize = `${o.size}px`
    if (o.color) el.style.color = o.color
  }

  /**
   * A title split into masked lines, words and characters (nothing moves
   * until Kit.reveal). o: { x, y, w, size, align, cls, color }
   * Returns { el, lines, words, chars, em } (em = the *marked* spans).
   */
  function title(parent, str, o = {}) {
    const el = h("div", { class: `title ${o.cls || ""}` }, parent)
    el.innerHTML = markup(str)
    place(el, o)
    const split = new window.SplitText(el, { type: "lines,words,chars", mask: "lines", linesClass: "ln", wordsClass: "wd", charsClass: "ch", aria: "none" })
    const em = [...el.querySelectorAll(".em")].filter((e) => e.textContent.trim())
    return { el, split, lines: split.lines, words: split.words, chars: split.chars, em }
  }

  /** Masked entrance: lines / words / chars rise out of their line masks. Returns the end time. */
  function reveal(v, t, at, o = {}) {
    const by = o.by || "lines"
    const targets = o.targets || t[by]
    const each = o.each ?? { lines: 0.1, words: 0.06, chars: 0.022 }[by]
    const dur = o.dur ?? (by === "chars" ? 0.6 : 0.8)
    const dir = o.from === "above" ? -1 : 1
    v.tl.fromTo(targets, { yPercent: dir * 112, autoAlpha: o.fade ? 0 : 1 }, { yPercent: 0, autoAlpha: 1, duration: dur, ease: o.ease || "out", stagger: each, immediateRender: true }, at)
    return at + (targets.length - 1) * each + dur
  }
  /** Masked exit: everything slides up (or to: "below") behind its mask. */
  function unreveal(v, t, at, o = {}) {
    const targets = o.targets || t[o.by || "lines"]
    v.tl.to(targets, { yPercent: (o.to === "below" ? 1 : -1) * 125, duration: o.dur ?? 0.4, ease: "power3.in", stagger: o.each ?? 0.04 }, at)
    return at + (o.dur ?? 0.4) + (targets.length - 1) * (o.each ?? 0.04)
  }

  /** Words rise at their own times (spoken words): times[i] for t.words[i]; null skips. */
  function sayWords(v, t, times, o = {}) {
    times.forEach((at, i) => {
      if (at == null || !t.words[i]) return
      v.tl.set(t.words[i], { yPercent: 112 }, 0)
      v.tl.fromTo(t.words[i], { yPercent: 112 }, { yPercent: 0, duration: o.dur ?? 0.55, ease: "out", immediateRender: false }, Math.max(0, at - (o.lead ?? 0.05)))
    })
  }

  /**
   * A drawn mark on a highlighted span (t.em[i]) that grows from the left:
   *   kind "bar"  a thick bar under the words
   *   kind "box"  a solid block behind the words; the text turns --on-accent
   * o: { kind, color, dur }. Returns the end time.
   */
  function mark(v, span, at, o = {}) {
    if (!span) return at
    const kind = o.kind || "bar"
    const m = h("span", { class: `mark mark-${kind}`, style: { background: o.color } }, span)
    const dur = o.dur ?? 0.45
    v.tl.fromTo(m, { scaleX: 0 }, { scaleX: 1, duration: dur, ease: "inout", immediateRender: true }, at)
    if (kind === "box") v.tl.to(span, { color: o.text || "var(--on-accent)", duration: 0.12, ease: "none" }, at + dur * 0.45)
    return at + dur
  }

  /** Count a number: Kit.count(v, el, 0, 1250, at, 1.2, (n) => `$${n.toFixed(0)}`). */
  function count(v, el, from, to, at, dur = 1.2, fmt) {
    const f = fmt || ((n) => Math.round(n).toLocaleString(v.cfg.locale || "en-US"))
    const st = { n: from }
    el.textContent = f(from)
    v.tl.fromTo(st, { n: from }, { n: to, duration: dur, ease: "power2.out", immediateRender: false, onUpdate: () => (el.textContent = f(st.n)) }, at)
  }

  /** Type text into an element, `cps` characters a second. Returns the end time. */
  function typeOn(v, el, str, at, cps = 24) {
    const st = { n: 0 }
    v.tl.fromTo(st, { n: 0 }, { n: str.length, duration: str.length / cps, ease: "none", immediateRender: false, onUpdate: () => (el.textContent = str.slice(0, Math.round(st.n))) }, at)
    return at + str.length / cps
  }

  // a hidden probe that measures text exactly as the page draws it
  let probe = null
  /** Width (px) of `text` drawn with class `cls` at font-size 100 px. */
  function measure(v, text, cls, style = {}) {
    if (!probe) probe = h("div", {}, v.stage)
    probe.className = cls || ""
    probe.removeAttribute("style")
    Object.assign(probe.style, { position: "absolute", left: "-99999px", top: "0", visibility: "hidden", whiteSpace: "nowrap", fontSize: "100px" }, style)
    probe.textContent = text
    return probe.getBoundingClientRect().width
  }
  /** Font size (px) at which `text` (class cls) is exactly `width` px wide. o: { max, min, style } */
  function fit(v, text, width, cls, o = {}) {
    const s = (width / Math.max(1, measure(v, text, cls, o.style))) * 100
    return Math.max(o.min ?? 8, Math.min(o.max ?? 3000, s))
  }

  // ──────────────────────────────────────────────── cards, data, cursor ──

  /** A card (div) at a position: Kit.card(parent, { x, y, w, h, cls }). */
  function card(parent, o = {}) {
    return h("div", { class: `card ${o.cls || ""}`, style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, width: o.w ? `${o.w}px` : undefined, height: o.h ? `${o.h}px` : undefined } }, parent, o.text)
  }

  /** An entrance: rise and settle. Kit.enter(v, el, at, { y: 40, scale: 0.96, dur }) */
  function enter(v, els, at, o = {}) {
    v.tl.fromTo(els, { autoAlpha: 0, y: o.y ?? 40, x: o.x ?? 0, scale: o.scale ?? 1 }, { autoAlpha: 1, y: 0, x: 0, scale: 1, duration: o.dur ?? 0.6, ease: o.ease || "out", stagger: o.each ?? 0.08, immediateRender: false }, at)
    if (at > 0) v.tl.set(els, { autoAlpha: 0 }, 0)
    return at + (o.dur ?? 0.6)
  }

  /**
   * A row of number tiles with one shared size, so every value stays on one
   * line and the numbers line up. items: [{ label, to, from, fmt, sub }]
   * o: { x, y, w, gap, at, each, dur, cls, max } → { el, tiles, values, size }
   */
  function kpis(v, parent, items, o) {
    const gap = o.gap ?? 20 * v.k
    const el = h("div", { class: `kpis ${o.cls || ""}`, style: { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w}px`, gap: `${gap}px`, gridTemplateColumns: `repeat(${items.length}, 1fr)` } }, parent)
    const tiles = items.map((it) => {
      const tile = h("div", { class: "kpi" }, el)
      h("div", { class: "kpi-label" }, tile, it.label)
      const val = h("div", { class: "kpi-value" }, tile, "0")
      h("div", { class: "kpi-sub" }, tile, it.sub || "")
      return { tile, val }
    })
    // one size for every value: the size at which the widest final value fits
    const pad = o.pad ?? 56 * v.k
    const colW = (o.w - gap * (items.length - 1)) / items.length - pad
    const size = Math.min(o.max ?? 64 * v.k, ...items.map((it) => fit(v, (it.fmt || String)(it.to), colW, "kpi-value")))
    tiles.forEach(({ val }, i) => {
      val.style.fontSize = `${size}px`
      const it = items[i]
      if (o.at === undefined) {
        val.textContent = (it.fmt || String)(it.to)
        return
      }
      const t0 = o.at + i * (o.each ?? 0.12)
      count(v, val, it.from ?? 0, it.to, t0, o.dur ?? 1.1, it.fmt)
      v.sfx("tick", t0, { pitch: 0.95 + i * 0.08, gain: -5 })
    })
    if (o.at !== undefined) enter(v, tiles.map((t) => t.tile), o.at - 0.15, { y: 24, each: o.each ?? 0.12, dur: 0.5 })
    return { el, tiles, values: tiles.map((t) => t.val), size }
  }

  /**
   * A table: cols [{ label, w, key, align, fmt(value, row) }], rows [objects].
   * o: { x, y, w, rowH, headH, at, each, sortAt, sortBy, desc } → { el, rows, order }
   * Rows slide in from `at`; with sortAt they re-sort by sortBy (largest first).
   */
  function table(v, parent, o) {
    const rowH = o.rowH ?? 64 * v.k
    const headH = o.headH ?? 48 * v.k
    const el = h("div", { class: `table ${o.cls || ""}`, style: { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w}px`, height: `${headH + rowH * o.rows.length}px` } }, parent)
    const cell = (c, html) => `<span class="td" style="width:${c.w}px;text-align:${c.align || "left"}">${html}</span>`
    h("div", { class: "tr th", style: { top: "0px", height: `${headH}px` } }, el).innerHTML = o.cols.map((c) => cell(c, c.label)).join("")
    const rows = o.rows.map((d, i) => {
      const row = h("div", { class: "tr", style: { top: `${headH + i * rowH}px`, height: `${rowH}px` } }, el)
      row.innerHTML = o.cols.map((c) => cell(c, c.fmt ? c.fmt(d[c.key], d) : d[c.key])).join("")
      return { el: row, data: d }
    })
    if (o.at !== undefined) {
      rows.forEach((rw, i) => {
        const t0 = o.at + i * (o.each ?? 0.08)
        v.tl.set(rw.el, { autoAlpha: 0 }, 0)
        v.tl.fromTo(rw.el, { autoAlpha: 0, x: 36 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "out", immediateRender: false }, t0)
        v.sfx("tick", t0, { pitch: 1 + i * 0.05, gain: -11 })
      })
    }
    let order = rows
    if (o.sortAt !== undefined && o.sortBy) {
      order = rows.slice().sort((a, b) => (o.desc === false ? 1 : -1) * (a.data[o.sortBy] - b.data[o.sortBy]))
      order.forEach((rw, j) => {
        const from = rows.indexOf(rw)
        if (from !== j) v.tl.to(rw.el, { y: (j - from) * rowH, duration: 0.6, ease: "inout" }, o.sortAt + j * 0.03)
      })
      v.sfx("swish", o.sortAt, { gain: -9, pitch: 1.2 })
    }
    return { el, rows, order, rowH, headH }
  }

  /** Smooth path through points (Catmull-Rom → cubic Bézier). */
  function smooth(pts, tension = 6) {
    const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))]
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
      d += `C${(b[0] + (c[0] - a[0]) / tension).toFixed(1)},${(b[1] + (c[1] - a[1]) / tension).toFixed(1)} ${(c[0] - (e[0] - b[0]) / tension).toFixed(1)},${(c[1] - (e[1] - b[1]) / tension).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`
    }
    return d
  }

  /** visibility: hidden until `at` (a round-capped stroke at 0 length still shows a dot). */
  function hideUntil(v, els, at) {
    G.set(els, { visibility: "hidden" })
    v.tl.set(els, { visibility: "visible" }, at)
  }

  /**
   * A line chart that draws itself: o: { x, y, w, h, values, at, dur, min, max,
   * grid: 4, area: true, smooth: true, cls } → { g, line, dot, pts, end }.
   * Styling comes from the look's CSS (.chart-line, .chart-area, .chart-grid, .chart-dot).
   */
  function lineChart(v, parent, o) {
    const { x, y, w, h: ht, values, at } = o
    const dur = o.dur ?? 1.2
    const max = o.max ?? Math.max(...values)
    const min = o.min ?? 0
    const pts = values.map((val, i) => [x + (i / (values.length - 1)) * w, y + ht - ((val - min) / (max - min || 1)) * ht])
    const d = o.smooth === false ? `M${pts.map((p) => p.join(",")).join("L")}` : smooth(pts)
    const g = h("g", { class: `chart ${o.cls || ""}` }, parent)
    const lines = []
    for (let i = 0; i <= (o.grid ?? 4); i++) lines.push(h("path", { d: `M${x},${y + (ht * i) / (o.grid ?? 4)}H${x + w}`, class: "chart-grid" }, g))
    if (lines.length) {
      hideUntil(v, lines, Math.max(0, at - 0.3))
      v.tl.fromTo(lines, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, stagger: 0.04, ease: "inout", immediateRender: false }, Math.max(0, at - 0.3))
    }
    if (o.area !== false) {
      const id = v.uid("ca")
      const grad = h("linearGradient", { id: `${id}g`, x1: 0, y1: 0, x2: 0, y2: 1 }, v.defs)
      h("stop", { offset: "0", class: "chart-area-top" }, grad)
      h("stop", { offset: "1", class: "chart-area-bottom" }, grad)
      const clip = h("rect", { x, y: y - 40, width: 0, height: ht + 80 }, h("clipPath", { id: `${id}c` }, v.defs))
      h("path", { d: `${d}L${x + w},${y + ht}L${x},${y + ht}Z`, fill: `url(#${id}g)`, "clip-path": `url(#${id}c)`, class: "chart-area" }, g)
      v.tl.fromTo(clip, { attr: { width: 0 } }, { attr: { width: w + 20 }, duration: dur, ease: "inout", immediateRender: false }, at)
    }
    const line = h("path", { d, class: "chart-line" }, g)
    hideUntil(v, line, at)
    v.tl.fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: dur, ease: "inout", immediateRender: false }, at)
    const last = pts[pts.length - 1]
    const dot = h("circle", { cx: last[0], cy: last[1], r: (o.dot ?? 9) * v.k, class: "chart-dot" }, g)
    v.tl.set(dot, { scale: 0, transformOrigin: "50% 50%" }, 0)
    v.tl.to(dot, { scale: 1, duration: 0.4, ease: "pop" }, at + dur - 0.05)
    v.sfx("swish", at, { gain: -12, dur })
    return { g, line, dot, pts, end: at + dur }
  }

  /** Bars that grow from the baseline: o: { x, y, w, h, values, at, max, gap, cls } → rects. */
  function bars(v, parent, o) {
    const n = o.values.length
    const gap = o.gap ?? 0.35
    const bw = o.w / (n + (n - 1) * gap)
    const max = o.max ?? Math.max(...o.values)
    const els = o.values.map((val, i) => {
      const bh = (val / max) * o.h
      return h("rect", { x: o.x + i * bw * (1 + gap), y: o.y + o.h - bh, width: bw, height: bh, rx: o.radius ?? Math.min(10, bw * 0.2), class: `bar ${o.cls || ""} ${o.hi === i ? "bar-hi" : ""}` }, parent)
    })
    v.tl.set(els, { scaleY: 0, transformOrigin: "50% 100%" }, 0)
    v.tl.to(els, { scaleY: 1, duration: 0.6, ease: "pop", stagger: o.each ?? 0.06 }, o.at)
    return els
  }

  /**
   * The cursor (in an SVG plane group): glide on a curve, click with a ripple, leave.
   *   const c = Kit.cursor(v, P.fg.g); c.glide(at, [x0, y0], [x1, y1]); c.click(at2, x1, y1)
   */
  function cursor(v, svgG, o = {}) {
    const root = h("g", { class: "cursor" }, svgG)
    const s = (o.size ?? 1) * v.k
    const inner = h("g", {}, root)
    h("path", { d: "M0,0 L0,44 L11,33 L20,53 L29,49 L20,30 L35,30 Z", class: "cursor-arrow" }, inner)
    G.set(inner, { scale: s, svgOrigin: "0 0" })
    v.tl.set(root, { autoAlpha: 0 }, 0)
    const pos = { x: 0, y: 0 }
    return {
      g: root,
      glide(at, from, to, dur = 0.7) {
        v.tl.set(root, { x: from[0], y: from[1], autoAlpha: 1 }, at)
        const mid = { x: (from[0] + to[0]) / 2 + 70 * v.k, y: (from[1] + to[1]) / 2 + 50 * v.k }
        v.tl.to(root, { duration: dur, ease: "inout", motionPath: { path: [{ x: from[0], y: from[1] }, mid, { x: to[0], y: to[1] }], curviness: 1.1 } }, at)
        pos.x = to[0]
        pos.y = to[1]
        return at + dur
      },
      click(at, x = pos.x, y = pos.y) {
        v.tl.to(inner, { scale: s * 0.82, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out" }, at)
        const ring = h("circle", { cx: x, cy: y, r: 10, class: "cursor-ripple" }, svgG)
        v.tl.set(ring, { autoAlpha: 0 }, 0)
        v.tl.fromTo(ring, { attr: { r: 8 * v.k }, autoAlpha: 0.9 }, { attr: { r: 64 * v.k }, autoAlpha: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, at + 0.02)
        v.sfx("click", at)
        return at + 0.1
      },
      leave(at, to) {
        v.tl.to(root, { x: to[0], y: to[1], autoAlpha: 0, duration: 0.45, ease: "power2.in" }, at)
      },
    }
  }

  /** A gentle float on anything that would sit still: Kit.float(v, el, { y: 8 }, { period: 3 }). */
  function float(v, els, vars, o = {}) {
    const list = Array.isArray(els) ? els : [els]
    const period = o.period ?? 3
    v.onFrame((t) => {
      list.forEach((el, i) => {
        const q = 0.5 - 0.5 * Math.cos((2 * Math.PI * (t + i * (o.phase ?? 0.4))) / period)
        const set = {}
        for (const [p, amt] of Object.entries(vars)) set[p] = amt * q
        G.set(el, set)
      })
    })
  }

  /** An image (a logo, a photo) the first frame waits for: Kit.image(v, parent, "assets/logo.png", { x, y, w, h }). */
  function image(v, parent, src, o = {}) {
    const img = h("img", { src, class: o.cls || "", style: { position: "absolute", left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, width: o.w ? `${o.w}px` : undefined, height: o.h ? `${o.h}px` : undefined, objectFit: o.fit || "contain" } }, parent)
    v.wait(img.decode().catch(() => Promise.reject(new Error(src))))
    return img
  }

  /** Where `el` sits on the stage (layout px, uniform scales divided out). */
  function box(el, ref) {
    const a = el.getBoundingClientRect()
    const b = ref.getBoundingClientRect()
    const s = ref.offsetWidth && b.width ? b.width / ref.offsetWidth : 1
    return { x: (a.left - b.left) / s, y: (a.top - b.top) / s, w: a.width / s, h: a.height / s }
  }

  // ───────────────────────────────────────────────────── transitions ──

  /**
   * 1 · Push: the old shot slides out and the new one slides in behind it,
   * each plane by its depth (a camera move, sharp in the middle, blurred in
   * the final). A and B are Kit.shot results. o: { dir: "left" | "right" | "up", dur, dist }
   */
  function push(v, A, B, at, o = {}) {
    const dur = o.dur ?? 0.55
    const dist = o.dist ?? (o.dir === "up" || o.dir === "down" ? v.H : v.W) * 1.1
    const s = o.dir === "right" || o.dir === "down" ? 1 : -1
    const axis = o.dir === "up" || o.dir === "down" ? "y" : "x"
    A.P.move(at, dur, { [axis]: s * dist }, { ease: "dash" })
    show(v, B.S, at)
    B.P.move(at, dur, { [axis]: 0 }, { from: { [axis]: -s * dist }, ease: "dash" })
    hide(v, A.S, at + dur)
    v.sfx("whoosh", at + dur * 0.45, { dur: 0.6 })
    return at + dur
  }

  /**
   * 2 · Panels: full-frame colour panels slide across one after another and
   * stack, cover the frame, then leave the other way. Swap shots at .mid.
   * o: { colors: [..], dir: "up" | "left" | "right" | "down", dur, each, text, textColor }
   */
  function panels(v, at, o = {}) {
    const colors = o.colors || ["var(--accent)", "var(--ink)"]
    const dir = o.dir || "up"
    const dur = o.dur ?? 0.42
    const each = o.each ?? 0.08
    const n = colors.length
    const prop = dir === "up" || dir === "down" ? "yPercent" : "xPercent"
    const s = dir === "up" || dir === "left" ? 1 : -1
    const mid = at + dur + each * (n - 1)
    const hold = o.hold ?? 0.06
    const els = colors.map((c, i) => {
      const el = h("div", { class: "panel", style: { background: c } }, v.over)
      v.tl.set(el, { [prop]: s * 101 }, 0)
      v.tl.to(el, { [prop]: 0, duration: dur, ease: "power3.inOut" }, at + i * each)
      v.tl.to(el, { [prop]: -s * 101, duration: dur, ease: "power3.inOut" }, mid + hold + i * each)
      return el
    })
    if (o.text) {
      const t = h("div", { class: "panel-text", style: { color: o.textColor || "var(--ground)" } }, els[n - 1], o.text)
      v.tl.fromTo(t, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.3, immediateRender: false }, at + dur * 0.6 + each * (n - 1))
    }
    v.sfx("whoosh", at + dur * 0.5, { dur: 0.5, gain: -2 })
    return { mid, end: mid + hold + dur + each * (n - 1), els }
  }

  /**
   * 3 · Zoom through: the camera dives into a point of the old shot (a button,
   * a row, a letter) and the new shot opens from slightly too close.
   * Returns the time to show the new shot.
   */
  function zoomThrough(v, A, B, at, x, y, o = {}) {
    const dur = o.dur ?? 0.5
    A.P.move(at, dur, A.P.aim(x, y, o.zoom ?? 7), { ease: "power3.in" })
    v.tl.to(A.S, { autoAlpha: 0, duration: 0.12, ease: "none" }, at + dur - 0.12)
    show(v, B.S, at + dur - 0.06)
    B.P.move(at + dur - 0.06, o.land ?? 0.8, { zoom: 1 }, { from: { zoom: o.fromZoom ?? 1.35 }, ease: "out" })
    v.sfx("whoosh", at + dur * 0.6, { dur: 0.5, pitch: 1.25 })
    return at + dur
  }

  /** 4 · Cut: a hard cut, with an optional 2-frame flash in a colour. */
  function cut(v, A, B, at, o = {}) {
    hide(v, A.S, at)
    show(v, B.S, at)
    if (o.flash) {
      const f = document.getElementById("flash")
      v.tl.set(f, { background: o.flash, opacity: o.strength ?? 1 }, at)
      v.tl.set(f, { opacity: 0 }, at + (o.frames ?? 2) / v.fps)
    }
    if (o.sfx !== false) v.sfx(o.sound || "hit", at, { gain: o.gain ?? -4 })
    return at
  }

  /** Match cut helper: an element flies from one stage box to another. */
  function fly(v, el, at, from, to, o = {}) {
    v.tl.fromTo(el, { x: from.x, y: from.y, scale: from.s ?? 1 }, { x: to.x, y: to.y, scale: to.s ?? 1, duration: o.dur ?? 0.7, ease: o.ease || "inout", immediateRender: false }, at)
    v.sfx("swish", at + 0.1, { gain: -6 })
  }

  // ──────────────────────────────────────────────── voice + captions ──

  /**
   * The voice-over's word times (vo/words.js, written by scripts/voice.sh):
   *   const vo = Kit.vo(v); vo.at("Meet"); vo.at("the", 2); vo.end("today")
   * A word that is not in the recording throws, so a new take can't silently desync.
   */
  function vo(v, list) {
    const words = list || window.VO_WORDS || []
    const n = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}%']/gu, "")
    const find = (word, nth = 1) => {
      let c = 0
      for (const w of words) if (n(w.w) === n(word) && ++c === nth) return w
      throw new Error(`Kit.vo: "${word}" (#${nth}) is not in the voice-over. Words: ${words.map((w) => w.w).join(" ") || "none (run scripts/voice.sh)"}`)
    }
    return { words, at: (w, nth = 1, d = 0) => find(w, nth).s + d, end: (w, nth = 1, d = 0) => find(w, nth).e + d, has: (w) => words.some((x) => n(x.w) === n(w)) }
  }

  /**
   * On-screen captions from the voice-over words: a few words at a time, the
   * spoken word highlighted. o: { words, y, maxWords: 3, cls, from, to } → el
   */
  function captions(v, parent, o = {}) {
    const words = o.words || window.VO_WORDS || []
    const max = o.maxWords ?? 3
    const chunks = []
    let cur = []
    for (const w of words) {
      cur.push(w)
      if (cur.length >= max || /[.,!?;:]$/.test(w.w)) {
        chunks.push(cur)
        cur = []
      }
    }
    if (cur.length) chunks.push(cur)
    const el = h("div", { class: `captions ${o.cls || ""}`, style: { top: `${o.y ?? v.safe.b - 140 * v.k}px` } }, parent)
    const rows = chunks.map((c) => {
      const row = h("div", { class: "cap-row" }, el)
      return { c, row, spans: c.map((w) => h("span", { class: "cap-w" }, row, w.w.replace(/[,;:]$/, ""))) }
    })
    v.onFrame((t) => {
      const inRange = (o.from === undefined || t >= o.from) && (o.to === undefined || t < o.to)
      rows.forEach(({ c, row, spans }, i) => {
        const next = rows[i + 1]
        const on = inRange && t >= c[0].s - 0.05 && (next ? t < next.c[0].s - 0.05 : t < c[c.length - 1].e + 0.6)
        row.style.display = on ? "" : "none"
        if (on) spans.forEach((sp, j) => sp.classList.toggle("on", t >= c[j].s - 0.03))
      })
    })
    return el
  }

  // ─────────────────────────────────────────────────────── icons ──

  const circle = (cx, cy, rr) => `M${cx - rr},${cy}a${rr},${rr} 0 1 0 ${rr * 2},0a${rr},${rr} 0 1 0 ${-rr * 2},0Z`
  /** A small line-icon set on a 24-unit grid (drawn for this kit). */
  const ICONS = {
    check: "M5,12.5 L10,17.5 L19,7",
    arrow: "M4.5,12 H19 M13.5,6.5 L19,12 L13.5,17.5",
    up: "M12,19 V5.5 M6.5,11 L12,5.5 L17.5,11",
    down: "M12,5 V18.5 M6.5,13 L12,18.5 L17.5,13",
    search: `${circle(10.5, 10.5, 6.5)} M15.5,15.5 L20,20`,
    spark: "M12,3 L13.8,10.2 L21,12 L13.8,13.8 L12,21 L10.2,13.8 L3,12 L10.2,10.2 Z",
    bolt: "M13.5,2.5 L5.5,13.5 H11.5 L10.5,21.5 L18.5,10.5 H12.5 Z",
    bell: "M6,17 V11 A6,6 0 0 1 18,11 V17 L19.5,18.5 H4.5 Z M10,21 H14",
    chart: "M4,4 V20 H20 M7.5,15 L11,11 L14,13.5 L19,8",
    grid: "M4,4 H10 V10 H4 Z M14,4 H20 V10 H14 Z M4,14 H10 V20 H4 Z M14,14 H20 V20 H14 Z",
    users: `${circle(9, 8.5, 3.5)} M2.5,20 A6.5,6.5 0 0 1 15.5,20 M16,5.2 A3.4,3.4 0 0 1 16,11.8 M18,14.5 A6,6 0 0 1 21.5,20`,
    clock: `${circle(12, 12, 8.5)} M12,7.5 V12 L15,14`,
    plus: "M12,5 V19 M5,12 H19",
    home: "M4,11 L12,4 L20,11 V20 H4 Z M10,20 V14 H14 V20",
    inbox: "M4,13 L6.5,5 H17.5 L20,13 V19 H4 Z M4,13 H9 L10,15.5 H14 L15,13 H20",
    card: "M3,6.5 H21 V18 H3 Z M3,10 H21 M6.5,14.5 H10",
    lock: "M6,11 H18 V20 H6 Z M8.5,11 V8 A3.5,3.5 0 0 1 15.5,8 V11",
    globe: `${circle(12, 12, 8.5)} M3.5,12 H20.5 M12,3.5 C8,8 8,16 12,20.5 C16,16 16,8 12,3.5`,
    settings: `${circle(12, 12, 3)} M12,3 V5.5 M12,18.5 V21 M3,12 H5.5 M18.5,12 H21 M5.6,5.6 L7.4,7.4 M16.6,16.6 L18.4,18.4 M5.6,18.4 L7.4,16.6 M16.6,7.4 L18.4,5.6`,
    send: "M4,12 L20,4.5 L16,20 L11.5,13.5 Z M11.5,13.5 L20,4.5",
    play: "M8,5 L19,12 L8,19 Z",
    star: "M12,3.5 L14.6,9 L20.5,9.6 L16,13.6 L17.3,19.5 L12,16.5 L6.7,19.5 L8,13.6 L3.5,9.6 L9.4,9 Z",
  }
  /** An icon as an inline <svg> string, for HTML: Kit.icon("check", 24, "currentColor"). */
  function icon(name, size = 24, color = "currentColor", stroke = 2) {
    const d = ICONS[name] || name
    return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }

  // ───────────────────────────────────────────────────────── start ──

  function runFrameFns(v, t) {
    let waits = null
    for (const fn of v.frameFns) {
      const r = fn(t)
      if (r && typeof r.then === "function") (waits ||= []).push(r)
    }
    return waits ? Promise.all(waits) : undefined
  }

  /** ?guides=1: the safe box and the platform's UI areas, for checking layouts. */
  function guides(v) {
    const g = v.svg(v.over)
    for (const z of v.ui) h("rect", { x: z.x, y: z.y, width: z.w, height: z.h, fill: "rgba(255,0,80,0.22)", stroke: "rgb(255,0,80)", "stroke-dasharray": "10 8", "stroke-width": 3 }, g)
    const s = v.safe
    h("rect", { x: s.x, y: s.y, width: s.w, height: s.h, fill: "none", stroke: "rgb(0,200,255)", "stroke-width": 3 }, g)
  }

  /** Build the video once fonts are loaded, then hand window.__video to the renderer. */
  function start(cfg, build) {
    const go = async () => {
      if (document.fonts) {
        await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})))
        await document.fonts.ready
      }
      const v = create(cfg)
      build(v)
      while (v.pending.length) await Promise.all(v.pending.splice(0))
      v.tl.set({}, {}, cfg.duration)
      // a fresh paused timeline does not apply its sets at 0 until it has
      // moved: step forward a hair and back so frame 0 is fully drawn
      v.tl.time(1e-4).time(0)
      await runFrameFns(v, 0)
      if (/[?&]guides=1/.test(location.search)) guides(v)
      window.__video = {
        duration: cfg.duration,
        fps: cfg.fps || 30,
        width: cfg.width,
        height: cfg.height,
        audio: cfg.audio,
        cues: v.cues.slice().sort((a, b) => a.at - b.at),
        seek(t) {
          v.tl.seek(t, false)
          return runFrameFns(v, t)
        },
        setFps(f) {
          v.fps = f
        },
        ready: true,
      }
    }
    go().catch((e) => {
      console.error(e && e.stack ? e.stack : String(e))
      throw e
    })
  }

  window.Kit = {
    start, seeded, h, FORMATS,
    show, hide, planes, shot,
    title, reveal, unreveal, sayWords, mark, count, typeOn, measure, fit,
    card, enter, kpis, table, lineChart, bars, cursor, float, image, box, smooth, hideUntil,
    push, panels, zoomThrough, cut, fly,
    vo, captions, finish,
    ICONS, icon,
    /** A look registers itself: Kit.look("clean", { init(v) { … return api } }). */
    looks: {},
    look(name, def) {
      window.Kit.looks[name] = def
    },
    /** The look's helpers for this video (built once per video). */
    use(v, name) {
      const def = window.Kit.looks[name]
      if (!def) throw new Error(`Kit.use: there is no look called "${name}" (have: ${Object.keys(window.Kit.looks).join(", ")})`)
      if (!v.looks[name]) v.looks[name] = def.init(v)
      return v.looks[name]
    },
  }
})()
