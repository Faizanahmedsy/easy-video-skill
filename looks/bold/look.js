/*
 * Bold: a loud duotone look for reels (9:16 first, works in 16:9).
 *
 *   const L = Kit.use(v, "bold")
 *   const A = L.shot("intro", "black")              // solid ground per shot
 *   L.shapes(A, { at: 0, dur: 3 })                   // geometric blocks drifting in the back
 *   L.stack(A.P.mid.el, [{ text: "Save", bg: "lime" }, { text: "an hour", bg: "white" }], { y: 420, at: 0.2 })
 *
 * Colour names: "black", "lime", "white" (or any CSS colour).
 * Every helper is listed in looks/bold/LOOK.md.
 */
;(function () {
  const { h } = window.Kit
  const C = { black: "#0F0F12", lime: "#D6FF3D", white: "#F7F7F2" }
  const col = (c) => C[c] || c
  // the text colour that reads on each ground
  const onCol = (bg) => (col(bg) === C.black ? C.white : C.black)

  Kit.look("bold", {
    init(v) {
      const L = { colors: C }
      const tl = v.tl
      const k = v.k

      /** A shot with a solid full-frame ground (its own plane, depth 1, so pushes carry it). */
      L.shot = (name, ground = "black") => {
        const A = Kit.shot(v, name, { ground: 1, bg: 0.35, mid: 0.75, fg: 1.3 })
        A.ground = h("div", { class: "b-ground", style: { background: col(ground) } }, A.P.ground.el)
        A.color = col(ground)
        return A
      }

      /**
       * Geometric blocks (squares, circles, half-discs, bars) drifting in the back plane.
       * o: { at, dur, seed, count, color, opacity, land } (land: true = they drift INTO
       * their resting places by at + dur, so a closing shot matches the opening frame)
       */
      L.shapes = (A, o = {}) => {
        const rnd = Kit.seeded(o.seed ?? 7)
        const n = o.count ?? 6
        const dark = A.color === C.black
        const fill = o.color || (dark ? "rgba(247,247,242,0.06)" : "rgba(15,15,18,0.08)")
        const hi = dark ? "rgba(214,255,61,0.16)" : "rgba(15,15,18,0.14)"
        const kinds = ["square", "disc", "half", "bar"]
        const at = o.at ?? 0
        const dur = o.dur ?? v.cfg.duration
        const els = []
        for (let i = 0; i < n; i++) {
          const kind = kinds[i % kinds.length]
          const s = (220 + rnd() * 340) * k
          const w = kind === "bar" ? s * 1.9 : s
          const hh = kind === "bar" ? s * 0.34 : kind === "half" ? s / 2 : s
          // spread them around the frame edges, away from the middle of the text
          const side = i % 2 ? 1 : -1
          const x = v.W / 2 + side * (v.W * (0.22 + rnd() * 0.32)) - w / 2
          const y = (i / n) * v.H + rnd() * v.H * 0.12 - hh / 2
          const r = kind === "disc" ? "50%" : kind === "half" ? `${s}px ${s}px 0 0` : "0"
          const el = h("div", { class: "b-shape", style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, borderRadius: r, background: i === 1 ? hi : fill } }, A.P.bg.el)
          const rest = { x: 0, y: 0, rotation: (rnd() - 0.5) * 50 }
          const away = { x: side * (60 + rnd() * 90) * k, y: (rnd() - 0.5) * 220 * k, rotation: rest.rotation + (rnd() - 0.5) * 40 }
          const [a, b] = o.land ? [away, rest] : [rest, away]
          tl.fromTo(el, a, Object.assign({}, b, { duration: dur, ease: o.land ? "power2.out" : "none", immediateRender: true }), at)
          els.push(el)
        }
        return els
      }

      /** Font size at which `text` on a block (with its padding) is exactly `w` px wide. */
      const fitBlock = (text, w, max) => {
        const m = Kit.measure(v, text, "b-block-t", { padding: "0" })
        return Math.min(max, w / (m / 100 + 0.24))
      }

      /**
       * One block of text that slides in from a side. o: { x, y, w, size, bg, color, from, at, align }
       * size: a number, or omitted = fitted to w (capped by o.max).
       */
      L.block = (parent, text, o = {}) => {
        const size = o.size ?? fitBlock(text, o.w ?? v.safe.w, o.max ?? 320 * k)
        const bg = col(o.bg || "lime")
        const el = h("div", { class: "b-block", style: { top: `${o.y}px`, background: bg } }, parent)
        const t = h("div", { class: "b-block-t", style: { fontSize: `${size}px`, color: col(o.color || onCol(bg)) } }, el, text)
        const bw = el.offsetWidth
        const bh = el.offsetHeight
        const left = o.align === "right" ? o.x - bw : o.align === "center" ? o.x - bw / 2 : o.x
        el.style.left = `${left}px`
        if (o.at !== undefined) {
          const s = o.from === "right" ? 1 : -1
          const dist = s > 0 ? v.W - left + 40 : left + bw + 40
          tl.fromTo(el, { x: s * dist }, { x: 0, duration: o.dur ?? 0.55, ease: "dash", immediateRender: true }, o.at)
          tl.fromTo(t, { xPercent: s * 30 }, { xPercent: 0, duration: (o.dur ?? 0.55) + 0.2, ease: "out", immediateRender: true }, o.at + 0.04)
          v.sfx("swish", o.at + 0.08, { gain: -8, pitch: 0.9 + v.rand() * 0.3 })
        }
        return { el, t, w: bw, h: bh, size, x: left, y: o.y }
      }

      /**
       * Lines on solid blocks that stack from alternating sides, each fitted to the safe width.
       * lines: [{ text, bg, color, max }] or strings. o: { x, y, w, at, each, gap, max, first: "left" }
       * → { blocks, h, end }
       */
      L.stack = (parent, lines, o = {}) => {
        const x = o.x ?? v.safe.x
        const w = o.w ?? v.safe.w
        const gap = o.gap ?? 14 * k
        const each = o.each ?? 0.14
        let y = o.y ?? v.safe.y
        const firstRight = o.first === "right"
        const blocks = lines.map((ln, i) => {
          const L0 = typeof ln === "string" ? { text: ln } : ln
          const right = (i % 2 === 1) !== firstRight
          const b = L.block(parent, L0.text, { x: right ? x + w : x, y, w, align: right ? "right" : "left", from: right ? "right" : "left", bg: L0.bg || (i % 2 ? "white" : "lime"), color: L0.color, max: L0.max ?? o.max ?? 300 * k, size: L0.size, at: o.at === undefined ? undefined : o.at + i * each, dur: o.dur })
          y += b.h + gap
          return b
        })
        return { blocks, h: y - gap - (o.y ?? v.safe.y), end: (o.at ?? 0) + (lines.length - 1) * each + (o.dur ?? 0.55) }
      }

      /** Blocks leave the way they came (alternate sides). Returns the end time. */
      L.unstack = (S, at, o = {}) => {
        S.blocks.forEach((b, i) => {
          const s = i % 2 ? 1 : -1
          tl.to(b.el, { x: s * (v.W + 40), duration: o.dur ?? 0.4, ease: "power3.in" }, at + i * (o.each ?? 0.06))
        })
        return at + (o.dur ?? 0.4) + (S.blocks.length - 1) * (o.each ?? 0.06)
      }

      /** A small Archivo label on a block. o: { x, y, bg, color, at, align } */
      L.label = (parent, text, o = {}) => {
        const bg = col(o.bg || "white")
        const el = h("div", { class: "b-label", style: { top: `${o.y}px`, background: bg, color: col(o.color || onCol(bg)) } }, parent, text)
        const bw = el.offsetWidth
        el.style.left = `${o.align === "right" ? o.x - bw : o.align === "center" ? o.x - bw / 2 : o.x ?? v.safe.x}px`
        if (o.at !== undefined) {
          tl.fromTo(el, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.4, ease: "inout", immediateRender: true }, o.at)
        }
        return el
      }

      /**
       * The big count-up, fitted to a width. o: { x, y, w, from, to, at, dur, fmt, color, max }
       * fmt(n) → the text (e.g. n => `${Math.round(n)}%`). → { el, size }
       */
      L.count = (parent, o) => {
        const fmt = o.fmt || ((n) => String(Math.round(n)))
        const w = o.w ?? v.safe.w
        const size = Math.min(o.max ?? 640 * k, (w / Math.max(1, Kit.measure(v, fmt(o.to), "b-count"))) * 100)
        const el = h("div", { class: "b-count", style: { left: `${o.x ?? v.safe.x}px`, top: `${o.y}px`, width: `${w}px`, fontSize: `${size}px`, color: col(o.color || "lime") } }, parent, fmt(o.from ?? 0))
        Kit.count(v, el, o.from ?? 0, o.to, o.at, o.dur ?? 1.2, fmt)
        tl.fromTo(el, { scale: 0.86 }, { scale: 1, duration: (o.dur ?? 1.2) + 0.2, ease: "out", immediateRender: true }, o.at)
        tl.to(el, { scale: 1.05, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" }, o.at + (o.dur ?? 1.2))
        v.sfx("hit", o.at + (o.dur ?? 1.2), { gain: -5 })
        return { el, size }
      }

      /** Timed words for captions when there is no voice: L.words("Say it plainly.", 2.4, 0.26). */
      L.words = (text, at, each = 0.26) =>
        text
          .split(/\s+/)
          .filter(Boolean)
          .map((w, i) => ({ w, s: at + i * each, e: at + (i + 1) * each - 0.02 }))

      /** Captions on a black block, the spoken word in lime. o: { words, y, maxWords, from, to } */
      L.captions = (parent, o = {}) => Kit.captions(v, parent, Object.assign({ maxWords: 3, y: v.safe.b - 170 * k }, o, { cls: `b-caps ${o.cls || ""}` }))

      // ── transitions ──
      /** Lime, black and white panels stack upward, then leave. Swap shots at .mid. */
      L.panels = (at, o = {}) => Kit.panels(v, at, Object.assign({ colors: [C.lime, C.black, C.white], dir: "up", dur: 0.4, each: 0.08 }, o))
      L.push = (A, B, at, o = {}) => Kit.push(v, A, B, at, Object.assign({ dir: "up", dur: 0.5 }, o))
      L.zoomThrough = (A, B, at, x, y, o = {}) => Kit.zoomThrough(v, A, B, at, x, y, Object.assign({ zoom: 9, dur: 0.45, fromZoom: 1.5 }, o))
      /** A hard cut with a 2-frame lime flash. */
      L.cut = (A, B, at, o = {}) => Kit.cut(v, A, B, at, Object.assign({ flash: C.lime, frames: 2 }, o))

      return L
    },
  })
})()
