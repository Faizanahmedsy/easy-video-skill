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
  CE.create("rise", "0.2,1,0.24,1") // masked type: quick out of the mask, a long calm settle
  CE.create("land", "M0,0 C0.12,0.7 0.22,1.12 0.4,1.06 0.56,1.01 0.7,0.995 1,1") // arrive, overshoot a hair, rest
  CE.create("glide", "0.7,0,0.2,1") // camera: slow start, long glide
  CE.create("whip", "0.86,0,0.1,1") // whip pans: nearly all the motion in the middle

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
    // Two different `set`s on the same property of the same element at 0 s: on the
    // first frame either one can win (a scene that never shows, a card that is
    // visible before its entrance). Recorded here; the check lists them.
    const warnings = []
    const atZero = new WeakMap()
    const SKIP_KEYS = /^(immediateRender|overwrite|ease|duration|delay|stagger|onComplete|onUpdate|onStart|callbackScope)$/
    const nameOf = (el) => {
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30)
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : ""
      return txt ? `"${txt}"` : cls ? `a .${cls} element` : `a <${(el.tagName || "?").toLowerCase()}> element`
    }
    const watchZero = (targets, vars) => {
      for (const el of G.utils.toArray(targets)) {
        if (!(el instanceof Element)) continue
        const seen = atZero.get(el) || {}
        for (const [key, val] of Object.entries(vars || {})) {
          if (SKIP_KEYS.test(key) || typeof val === "function" || (val && typeof val === "object")) continue
          const s = String(val)
          if (key in seen && seen[key] !== s) warnings.push(`${nameOf(el)} is set twice at 0 s ("${key}": ${seen[key]} and ${s})`)
          seen[key] = s
        }
        atZero.set(el, seen)
      }
    }
    for (const [m, i] of [["to", 2], ["from", 2], ["fromTo", 3], ["set", 2], ["add", 1], ["call", 2]]) {
      const orig = tl[m].bind(tl)
      tl[m] = (...a) => {
        if (typeof a[i] === "number" && a[i] < 0) {
          if (!warned) console.warn(`kit: something was placed at ${a[i].toFixed(2)} s; moved to 0`)
          warned = true
          a[i] = 0
        }
        if (m === "set" && a[i] === 0) watchZero(a[0], a[1])
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
      busy: [],
      warnings,
      looks: {},
    }
    /** Mark a time span the layout check should skip (a transition, an intended overlap). */
    v.quiet = (from, to) => {
      v.busy.push([Math.max(0, from), to])
      return v
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
   * The ground behind every scene (outside the camera). One word or several,
   * e.g. backdrop: "glow dots":
   *   "glow"  soft coloured light that drifts slowly (colours --glow-1 … --glow-4 from the look)
   *   "dots"  a faint dot grid
   *   "grid"  a fine drafting grid that creeps, with a soft spotlight
   *   "spot"  one large spotlight that drifts (for dark grounds)
   *   "none"  just the ground colour (--ground)
   */
  function backdrop(v, kinds = "none") {
    const bd = document.querySelector("#stage .backdrop")
    const { W, H, k, tl, cfg } = v
    const dur = cfg.duration
    const list = String(kinds || "none").split(/[\s,+]+/)
    if (list.includes("glow")) glowField(v, bd)
    if (list.includes("dots")) {
      const step = 46 * k
      let d = ""
      for (let x = step / 2; x < W; x += step) for (let y = step / 2; y < H; y += step) d += `M${x.toFixed(1)},${y.toFixed(1)}h0.01`
      const svg = h("svg", { class: "stage-svg dots", viewBox: `0 0 ${W} ${H}` }, bd)
      h("path", { d, class: "dot-grid", fill: "none", "stroke-width": 3.2 * k, "stroke-linecap": "round" }, svg)
    }
    for (const kind of list) backdropOld(v, bd, kind, W, H, k, tl, dur)
  }

  /**
   * Large soft pools of coloured light, each drifting and breathing on its own
   * slow sine, so the ground has depth and is never dead. Colours come from the
   * look as --glow-1 … --glow-4 (a project can change them with `palette`).
   */
  function glowField(v, bd) {
    const { W, H, tl, cfg } = v
    const pools = [
      { x: 0.78, y: 0.12, s: 0.95, c: 1, dx: -9, dy: 7, p: 11 },
      { x: 0.12, y: 0.86, s: 0.9, c: 2, dx: 10, dy: -8, p: 13 },
      { x: 0.08, y: 0.08, s: 0.62, c: 3, dx: 8, dy: 9, p: 9 },
      { x: 0.92, y: 0.9, s: 0.7, c: 4, dx: -8, dy: -7, p: 10 },
      { x: 0.5, y: 0.5, s: 0.55, c: 1, dx: 6, dy: -5, p: 8, a: 0.4 },
    ]
    const big = Math.max(W, H)
    pools.forEach((pl) => {
      const s = pl.s * big
      const el = h("div", {
        class: "glow-pool",
        style: { left: `${pl.x * W - s / 2}px`, top: `${pl.y * H - s / 2}px`, width: `${s}px`, height: `${s}px`, background: `radial-gradient(closest-side, var(--glow-${pl.c}) 0%, transparent 100%)`, opacity: String(pl.a ?? 1) },
      }, bd)
      tl.add(G.fromTo(el, { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: pl.dx, yPercent: pl.dy, scale: 1.1, duration: pl.p, repeat: Math.ceil(cfg.duration / pl.p), yoyo: true, ease: "sine.inOut", immediateRender: true }), 0)
    })
  }

  function backdropOld(v, bd, kind, W, H, k, tl, dur) {
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

  /**
   * Film finish over the whole frame: fine frame-locked grain, a soft vignette
   * and, optionally, slow light washes that drift across (leaks).
   * o: { grain: 0.06, vignette: 0.25, tint: "rgb(…)" (vignette colour),
   *      leaks: [{ color, x, y, size }] , blend }
   */
  function finish(v, o = {}) {
    const vig = document.getElementById("vignette")
    vig.style.opacity = String(o.vignette ?? 0.25)
    if (o.tint) vig.style.background = `radial-gradient(ellipse 78% 72% at 50% 46%, transparent 50%, ${o.tint} 130%)`
    ;(o.leaks || []).forEach((lk, i) => {
      const s = (lk.size ?? 0.9) * Math.max(v.W, v.H)
      const el = h("div", { class: "leak", style: { left: `${(lk.x ?? 0.5) * v.W - s / 2}px`, top: `${(lk.y ?? 0.5) * v.H - s / 2}px`, width: `${s}px`, height: `${s}px`, background: `radial-gradient(closest-side, ${lk.color}, transparent)`, mixBlendMode: lk.blend || o.blend || "soft-light" } }, v.over)
      const p = 9 + i * 3.5
      v.tl.add(G.fromTo(el, { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: i % 2 ? 16 : -14, yPercent: i % 2 ? -9 : 11, scale: 1.16, duration: p, repeat: Math.ceil(v.cfg.duration / p), yoyo: true, ease: "sine.inOut", immediateRender: true }), 0)
    })
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
      const on = ((f % 4) + 4) % 4
      tiles.forEach((el, i) => (el.style.visibility = i === on ? "visible" : "hidden"))
      const r = seeded(f * 7919 + 5)
      tiles[on].style.backgroundPosition = `${Math.floor(r() * size)}px ${Math.floor(r() * size)}px`
    })
  }

  /**
   * Soft out-of-focus discs that drift and breathe, for depth. Put small faint
   * ones in a back plane and a few big soft ones in a front plane.
   * o: { count, size: [min, max], opacity: [min, max], colors, soft (0–1), seed, area: { x, y, w, h } }
   */
  function bokeh(v, parent, o = {}) {
    const rnd = seeded(o.seed ?? 21)
    const area = o.area || { x: 0, y: 0, w: v.W, h: v.H }
    const [s0, s1] = (o.size || [24, 110]).map((s) => s * v.k)
    const [a0, a1] = o.opacity || [0.2, 0.55]
    const colors = o.colors || ["#fff", "var(--glow-1)", "var(--glow-2)"]
    const soft = o.soft ?? 0.4
    const els = []
    for (let i = 0; i < (o.count ?? 10); i++) {
      const s = s0 + rnd() * (s1 - s0)
      const c = colors[Math.floor(rnd() * colors.length)]
      const core = Math.round((1 - soft) * 62)
      const el = h("div", {
        class: "bokeh",
        style: { left: `${area.x + rnd() * area.w - s / 2}px`, top: `${area.y + rnd() * area.h - s / 2}px`, width: `${s}px`, height: `${s}px`, background: `radial-gradient(closest-side, ${c} ${core}%, transparent 100%)`, opacity: String(a0 + rnd() * (a1 - a0)) },
      }, parent)
      const p = 3.2 + rnd() * 4
      v.tl.add(G.fromTo(el, { x: 0, y: 0, scale: 1 }, { x: (rnd() - 0.5) * 70 * v.k, y: (rnd() - 0.5) * 60 * v.k, scale: 0.85 + rnd() * 0.3, duration: p, repeat: Math.ceil(v.cfg.duration / p), yoyo: true, ease: "sine.inOut", immediateRender: true }), 0)
      els.push(el)
    }
    return els
  }

  /** A band of light that sweeps across the whole frame (on a reveal). o: { color, angle, dur, opacity } */
  function leak(v, at, o = {}) {
    const el = h("div", { class: "sweep", style: { background: `linear-gradient(${o.angle ?? 105}deg, transparent 30%, ${o.color || "rgba(255,255,255,0.55)"} 50%, transparent 70%)`, mixBlendMode: o.blend || "soft-light" } }, v.over)
    const dur = o.dur ?? 1.2
    v.tl.set(el, { autoAlpha: 0 }, 0)
    v.tl.fromTo(el, { xPercent: -80, autoAlpha: o.opacity ?? 1 }, { xPercent: 80, duration: dur, ease: "sine.inOut", immediateRender: false }, at)
    v.tl.set(el, { autoAlpha: 0 }, at + dur)
    return at + dur
  }

  /** A glossy highlight that sweeps across one element (a card, a button, a phone). o: { color, angle, dur } */
  function sheen(v, el, at, o = {}) {
    const wrap = h("div", { class: "sheen" }, el)
    const band = h("i", { style: { background: `linear-gradient(${o.angle ?? 110}deg, transparent 30%, ${o.color || "rgba(255,255,255,0.7)"} 50%, transparent 70%)` } }, wrap)
    v.tl.set(band, { xPercent: -160 }, 0)
    v.tl.to(band, { xPercent: 160, duration: o.dur ?? 0.9, ease: o.ease || "power2.inOut" }, at)
    return at + (o.dur ?? 0.9)
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
   *   P.path([{ t: 0 }, { t: 2, zoom: 1.06 }, { t: 5, ...P.aim(400, 500, 1.1) }])
   *                      one smooth camera through key poses, with no stop between them
   *
   * A shot has ONE camera track. Every move and path goes on it in time order,
   * and each one ends where the next begins, so two moves can never fight over
   * the camera (that snaps it back the moment one of them ends, and motion blur
   * shows the whole picture twice). A move without `from` starts exactly where
   * the camera is. The camera is worked out from the time alone on every
   * frame, so it is the same in any render order.
   */
  function planes(v, scene, depths = { bg: 0.35, mid: 0.75, fg: 1.3 }) {
    const P = { list: [] }
    for (const [name, depth] of Object.entries(depths)) {
      const el = h("div", { class: `plane plane-${name}` }, scene)
      const pl = { name, el, depth, g: v.svg(el) }
      P[name] = pl
      P.list.push(pl)
    }
    const KEYS = ["x", "y", "zoom", "rotate"]
    const NEUTRAL = { x: 0, y: 0, zoom: 1, rotate: 0 }
    const full = (o) => Object.assign({}, NEUTRAL, o)
    const state = (o, d) => ({ x: o.x * d, y: o.y * d, scale: 1 + (o.zoom - 1) * d, rotation: o.rotate * d })
    P.aim = (fx, fy, zoom, extra = {}) => Object.assign({ x: (v.W / 2 - fx) * (zoom - 1), y: (v.H / 2 - fy) * (zoom - 1), zoom }, extra)

    const segs = []
    let ready = false
    P.move = (at, dur, to = {}, o = {}) => {
      segs.push({ at, end: at + Math.max(dur, 1e-4), to: full(to), given: o.from ? full(o.from) : null, ease: G.parseEase(o.ease || "sine.inOut"), n: segs.length })
      ready = false
      return P
    }
    /**
     * One smooth camera through key poses: [{ t, x, y, zoom, rotate }, …] (a key
     * may spread P.aim(…)). Missing values repeat the key before; a first key
     * with only `t` starts from wherever the camera is then. The speed changes
     * smoothly through every key (monotone cubic Hermite: no overshoot, no
     * stop-and-go) and is zero only at the first and last key.
     */
    P.path = (keys) => {
      if (!Array.isArray(keys) || keys.length < 2) throw new Error("P.path needs two keys or more: [{ t: 0 }, { t: 2, zoom: 1.05 }]")
      const ks = keys.map((k) => (Array.isArray(k) ? Object.assign({ t: k[0] }, k[1]) : Object.assign({}, k))).sort((a, b) => a.t - b.t)
      segs.push({ at: ks[0].t, end: ks[ks.length - 1].t, raw: ks, n: segs.length })
      ready = false
      return P
    }
    // monotone cubic Hermite through (t, value) keys: harmonic-mean tangents, flat at turning points
    const hermite = (ks, t) => {
      const n = ks.length
      let i = 0
      while (i < n - 2 && t > ks[i + 1].t) i++
      const a = ks[i]
      const b = ks[i + 1]
      const span = b.t - a.t || 1e-6
      const u = Math.max(0, Math.min(1, (t - a.t) / span))
      const u2 = u * u
      const u3 = u2 * u
      const out = {}
      for (const c of KEYS) {
        const tan = (j) => {
          if (j === 0 || j === n - 1) return 0
          const s0 = (ks[j][c] - ks[j - 1][c]) / (ks[j].t - ks[j - 1].t || 1e-6)
          const s1 = (ks[j + 1][c] - ks[j][c]) / (ks[j + 1].t - ks[j].t || 1e-6)
          return s0 * s1 <= 0 ? 0 : (2 * s0 * s1) / (s0 + s1)
        }
        out[c] = (2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * span * tan(i) + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * span * tan(i + 1)
      }
      return out
    }
    // a segment's pose at time t (held at its start before it, at its end after it)
    const segAt = (s, t) => {
      if (s.raw) return hermite(s.keys, Math.max(s.at, Math.min(s.end, t)))
      const p = s.ease(Math.max(0, Math.min(1, (t - s.at) / (s.end - s.at))))
      const out = {}
      for (const c of KEYS) out[c] = s.from[c] + (s.to[c] - s.from[c]) * p
      return out
    }
    // put the track in time order and give every segment its start pose (where the camera is then)
    const settle = () => {
      segs.sort((a, b) => a.at - b.at || a.n - b.n)
      segs.forEach((s, i) => {
        const prev = i > 0 ? segAt(segs[i - 1], s.at) : NEUTRAL
        if (s.raw) {
          let last = prev
          s.keys = s.raw.map((k) => (last = Object.assign({}, last, k)))
        } else s.from = s.given || prev
      })
      ready = true
    }
    /** The camera pose at time t: { x, y, zoom, rotate }. */
    P.at = (t) => {
      if (!segs.length) return NEUTRAL
      if (!ready) settle()
      let i = 0
      while (i < segs.length - 1 && segs[i + 1].at <= t) i++
      return segAt(segs[i], t)
    }
    let shown = ""
    v.onFrame((t) => {
      if (!segs.length) return
      const p = P.at(t)
      const key = KEYS.map((c) => p[c].toFixed(4)).join(",")
      if (key === shown) return
      shown = key
      for (const pl of P.list) G.set(pl.el, state(p, pl.depth))
    })
    /**
     * The slow camera every shot should have: a gentle drift sideways and a
     * small push in, near planes moving more (parallax). o: { x: -36, y: 0, zoom: 1.05, from: { x: 24 } }
     */
    P.drift = (at, dur, o = {}) => P.move(at, dur, { x: o.x ?? -36 * v.k, y: o.y ?? 0, zoom: o.zoom ?? 1.05, rotate: o.rotate ?? 0 }, { from: Object.assign({ x: 24 * v.k, zoom: 1 }, o.from), ease: o.ease || "power1.inOut" })
    return P
  }

  /** A scene with depth planes in one call: const A = Kit.shot(v, "intro") → { S, P }. */
  function shot(v, name, depths) {
    const S = v.scene(name)
    return { S, P: planes(v, S, depths) }
  }

  /**
   * Turn a flat element in 3D space (a window, a card, a phone), with perspective.
   * Kit.tilt(v, el, at, dur, { rx: 0, ry: 0, rz: 0 }, { from: { rx: 24, ry: -18 }, ease, depth })
   */
  function tilt(v, el, at, dur, to = {}, o = {}) {
    const st = (q) => ({ rotationX: q.rx ?? 0, rotationY: q.ry ?? 0, rotationZ: q.rz ?? 0, z: q.z ?? 0 })
    G.set(el, { transformPerspective: o.depth ?? 2400 * v.k, transformOrigin: o.origin || "50% 50%" })
    if (o.from) v.tl.set(el, st(o.from), at)
    v.tl.to(el, Object.assign(st(to), { duration: dur, ease: o.ease || "glide" }), at)
    return at + dur
  }

  /**
   * Rack focus: blur an element (usually a plane: A.P.bg.el) in or out, like a
   * camera lens. Kit.focus(v, A.P.bg.el, at, { blur: 10, dur: 0.6 }); blur 0 = sharp.
   */
  function focus(v, el, at, o = {}) {
    const to = o.blur ?? 0
    const from = o.from ?? (to > 0 ? 0 : 10)
    const vars = { filter: `blur(${to * v.k}px)`, duration: o.dur ?? 0.6, ease: o.ease || "power2.inOut", immediateRender: at <= 0 }
    v.tl.fromTo(el, { filter: `blur(${from * v.k}px)` }, vars, at)
    if (to === 0) v.tl.set(el, { filter: "none" }, at + vars.duration)
    return at + vars.duration
  }

  // ──────────────────────────────────────────────────────────── text ──

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  /** "|" breaks a line, *word* marks the highlight (class "em"), ^word^ a lighter, quieter word (class "lite"). */
  function markup(str) {
    return str
      .split("|")
      .map((line) =>
        esc(line.trim())
          .replace(/\*([^*]+)\*/g, '<span class="em">$1</span>')
          .replace(/\^([^^]+)\^/g, '<span class="lite">$1</span>'),
      )
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
    const pick = (c) => [...el.querySelectorAll(c)].filter((e) => e.textContent.trim())
    return { el, split, lines: split.lines, words: split.words, chars: split.chars, em: pick(".em"), lite: pick(".lite") }
  }

  /**
   * Masked entrance: lines / words / chars rise out of their line masks. Returns the end time.
   * o: { by: "lines" | "words" | "chars", each, dur, ease, from: "above", fade, rotate (deg, a small tip-in), blur (px, words come into focus) }
   */
  function reveal(v, t, at, o = {}) {
    const by = o.by || "lines"
    const targets = o.targets || t[by]
    const each = o.each ?? { lines: 0.1, words: 0.06, chars: 0.022 }[by]
    const dur = o.dur ?? (by === "chars" ? 0.7 : 0.9)
    const dir = o.from === "above" ? -1 : 1
    const a = { yPercent: dir * (o.distance ?? 115), rotation: o.rotate ?? 0, transformOrigin: "0% 100%", autoAlpha: o.fade ? 0 : 1 }
    const b = { yPercent: 0, rotation: 0, autoAlpha: 1, duration: dur, ease: o.ease || "rise", stagger: each, immediateRender: true }
    if (o.blur) {
      a.filter = `blur(${o.blur}px)`
      b.filter = "blur(0px)"
    }
    v.tl.fromTo(targets, a, b, at)
    return at + (targets.length - 1) * each + dur
  }
  /** Letter-spacing eases from wide to tight (a title settling): o: { from: "0.3em", to: "-0.02em", dur } */
  function tracking(v, el, at, o = {}) {
    v.tl.fromTo(el, { letterSpacing: o.from ?? "0.3em" }, { letterSpacing: o.to ?? "-0.02em", duration: o.dur ?? 1.2, ease: o.ease || "out", immediateRender: at <= 0 }, at)
    return at + (o.dur ?? 1.2)
  }
  /** Font weight eases from → to (variable fonts: Outfit, DM Sans, Archivo). o: { from: 200, to: 800, dur } */
  function weight(v, els, at, o = {}) {
    v.tl.fromTo(els, { fontWeight: o.from ?? 200 }, { fontWeight: o.to ?? 800, duration: o.dur ?? 0.8, ease: o.ease || "power2.inOut", immediateRender: at <= 0 }, at)
    return at + (o.dur ?? 0.8)
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

  /**
   * A number that rolls into place digit by digit, like a counter on a board.
   * Kit.roll(v, el, "1,284", at, { dur: 1.1, each: 0.06 }): el's text becomes the
   * columns; non-digits (",", "%", "$", "h") stay still. Returns the end time.
   */
  function roll(v, el, str, at, o = {}) {
    el.textContent = ""
    el.classList.add("roll")
    el.dataset.text = String(str)
    const chars = [...String(str)]
    const digits = chars.filter((c) => /\d/.test(c)).length
    let di = 0
    const dur = o.dur ?? 1.1
    const each = o.each ?? 0.06
    chars.forEach((c) => {
      if (!/\d/.test(c)) {
        h("span", { class: "roll-fix" }, el, c)
        return
      }
      const n = Number(c)
      const col = h("span", { class: "roll-col" }, el)
      h("span", { class: "roll-sizer" }, col, "0")
      const strip = h("span", { class: "roll-strip" }, col)
      const loops = o.loops ?? 1
      const seq = []
      for (let l = 0; l < loops; l++) for (let d = 0; d < 10; d++) seq.push(d)
      for (let d = 0; d <= n; d++) seq.push(d)
      seq.forEach((d) => h("span", {}, strip, String(d)))
      const end = -(seq.length - 1) / seq.length * 100
      // the right-most digit spins the longest, like a real counter
      v.tl.fromTo(strip, { yPercent: 0 }, { yPercent: end, duration: dur + di * each, ease: o.ease || "power3.out", immediateRender: true }, at)
      di++
    })
    return at + dur + (digits - 1) * each
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

  // ───────────────────────────────────────────────────────── scenery ──

  /**
   * A full-scene background inside one plane (usually A.P.bg), drawn larger
   * than the frame so camera moves and parallax never show its edges. Seeded
   * and on the timeline, like everything else. Colours come from the look.
   *   "studio"  a seamless photo-studio wall curving into the floor, a soft key light that drifts
   *   "rays"    soft beams of light fanning down from above, turning slowly, with dust rising through them
   *   "stars"   a deep field of small lights in two layers drifting past, a few of them twinkling
   * Kit.scenery(v, A.P.bg, "rays", { from: 0, to: 4, x, y, seed }) → { el }
   */
  function scenery(v, plane, kind, o = {}) {
    const { W, H, k } = v
    const bleed = 0.22
    const X0 = -W * bleed
    const Y0 = -H * bleed
    const BW = W * (1 + 2 * bleed)
    const BH = H * (1 + 2 * bleed)
    const from = o.from ?? 0
    const span = (o.to ?? v.cfg.duration) - from
    const rnd = seeded(o.seed ?? 31)
    const el = h("div", { class: `scenery scenery-${kind}` }, plane.el)
    plane.el.insertBefore(el, plane.el.firstChild)
    const svg = h("svg", { class: "stage-svg", viewBox: `0 0 ${W} ${H}` }, el)
    const g = h("g", {}, svg)
    const id = v.uid("sc")
    const grad = (stops, x2 = 0, y2 = 1, radial = false) => {
      const gid = v.uid(id)
      const gr = radial ? h("radialGradient", { id: gid }, v.defs) : h("linearGradient", { id: gid, x1: 0, y1: 0, x2, y2 }, v.defs)
      // colours go in style, not attributes, so CSS variables work
      stops.forEach(([off, col, op]) => h("stop", { offset: off, style: { stopColor: col, stopOpacity: String(op ?? 1) } }, gr))
      return `url(#${gid})`
    }
    if (kind === "studio") {
      const hz = o.y ?? H * 0.68
      h("rect", { x: X0, y: Y0, width: BW, height: BH, fill: grad([[0, "var(--ground)"], [0.62, "var(--card)"], [1, "var(--ground)"]]) }, g)
      // the curve where the wall becomes the floor
      h("path", { d: `M${X0},${hz} C${W * 0.3},${hz + 40 * k} ${W * 0.7},${hz + 40 * k} ${X0 + BW},${hz} V${Y0 + BH} H${X0} Z`, fill: grad([[0, "var(--card)", 0.9], [1, "var(--ground)", 1]]) }, g)
      h("ellipse", { cx: o.x ?? W / 2, cy: hz + 70 * k, rx: W * 0.32, ry: 46 * k, fill: grad([[0, "rgba(11,16,32,0.16)"], [1, "rgba(11,16,32,0)"]], 0, 0, true) }, g)
      const key = h("ellipse", { cx: o.x ?? W / 2, cy: H * 0.32, rx: W * 0.5, ry: H * 0.48, fill: grad([[0, "var(--glow-1)"], [1, "var(--glow-1)", 0]], 0, 0, true) }, g)
      v.tl.fromTo(key, { x: -W * 0.06 }, { x: W * 0.06, duration: span, ease: "sine.inOut", immediateRender: from <= 0 }, from)
    } else if (kind === "rays") {
      const cx = o.x ?? W * 0.5
      const cy = o.y ?? -H * 0.25
      const fan = h("g", {}, g)
      const n = o.count ?? 9
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 - 0.9 + (1.8 * (i + rnd() * 0.6)) / n
        const len = Math.hypot(W, H) * 1.3
        const wd = (0.04 + rnd() * 0.06) * len
        const ax = cx + Math.cos(-a) * len
        const ay = cy + Math.sin(-a) * len
        const nx = Math.cos(-a + Math.PI / 2) * wd
        const ny = Math.sin(-a + Math.PI / 2) * wd
        const ray = h("path", { d: `M${cx},${cy} L${ax + nx},${ay + ny} L${ax - nx},${ay - ny} Z`, fill: grad([[0, "var(--glow-1)", 0.9], [1, "var(--glow-1)", 0]], ax - cx > 0 ? 0.3 : -0.3, 1), opacity: 0.25 + rnd() * 0.35 }, fan)
        v.tl.fromTo(ray, { opacity: 0.15 + rnd() * 0.2 }, { opacity: 0.45 + rnd() * 0.3, duration: 2.5 + rnd() * 2.5, repeat: Math.ceil(span / 2.5), yoyo: true, ease: "sine.inOut", immediateRender: from <= 0 }, from)
      }
      G.set(fan, { svgOrigin: `${cx} ${cy}` })
      v.tl.fromTo(fan, { rotation: -4 }, { rotation: 4, duration: span, ease: "sine.inOut", immediateRender: from <= 0 }, from)
      for (let i = 0; i < (o.dust ?? 26); i++) {
        const d = h("circle", { cx: X0 + rnd() * BW, cy: rnd() * H * 1.1, r: (1.5 + rnd() * 3.5) * k, fill: "#fff", opacity: 0.2 + rnd() * 0.5 }, g)
        v.tl.fromTo(d, { y: 0, x: 0 }, { y: -(80 + rnd() * 160) * k, x: (rnd() - 0.5) * 60 * k, duration: span, ease: "none", immediateRender: from <= 0 }, from)
      }
    } else if (kind === "stars") {
      for (const [layer, count, size, drift] of [[0, 70, 2.2, 30], [1, 26, 4, 80]]) {
        let d = ""
        for (let i = 0; i < count; i++) d += `M${(X0 + rnd() * BW).toFixed(1)},${(Y0 + rnd() * BH).toFixed(1)}h0.01`
        const lg = h("path", { d, fill: "none", stroke: "#fff", "stroke-width": size * k, "stroke-linecap": "round", opacity: layer ? 0.55 : 0.3 }, g)
        v.tl.fromTo(lg, { x: drift * k, y: drift * 0.4 * k }, { x: -drift * k, y: -drift * 0.4 * k, duration: span, ease: "none", immediateRender: from <= 0 }, from)
      }
      for (let i = 0; i < 10; i++) {
        const tw = h("circle", { cx: rnd() * W, cy: rnd() * H, r: (2 + rnd() * 2.5) * k, fill: "#fff" }, g)
        const p = 0.8 + rnd() * 1.4
        v.tl.fromTo(tw, { opacity: 0.1 }, { opacity: 0.9, duration: p, repeat: Math.ceil(span / p), yoyo: true, ease: "sine.inOut", immediateRender: from <= 0 }, from + rnd())
      }
    }
    return { el }
  }

  // ──────────────────────────────────────────────── cards, data, cursor ──

  /** A card (div) at a position: Kit.card(parent, { x, y, w, h, cls }). */
  function card(parent, o = {}) {
    return h("div", { class: `card ${o.cls || ""}`, style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, width: o.w ? `${o.w}px` : undefined, height: o.h ? `${o.h}px` : undefined } }, parent, o.text)
  }

  /**
   * A phone: a rounded body with a thin bezel, side keys, a camera pill and a
   * glass reflection. Build the app inside `.screen` (screen pixels, origin top-left).
   * Kit.phone(v, parent, { x, y, w }) → { el, screen, glass, w, h, sw, sh }  (h = w × 2.05)
   */
  function phone(v, parent, o = {}) {
    const w = o.w ?? 520 * v.k
    const hh = w * (o.ratio ?? 2.05)
    const el = h("div", { class: `phone ${o.cls || ""}`, style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, width: `${w}px`, height: `${hh}px` } }, parent)
    el.style.setProperty("--pw", `${w}px`)
    h("i", { class: "phone-key k1" }, el)
    h("i", { class: "phone-key k2" }, el)
    h("i", { class: "phone-key k3" }, el)
    const screen = h("div", { class: "phone-screen" }, el)
    h("div", { class: "phone-pill" }, el)
    const glass = h("div", { class: "phone-glass" }, el)
    const bez = w * 0.035
    return { el, screen, glass, w, h: hh, sw: w - bez * 2, sh: hh - bez * 2 }
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

  /**
   * A progress ring that fills: o: { cx, cy, r, w, value (0–1), at, dur, cls } → { track, arc, end }.
   * Styling: .ring-track and .ring-arc in the look's CSS (or o.color).
   */
  function ring(v, parent, o) {
    const g = h("g", { class: `ring ${o.cls || ""}` }, parent)
    const w = o.w ?? 14 * v.k
    h("circle", { cx: o.cx, cy: o.cy, r: o.r, class: "ring-track", fill: "none", "stroke-width": w }, g)
    const arc = h("circle", { cx: o.cx, cy: o.cy, r: o.r, class: "ring-arc", fill: "none", "stroke-width": w, "stroke-linecap": "round", style: { stroke: o.color }, transform: `rotate(-90 ${o.cx} ${o.cy})` }, g)
    const dur = o.dur ?? 1.2
    hideUntil(v, arc, o.at)
    v.tl.fromTo(arc, { drawSVG: "0%" }, { drawSVG: `${(o.value ?? 1) * 100}%`, duration: dur, ease: o.ease || "inout", immediateRender: false }, o.at)
    return { g, arc, end: o.at + dur }
  }

  /**
   * A donut chart whose parts draw on one after another.
   * o: { cx, cy, r, w, parts: [{ value, color }], at, dur, gap } → { g, arcs, end }
   */
  function donut(v, parent, o) {
    const g = h("g", { class: "donut" }, parent)
    const total = o.parts.reduce((s, p) => s + p.value, 0)
    const w = o.w ?? 28 * v.k
    const C = 2 * Math.PI * o.r
    const gap = (o.gap ?? 6 * v.k) / C
    const dur = o.dur ?? 1.2
    let acc = 0
    const arcs = o.parts.map((p) => {
      const share = p.value / total
      const a = h("circle", { cx: o.cx, cy: o.cy, r: o.r, fill: "none", style: { stroke: p.color }, "stroke-width": w, "stroke-linecap": "butt", transform: `rotate(-90 ${o.cx} ${o.cy})` }, g)
      const s = acc
      const e = acc + Math.max(0.001, share - gap)
      acc += share
      const t0 = o.at + dur * s
      hideUntil(v, a, t0)
      v.tl.fromTo(a, { drawSVG: `${s * 100}% ${s * 100}%` }, { drawSVG: `${s * 100}% ${e * 100}%`, duration: dur * share + 0.15, ease: "power2.out", immediateRender: false }, t0)
      return a
    })
    return { g, arcs, end: o.at + dur + 0.15 }
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
    v.quiet(at, at + dur + 0.05)
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
    v.quiet(at, mid + hold + dur + each * (n - 1))
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
    if (o.blur !== 0) focus(v, B.S, at + dur - 0.06, { from: o.blur ?? 14, blur: 0, dur: 0.45, ease: "power2.out" })
    v.quiet(at, at + dur + 0.3)
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
    v.quiet(at, at + (o.dur ?? 0.7) + 0.05)
    v.sfx("swish", at + 0.1, { gain: -6 })
  }

  /**
   * 5 · Whip pan: the old shot flies off to one side, streaked by motion blur,
   * and the new one lands from the other side. o: { dir: "left" | "right" | "up" | "down", dur }
   */
  function whip(v, A, B, at, o = {}) {
    const dur = o.dur ?? 0.5
    const dir = o.dir || "left"
    const vert = dir === "up" || dir === "down"
    const s = dir === "left" || dir === "up" ? -1 : 1
    const prop = vert ? "yPercent" : "xPercent"
    const skew = vert ? "skewY" : "skewX"
    v.tl.to(A.S, { [prop]: s * 115, [skew]: -s * (o.skew ?? 8), duration: dur * 0.55, ease: "power3.in" }, at)
    hide(v, A.S, at + dur * 0.55)
    show(v, B.S, at + dur * 0.42)
    v.tl.fromTo(B.S, { [prop]: -s * 115, [skew]: -s * (o.skew ?? 8) }, { [prop]: 0, [skew]: 0, duration: dur * 0.6, ease: "power3.out", immediateRender: false }, at + dur * 0.42)
    v.quiet(at, at + dur + 0.05)
    v.sfx("whoosh", at + dur * 0.4, { dur: 0.5, pitch: 1.1 })
    return at + dur
  }

  /**
   * 6 · Wipe: shaped colour layers cover the frame one after another, then
   * uncover it. Swap shots at the returned .mid (the frame is covered then).
   * o: { kind: "wave" | "circle" | "diagonal", colors: [..], dir: "right" | "left" | "up" | "down",
   *      x, y (circle centre), dur, lag, hold }
   */
  function wipe(v, at, o = {}) {
    const { W, H } = v
    const kind = o.kind || "wave"
    const dir = o.dir || "right"
    const colors = o.colors || ["var(--accent)", "var(--ink)"]
    const half = (o.dur ?? 0.9) / 2
    const lag = o.lag ?? 0.07
    const n = colors.length
    const mid = at + half + lag * (n - 1)
    const hold = o.hold ?? 0.04
    const svg = h("svg", { class: "stage-svg wipe", viewBox: `0 0 ${W} ${H}` }, v.over)
    const seed = v.rand() * 6
    colors.forEach((c, i) => {
      const el = h("path", { d: "", style: { fill: c } }, svg)
      const st = { p: 0 }
      v.tl.to(st, { p: 1, duration: half, ease: o.easeIn || "power2.in" }, at + i * lag)
      v.tl.to(st, { p: 2, duration: half, ease: o.easeOut || "power2.out" }, mid + hold + (n - 1 - i) * lag)
      let last = -1
      v.onFrame(() => {
        if (st.p === last) return
        last = st.p
        el.setAttribute("d", wipeShape(kind, dir, st.p, W, H, seed + i * 2.1, o))
      })
    })
    const end = mid + hold + half + lag * (n - 1)
    v.quiet(at, end)
    v.sfx("whoosh", at + half * 0.6, { dur: 0.5, gain: -3 })
    return { mid, end }
  }
  // p 0 → 1 covers the frame, 1 → 2 uncovers it (the edge keeps going the same way)
  function wipeShape(kind, dir, p, W, H, seed, o) {
    if (p <= 1e-4 || p >= 2 - 1e-4) return ""
    const covering = p <= 1
    const q = covering ? p : p - 1
    if (kind === "circle") {
      const cx = o.x ?? W / 2
      const cy = o.y ?? H / 2
      const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.08
      const R = Math.max(0.1, q * far)
      const c = `M${cx - R},${cy}a${R},${R} 0 1 0 ${R * 2},0a${R},${R} 0 1 0 ${-R * 2},0Z`
      return covering ? c : `M-10,-10H${W + 10}V${H + 10}H-10Z ${c}`
    }
    const horiz = dir === "right" || dir === "left"
    const L = horiz ? W : H // the length the edge travels
    const B = horiz ? H : W // the length of the edge
    const amp = (o.amp ?? 0.09) * L
    const slant = kind === "diagonal" ? (o.slant ?? 0.28) * L : 0
    // position of the edge along its travel, for a point b along it
    const edge = (b) => {
      const u = b / B
      if (kind === "diagonal") return -slant + q * (L + slant * 2) + (u - 0.5) * slant
      return -amp * 1.6 + q * (L + amp * 3.4) + Math.sin(u * Math.PI) * amp + Math.sin(u * 7.1 + seed + q * 3.2) * amp * 0.22
    }
    const N = kind === "diagonal" ? 1 : 24
    const pts = []
    for (let i = 0; i <= N; i++) {
      const b = -20 + ((B + 40) * i) / N
      pts.push([edge(b), b])
    }
    const map = ([l, b]) => (dir === "right" ? [l, b] : dir === "left" ? [W - l, b] : dir === "down" ? [b, l] : [b, H - l])
    const m = pts.map(map)
    const line = kind === "diagonal" ? `M${m[0][0]},${m[0][1]}L${m[1][0]},${m[1][1]}` : smooth(m)
    // close on the covered side: behind the edge while covering, ahead of it while uncovering
    const far = covering ? -60 : L + 60
    const [ax, ay] = map([far, B + 20])
    const [bx, by] = map([far, -20])
    return `${line}L${ax},${ay}L${bx},${by}Z`
  }

  /** Mask reveal on one element: Kit.clipIn(v, el, at, { from: "left" | "right" | "top" | "bottom" | "center" | "circle", dur }) */
  function clipShapes(o) {
    const from = o.from || "left"
    if (from === "circle") return [`circle(0% at ${o.x ?? "50%"} ${o.y ?? "50%"})`, `circle(${o.size ?? "150%"} at ${o.x ?? "50%"} ${o.y ?? "50%"})`]
    const z = "inset(0% 0% 0% 0% round var(--clip-r, 0px))"
    const s = { left: "inset(0% 100% 0% 0% round var(--clip-r, 0px))", right: "inset(0% 0% 0% 100% round var(--clip-r, 0px))", top: "inset(0% 0% 100% 0% round var(--clip-r, 0px))", bottom: "inset(100% 0% 0% 0% round var(--clip-r, 0px))", center: "inset(50% 50% 50% 50% round var(--clip-r, 0px))" }[from]
    return [s, z]
  }
  function clipIn(v, el, at, o = {}) {
    const [a, b] = clipShapes(o)
    const dur = o.dur ?? 0.8
    v.tl.set(el, { autoAlpha: 1 }, at)
    v.tl.fromTo(el, { clipPath: a }, { clipPath: b, duration: dur, ease: o.ease || "glide", immediateRender: at <= 0 }, at)
    v.tl.set(el, { clipPath: "none" }, at + dur)
    if (at > 0) v.tl.set(el, { autoAlpha: 0 }, 0)
    return at + dur
  }
  /** The reverse of clipIn: the element is masked away. */
  function clipOut(v, el, at, o = {}) {
    const [a, b] = clipShapes(o)
    const dur = o.dur ?? 0.7
    v.tl.fromTo(el, { clipPath: b }, { clipPath: a, duration: dur, ease: o.ease || "glide", immediateRender: false }, at)
    v.tl.set(el, { autoAlpha: 0, clipPath: "none" }, at + dur)
    return at + dur
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
   * spoken word highlighted. o: { words, y, maxWords: 3, cls, from, to, fade: 0.12, hold: 0.6 } → el
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
    // Each row is one element holding its words AND its plate (looks style the plate on
    // .cap-row), so the plate always comes and goes with its own words and never lingers
    // behind the next caption. A row fades in after a pause and out before one; back to
    // back rows swap in place. Put any plate on .cap-row, never on the .captions box.
    const fade = o.fade ?? 0.12
    const hold = o.hold ?? 0.6
    const spansOf = rows.map(({ c }, i) => {
      const next = rows[i + 1]
      const from = c[0].s - 0.05
      const gapAfter = next ? next.c[0].s - c[c.length - 1].e : Infinity
      const joined = next && gapAfter < hold
      const to = joined ? next.c[0].s - 0.05 : c[c.length - 1].e + Math.min(hold, Math.max(0.15, gapAfter - 0.1))
      const prev = rows[i - 1]
      const gapBefore = prev ? c[0].s - prev.c[prev.c.length - 1].e : Infinity
      return { from, to, fadeIn: gapBefore >= hold, fadeOut: !joined }
    })
    v.onFrame((t) => {
      const lo = o.from ?? -Infinity
      const hi = o.to ?? Infinity
      rows.forEach(({ c, row, spans }, i) => {
        const s = spansOf[i]
        const a0 = Math.max(s.from, lo)
        const a1 = Math.min(s.to, hi)
        const on = t >= a0 && t < a1
        row.style.display = on ? "" : "none"
        if (!on) return
        let a = 1
        if (fade > 0 && (s.fadeIn || a0 === lo)) a = Math.min(a, (t - a0) / fade)
        if (fade > 0 && (s.fadeOut || a1 === hi)) a = Math.min(a, (a1 - t) / fade)
        row.style.opacity = String(Math.max(0, Math.min(1, a)))
        spans.forEach((sp, j) => sp.classList.toggle("on", t >= c[j].s - 0.03))
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
        busy: v.busy.slice(),
        warnings: [...new Set(v.warnings)],
        safe: v.safe,
        ui: v.ui,
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
    show, hide, planes, shot, tilt, focus,
    title, reveal, unreveal, sayWords, mark, count, roll, typeOn, measure, fit, tracking, weight,
    card, phone, enter, kpis, table, lineChart, bars, ring, donut, cursor, float, image, box, smooth, hideUntil,
    push, panels, zoomThrough, cut, fly, whip, wipe, clipIn, clipOut,
    vo, captions, finish, bokeh, leak, sheen, scenery,
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
