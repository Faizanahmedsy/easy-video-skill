/*
 * Bold: a dark night look for reels (9:16 first, works in 16:9).
 *
 *   const L = Kit.use(v, "bold")
 *   const A = L.shot("intro", { scenery: "stars" })     // depth planes, bokeh, an optional scenery preset
 *   L.kicker(A.P.mid.el, "New", { y: 300, at: 0.1 })
 *   const T = L.big(A.P.mid.el, ["Quiet", { text: "phone.", kind: "accent" }], { y: 360, at: 0.2 })
 *   A.P.drift(0, 3)
 *
 * Every helper is listed in looks/bold/LOOK.md.
 */
;(function () {
  const { h, icon } = window.Kit
  const G = window.gsap
  const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 3)

  Kit.look("bold", {
    init(v) {
      const L = {}
      const tl = v.tl
      const k = v.k
      L.colors = { ground: "#0A0B10", ink: "#F4F5F0", accent: "#C8FF2E" }

      /**
       * A shot: three depth planes, faint discs of light behind and a few big soft
       * ones in front. o: { scenery: "stars" | "rays" | "studio", bokeh: false, from, to }
       */
      L.shot = (name, o = {}) => {
        const A = Kit.shot(v, name, o.depths)
        const seed = hash(name)
        if (o.scenery) Kit.scenery(v, A.P.bg, o.scenery, { seed, from: o.from, to: o.to })
        if (o.bokeh !== false) {
          Kit.bokeh(v, A.P.bg.el, { count: 10, size: [16, 70], opacity: [0.18, 0.5], soft: 0.35, colors: ["#fff", "var(--glow-1)", "rgba(200,255,46,0.6)"], seed })
          Kit.bokeh(v, A.P.fg.el, { count: 3, size: [160, 300], opacity: [0.1, 0.2], soft: 0.85, colors: ["var(--glow-1)", "var(--glow-2)"], seed: seed + 5, area: { x: -v.W * 0.1, y: 0, w: v.W * 1.2, h: v.H } })
        }
        return A
      }

      /** A small uppercase label with an accent bar that draws in. o: { x, y, at } */
      L.kicker = (parent, text, o = {}) => {
        const el = h("div", { class: "b-kicker", style: { left: `${o.x ?? v.safe.x}px`, top: `${o.y ?? v.safe.y}px` } }, parent)
        const bar = h("i", {}, el)
        const t = h("span", {}, el, text)
        if (o.at !== undefined) {
          tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "glide", immediateRender: true }, o.at)
          Kit.clipIn(v, t, o.at + 0.15, { from: "left", dur: 0.6 })
        }
        return el
      }

      /**
       * Huge stacked lines, each fitted to the same width so the block reads as one poster.
       * lines: ["Every", { text: "ping", kind: "accent" }, { text: "breaks your", kind: "lite" }]
       * o: { x, y, w, gap, at, each, max, by: "chars" } → { lines, h, end, out(at) }
       */
      L.big = (parent, lines, o = {}) => {
        const x = o.x ?? v.safe.x
        const w = o.w ?? v.safe.w - 24 * k
        const gap = o.gap ?? 10 * k
        let y = o.y ?? v.safe.y
        const at = o.at
        const each = o.each ?? 0.12
        const made = lines.map((ln, i) => {
          const L0 = typeof ln === "string" ? { text: ln } : ln
          const cls = `b-line ${L0.kind || ""}`
          const font = L0.kind === "lite" ? { fontFamily: "Archivo", fontWeight: 300, fontStretch: "125%", textTransform: "uppercase", letterSpacing: "0.02em" } : { fontFamily: "Anton", textTransform: "uppercase", letterSpacing: "0.005em" }
          const size = L0.size ?? Kit.fit(v, L0.text, w * (L0.scale ?? 1), "", { max: (L0.max ?? o.max ?? 330) * k, style: font })
          const t = Kit.title(parent, L0.text, { x: o.align === "right" ? x + w : x, y, w: w + 40 * k, size, cls, align: o.align })
          y += size * (L0.kind === "lite" ? 1.08 : 0.98) + gap
          if (at !== undefined) Kit.reveal(v, t, at + i * each, { by: o.by || "chars", each: 0.022, dur: 0.75, ease: "rise" })
          return t
        })
        const end = at === undefined ? 0 : at + (lines.length - 1) * each + 0.75 + 0.022 * 10
        return {
          lines: made,
          h: y - gap - (o.y ?? v.safe.y),
          end,
          out(t0, oo = {}) {
            made.forEach((t, i) => Kit.unreveal(v, t, t0 + i * 0.05, { by: "chars", each: 0.01, dur: 0.35, to: oo.to }))
            return t0 + 0.35 + made.length * 0.05
          },
        }
      }

      /** A big number that rolls into place. o: { x, y, w, value: "4.5", suffix, at, max } → { el, size } */
      L.count = (parent, o) => {
        const w = o.w ?? v.safe.w
        const text = `${o.value}${o.suffix || ""}`
        const size = Math.min((o.max ?? 600) * k, Kit.fit(v, text, w, "", { style: { fontFamily: "Anton" } }))
        const el = h("div", { class: "b-count", style: { left: `${o.x ?? v.safe.x}px`, top: `${o.y}px`, fontSize: `${size}px` } }, parent)
        Kit.roll(v, el, text, o.at, { dur: o.dur ?? 1.2, each: 0.08 })
        tl.fromTo(el, { scale: 0.9, transformOrigin: "0% 100%" }, { scale: 1, duration: 1.4, ease: "rise", immediateRender: true }, o.at)
        v.sfx("hit", o.at + (o.dur ?? 1.2), { gain: -6 })
        return { el, size }
      }

      /** A notification card in dark glass. o: { x, y, w, icon, color, title, sub, time } → el */
      L.notif = (parent, o) => {
        const el = h("div", { class: "b-glass b-notif", style: { left: `${o.x}px`, top: `${o.y}px`, width: o.w ? `${o.w}px` : undefined } }, parent)
        el.innerHTML = `<span class="b-ico" style="background:${o.color || "#555"}">${icon(o.icon || "bell", 38, "currentColor", 2.2)}</span><b>${o.title}</b><span>${o.sub || ""}</span>${o.time ? `<em>${o.time}</em>` : ""}`
        return el
      }

      /** A phone with a dark screen. o: { x, y, w, at (rises and untilts) } → Kit.phone result */
      L.phone = (parent, o = {}) => {
        const ph = Kit.phone(v, parent, o)
        if (o.at !== undefined) {
          Kit.enter(v, ph.el, o.at, { y: 260 * k, dur: 1.1, ease: "rise" })
          Kit.tilt(v, ph.el, o.at, 1.4, {}, { from: { rx: 28, ry: -12, rz: 4 }, origin: "50% 80%" })
          Kit.sheen(v, ph.glass, o.at + 0.6, { dur: 1.1, color: "rgba(255,255,255,0.22)" })
        }
        return ph
      }

      /** Text on a phone screen (screen pixels). o: { x, y, size, cls: "b-scr-h" | "b-scr-m" | "b-timer", align, w } */
      L.screenText = (screen, text, o = {}) => {
        const el = h("div", { class: `b-scr ${o.cls || ""}`, style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, fontSize: `${o.size ?? 28}px`, width: o.w ? `${o.w}px` : undefined, textAlign: o.align || "left", color: o.color } }, screen, text)
        return el
      }

      /** A round accent button. o: { x, y, w, h, size } → el */
      L.button = (parent, text, o = {}) => h("div", { class: "b-btn", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, width: `${o.w ?? 300}px`, height: `${o.h ?? 90}px`, fontSize: `${o.size ?? 30}px` } }, parent, text)
      /** A tap on something: it dips, and a ring of light spreads from the touch. */
      L.tap = (el, at, x, y, g) => {
        tl.to(el, { scale: 0.93, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" }, at)
        if (g) {
          const ring = h("circle", { cx: x, cy: y, r: 10, fill: "none", stroke: "var(--accent)", "stroke-width": 4 * k }, g)
          ring.style.stroke = "var(--accent)"
          tl.set(ring, { autoAlpha: 0 }, 0)
          tl.fromTo(ring, { attr: { r: 10 * k }, autoAlpha: 0.9 }, { attr: { r: 110 * k }, autoAlpha: 0, duration: 0.6, ease: "power2.out", immediateRender: false }, at)
        }
        v.sfx("click", at)
      }

      /** The product's mark (a ring holding a dot) and name. o: { x, y, size, name, nameSize } */
      L.logo = (parent, o = {}) => {
        const s = o.size ?? 90 * k
        const el = h("div", { class: "b-logo", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, gap: `${s * 0.3}px` } }, parent)
        const svg = h("svg", { viewBox: "0 0 100 100", width: s, height: s }, el)
        const ring = h("circle", { cx: 50, cy: 50, r: 40, fill: "none", "stroke-width": 12, "stroke-linecap": "round", transform: "rotate(-90 50 50)" }, svg)
        ring.style.stroke = "var(--accent)"
        const dot = h("circle", { cx: 50, cy: 50, r: 15 }, svg)
        dot.style.fill = "var(--ink)"
        const name = o.name ? h("div", { class: "b-logo-name", style: { fontSize: `${o.nameSize ?? s * 0.9}px` } }, el, o.name) : null
        return { el, ring, dot, name, size: s }
      }
      /** The logo arrives: the ring draws, the dot lands, the name wipes in. */
      L.logoIn = (lg, at) => {
        Kit.hideUntil(v, lg.ring, at)
        tl.fromTo(lg.ring, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "glide", immediateRender: false }, at)
        G.set(lg.dot, { svgOrigin: "50 50" })
        tl.fromTo(lg.dot, { scale: 0 }, { scale: 1, duration: 0.6, ease: "land", immediateRender: true }, at + 0.35)
        if (lg.name) tl.fromTo(lg.name, { clipPath: "inset(-20% 100% -20% 0%)", x: -lg.size * 0.3 }, { clipPath: "inset(-20% 0% -20% 0%)", x: 0, duration: 0.8, ease: "glide", immediateRender: true }, at + 0.25)
        v.sfx("pop", at + 0.35, { gain: -4 })
        return at + 1.05
      }

      /**
       * The end card: the logo, a quiet tagline and a CTA button with a sheen and a tap.
       * o: { name, tagline, cta, at, tap } → { logo, tag, cta }
       */
      L.endCard = (A, o) => {
        const p = A.P.mid.el
        const s = o.size ?? 150 * k
        const lg = L.logo(p, { size: s, name: o.name, nameSize: s * 0.95 })
        const lw = lg.el.offsetWidth
        const top = v.safe.cy - s * 1.2
        Object.assign(lg.el.style, { left: `${v.W / 2 - lw / 2}px`, top: `${top}px` })
        L.logoIn(lg, o.at)
        const tag = h("div", { class: "b-tag", style: { left: "0px", width: `${v.W}px`, top: `${top + s + 60 * k}px`, fontSize: `${(o.tagSize ?? 50) * k}px` } }, p, o.tagline || "")
        Kit.enter(v, tag, o.at + 0.4, { y: 24, dur: 0.8, ease: "rise" })
        const bw = (o.ctaW ?? 520) * k
        const cta = L.button(p, o.cta || "Get it free", { x: v.W / 2 - bw / 2, y: top + s + 200 * k, w: bw, h: 120 * k, size: 38 * k })
        Kit.enter(v, cta, o.at + 0.55, { y: 30, scale: 0.9, dur: 0.8, ease: "land" })
        Kit.sheen(v, cta, o.at + 1.2, { dur: 0.9, color: "rgba(255,255,255,0.65)" })
        if (o.tap !== undefined) L.tap(cta, o.tap, v.W / 2, top + s + 260 * k, A.P.fg.g)
        Kit.leak(v, o.at + 0.1, { dur: 1.6, color: "rgba(200,255,46,0.35)", blend: "screen" })
        return { logo: lg, tag, cta }
      }

      /** Timed words for captions when there is no voice: L.words("Say it plainly.", 2.4, 0.26). */
      L.words = (text, at, each = 0.26) =>
        text
          .split(/\s+/)
          .filter(Boolean)
          .map((w, i) => ({ w, s: at + i * each, e: at + (i + 1) * each - 0.02 }))
      /** Captions on a dark pill, the spoken word in the accent. o: { words, y, maxWords, from, to } */
      L.captions = (parent, o = {}) => Kit.captions(v, parent, Object.assign({ maxWords: 3, y: v.safe.b - 170 * k }, o, { cls: `b-caps ${o.cls || ""}` }))

      // ── transitions ──
      /** An accent edge, then the dark ground, sweep across on a slant; swap shots at .mid. */
      L.wipe = (at, o = {}) => Kit.wipe(v, at, Object.assign({ kind: "diagonal", dir: "up", colors: ["var(--accent)", "var(--ground)"], dur: 0.8, lag: 0.08 }, o))
      L.whip = (A, B, at, o = {}) => Kit.whip(v, A, B, at, Object.assign({ dir: "up", dur: 0.5 }, o))
      L.push = (A, B, at, o = {}) => Kit.push(v, A, B, at, Object.assign({ dir: "up", dur: 0.55 }, o))
      L.zoomThrough = (A, B, at, x, y, o = {}) => Kit.zoomThrough(v, A, B, at, x, y, Object.assign({ zoom: 9, dur: 0.5, fromZoom: 1.5 }, o))
      /** A hard cut with a 2-frame accent flash. */
      L.cut = (A, B, at, o = {}) => Kit.cut(v, A, B, at, Object.assign({ flash: L.colors.accent, frames: 2, strength: 0.85 }, o))
      L.panels = (at, o = {}) => Kit.panels(v, at, Object.assign({ colors: [L.colors.accent, L.colors.ground], dir: "up", dur: 0.4, each: 0.08 }, o))

      return L
    },
  })
})()
