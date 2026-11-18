/*
 * Clean: a light look for product videos (16:9 first).
 *
 *   const L = Kit.use(v, "clean")
 *   const A = L.shot("intro")
 *   L.label(A.P.mid.el, "Meet the app", { x: v.safe.x, y: 300, at: 0.2 })
 *   const app = L.app(A.P.mid.el, { x: 700, y: 120, w: 1100, h: 840, name: "Tidy" })
 *
 * Config: set `backdrop: "grid"` for the drafting-grid ground.
 * Every helper is listed in looks/clean/LOOK.md.
 */
;(function () {
  const { h, icon } = window.Kit

  Kit.look("clean", {
    init(v) {
      const L = {}
      const tl = v.tl
      L.colors = { ground: "#F2F3F5", card: "#fff", line: "#E1E3E8", ink: "#0A0A0C", muted: "#5B606B", accent: "#0A5CFF", gain: "#139E4B", loss: "#E5342B" }

      /** A scene with three depth planes. */
      L.shot = (name, depths) => Kit.shot(v, name, depths)

      /** A sentence-case label with a small accent square. o: { x, y, at } */
      L.label = (parent, text, o = {}) => {
        const el = h("div", { class: "c-label", style: { left: `${o.x ?? v.safe.x}px`, top: `${o.y ?? v.safe.y}px` } }, parent, text)
        if (o.at !== undefined) Kit.enter(v, el, o.at, { y: 0, x: -24, dur: 0.5 })
        return el
      }

      /** A headline (Outfit). Same options as Kit.title; size defaults to 96. */
      L.title = (parent, str, o = {}) => Kit.title(parent, str, Object.assign({ size: 96, w: 900 }, o))

      /** A paragraph of muted body text. o: { x, y, w, size, at } */
      L.text = (parent, str, o = {}) => {
        const el = h("div", { class: "c-body", style: { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w ?? 700}px`, fontSize: o.size ? `${o.size}px` : undefined } }, parent, str)
        if (o.at !== undefined) Kit.enter(v, el, o.at, { y: 20, dur: 0.6 })
        return el
      }

      /** The product's mark: a rounded accent square with a check. o: { x, y, size, name, gap } */
      L.logo = (parent, o = {}) => {
        const s = o.size ?? 44
        const el = h("div", { class: "c-logo", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, gap: `${o.gap ?? s * 0.32}px` } }, parent)
        const mark = h("div", { class: "c-logo-mark", style: { width: `${s}px`, height: `${s}px`, borderRadius: `${s * 0.28}px` } }, el)
        mark.innerHTML = `<svg viewBox="0 0 24 24" width="${s * 0.62}" height="${s * 0.62}"><path d="M5.5,12.5 L10,17 L18.5,7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        let name = null
        if (o.name) name = h("div", { class: "c-logo-name", style: { fontSize: `${o.nameSize ?? s * 0.9}px` } }, el, o.name)
        return { el, mark, name }
      }

      /**
       * An app window: a top bar (logo, name, search) and a text + icon left nav.
       * o: { x, y, w, h, name, nav: [[icon, label], …], active, search, topH, navW, at }
       * → { el, top, nav, items, body, box } (body = the content area; box = its stage box)
       */
      L.app = (parent, o) => {
        const topH = o.topH ?? 68
        const navW = o.navW ?? 230
        const el = Kit.card(parent, { x: o.x, y: o.y, w: o.w, h: o.h, cls: "c-app c-float" })
        const top = h("div", { class: "c-app-top", style: { height: `${topH}px` } }, el)
        const logo = L.logo(top, { size: 34 })
        logo.el.style.position = "relative"
        h("div", { class: "c-app-name" }, top, o.name || "App")
        if (o.search !== false) h("div", { class: "c-search" }, top).innerHTML = `${icon("search", 20)}<span>${o.search || "Search"}</span>`
        h("div", { class: "c-top-end" }, top).innerHTML = `${icon("bell", 24)}<span class="c-avatar">${icon("users", 20)}</span>`
        const nav = h("div", { class: "c-app-nav", style: { top: `${topH}px`, width: `${navW}px` } }, el)
        const navList = o.nav || [["home", "Home"], ["inbox", "Inbox"], ["grid", "Projects"], ["chart", "Reports"], ["settings", "Settings"]]
        const items = navList.map(([ic, label], i) => {
          const it = h("div", { class: `c-nav-item ${i === (o.active ?? 0) ? "on" : ""}` }, nav)
          it.innerHTML = `${icon(ic, 22)}<span>${label}</span>`
          return it
        })
        const body = h("div", { class: "c-app-body", style: { left: `${navW}px`, top: `${topH}px` } }, el)
        const box = { x: o.x + navW, y: o.y + topH, w: o.w - navW, h: o.h - topH }
        if (o.at !== undefined) Kit.enter(v, el, o.at, { y: 80, scale: 0.97, dur: 0.9 })
        return { el, top, logo, nav, items, body, box }
      }

      /** A heading inside a card or app body. */
      L.heading = (parent, text, o = {}) => h("div", { class: "c-h", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, fontSize: o.size ? `${o.size}px` : undefined } }, parent, text)

      /** A button. o: { x, y, primary, icon, cls } */
      L.button = (parent, text, o = {}) => {
        const el = h("div", { class: `c-btn ${o.primary ? "primary" : ""} ${o.cls || ""}`, style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px` } }, parent)
        el.innerHTML = `${o.icon && o.iconFirst !== false ? icon(o.icon, 20) : ""}<span>${text}</span>${o.iconAfter ? icon(o.iconAfter, 22) : ""}`
        return el
      }
      /** A press on a button (scale down and back): pair it with a cursor click. */
      L.press = (el, at) => tl.to(el, { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out" }, at)

      /** A status chip as HTML (for table cells). kind: "accent" | "gain" | "loss" | "" */
      L.chip = (text, kind = "") => `<span class="c-chip ${kind}">${text}</span>`

      /** A small floating note (a to-do on a scrap). o: { x, y, tag, rotate } */
      L.note = (parent, text, o = {}) => {
        const el = Kit.card(parent, { x: o.x, y: o.y, cls: "c-note c-float" })
        el.innerHTML = `${o.tag ? `<b>${o.tag}</b>` : ""}<span>${text}</span>`
        if (o.rotate) window.gsap.set(el, { rotation: o.rotate })
        return el
      }

      /** A table styled for the look: same options as Kit.table. */
      L.table = (parent, o) => Kit.table(v, parent, Object.assign({ rowH: 66, headH: 48 }, o, { cls: `c-table ${o.cls || ""}` }))

      /**
       * KPI tiles with delta chips. items: [{ label, to, from, fmt, sub, delta: "+12%", down }]
       * o: same as Kit.kpis ({ x, y, w, gap, at, each, dur })
       */
      L.kpis = (parent, items, o) => {
        const K = Kit.kpis(v, parent, items, Object.assign({ max: 72, pad: 58 }, o, { cls: `c-kpis ${o.cls || ""}` }))
        K.chips = items.map((it, i) => {
          if (!it.delta) return null
          const c = h("div", { class: `c-delta ${it.down ? "down" : ""}` }, K.tiles[i].tile)
          c.innerHTML = `${icon(it.down ? "down" : "up", 18, "currentColor", 2.6)}<span>${it.delta}</span>`
          if (o.at !== undefined) {
            const t0 = o.at + i * (o.each ?? 0.12) + (o.dur ?? 1.1) * 0.7
            tl.set(c, { autoAlpha: 0 }, 0)
            tl.fromTo(c, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "pop", immediateRender: false }, t0)
          }
          return c
        })
        return K
      }

      /**
       * A chart card: a line chart that draws itself, a hairline grid and a value tag.
       * o: { x, y, w, h, title, note, values, at, dur, min, max, tag, labels: [first, last] }
       */
      L.chart = (parent, o) => {
        const el = Kit.card(parent, { x: o.x, y: o.y, w: o.w, h: o.h, cls: "c-chart" })
        const head = h("div", { class: "c-chart-head" }, el)
        head.innerHTML = `${o.title || ""}${o.note ? `<span>${o.note}</span>` : ""}`
        const svg = h("svg", { width: o.w, height: o.h, viewBox: `0 0 ${o.w} ${o.h}` }, el)
        const g = h("g", {}, svg)
        const pad = { l: 40, r: 70, t: 90, b: 56 }
        const C = Kit.lineChart(v, g, { x: pad.l, y: pad.t, w: o.w - pad.l - pad.r, h: o.h - pad.t - pad.b, values: o.values, at: o.at, dur: o.dur ?? 1.3, min: o.min, max: o.max, grid: o.grid ?? 4 })
        if (o.labels)
          o.labels.forEach((txt, i) => {
            const a = h("div", { class: "c-axis", style: { top: `${o.h - pad.b + 16}px` } }, el, txt)
            if (i === 0) a.style.left = `${pad.l}px`
            else a.style.right = `${pad.r}px`
          })
        let tag = null
        if (o.tag) {
          const [lx, ly] = C.pts[C.pts.length - 1]
          tag = h("div", { class: "c-tag", style: { right: `${o.w - lx - 22}px`, bottom: `${o.h - ly + 24}px` } }, el, o.tag)
          tl.set(tag, { autoAlpha: 0 }, 0)
          tl.fromTo(tag, { autoAlpha: 0, y: 12, scale: 0.85 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "pop", immediateRender: false }, C.end + 0.05)
          v.sfx("pop", C.end + 0.05, { gain: -6 })
        }
        return Object.assign(C, { el, tag })
      }

      /**
       * The assistant side panel (a spark icon, no face). o: { w, name, parent: app.body or any box }
       * → { el, ask(at, text), answer(at, text, cps), steps(at, [text, …]) }
       */
      L.assistant = (parent, o = {}) => {
        const el = h("div", { class: "c-assist", style: { width: `${o.w ?? 400}px` } }, parent)
        h("div", { class: "c-assist-head" }, el).innerHTML = `<span class="c-spark">${icon("spark", 20, "currentColor", 2)}</span><span>${o.name || "Assistant"}</span>`
        const msgs = h("div", { class: "c-msgs" }, el)
        const bubble = (kind, text) => {
          const b = h("div", { class: `c-msg ${kind}` }, msgs)
          if (kind === "bot") b.innerHTML = `<span class="c-spark">${icon("spark", 16, "currentColor", 2.2)}</span>`
          h("span", { class: "ghost" }, b, text)
          return { b, typed: h("span", { class: "typed" }, b) }
        }
        return {
          el,
          ask(at, text, cps = 38) {
            const { b, typed } = bubble("user", text)
            Kit.enter(v, b, at, { y: 16, dur: 0.4 })
            v.sfx("key", at + 0.1, { gain: -10 })
            return Kit.typeOn(v, typed, text, at + 0.1, cps)
          },
          answer(at, text, cps = 70) {
            const { b, typed } = bubble("bot", text)
            Kit.enter(v, b, at, { y: 16, dur: 0.45 })
            return Kit.typeOn(v, typed, text, at + 0.2, cps)
          },
          steps(at, list) {
            const els = list.map((t, i) => {
              const s = h("div", { class: "c-step" }, msgs)
              s.innerHTML = `<i>${i + 1}</i><span>${t}</span>`
              return s
            })
            Kit.enter(v, els, at, { y: 14, dur: 0.4, each: 0.1 })
            return at + 0.4 + 0.1 * (list.length - 1)
          },
        }
      }

      /** A toast that slides up and leaves. o: { x, y, at, out, icon } */
      L.toast = (parent, text, o) => {
        const el = h("div", { class: "c-toast", style: { left: `${o.x}px`, top: `${o.y}px` } }, parent)
        el.innerHTML = `<span class="c-spark">${icon(o.icon || "check", 20, "currentColor", 2.6)}</span><span>${text}</span>`
        Kit.enter(v, el, o.at, { y: 30, scale: 0.96, dur: 0.45, ease: "pop" })
        v.sfx("chime", o.at, { gain: -8 })
        if (o.out !== undefined) tl.to(el, { autoAlpha: 0, y: 16, duration: 0.3, ease: "power2.in" }, o.out)
        return el
      }

      /**
       * The end card in shot A: logo, name, tagline, a square-ish CTA and a cursor click.
       * o: { name, tagline, cta, url, at, click } → { logo, tagline, cta, url, cursor, logoBox }
       */
      L.endCard = (A, o) => {
        const at = o.at
        const cx = v.W / 2
        const p = A.P.mid.el
        const nameSize = o.nameSize ?? 150
        const markSize = nameSize * 0.82
        const logo = L.logo(p, { size: markSize, name: o.name, nameSize, gap: nameSize * 0.24 })
        const lw = Kit.measure(v, o.name, "c-logo-name") * (nameSize / 100) + markSize + nameSize * 0.24
        const top = v.H * 0.5 - nameSize * 1.15
        Object.assign(logo.el.style, { left: `${cx - lw / 2}px`, top: `${top}px` })
        const tag = h("div", { class: "c-tagline", style: { left: "0px", width: `${v.W}px`, top: `${top + markSize + 44}px` } }, p, o.tagline || "")
        const cta = L.button(p, o.cta || "Get started", { primary: true, iconAfter: "arrow", cls: "c-cta" })
        const cw = cta.offsetWidth
        const ctaY = top + markSize + 44 + 80
        Object.assign(cta.style, { left: `${cx - cw / 2}px`, top: `${ctaY}px` })
        let url = null
        if (o.url) url = h("div", { class: "c-url", style: { left: "0px", width: `${v.W}px`, top: `${ctaY + 76 + 30}px` } }, p, o.url)
        Kit.enter(v, logo.mark, at, { y: 0, scale: 0.6, dur: 0.55, ease: "pop" })
        if (logo.name) Kit.enter(v, logo.name, at + 0.12, { y: 0, x: -30, dur: 0.6 })
        Kit.enter(v, tag, at + 0.3, { y: 18, dur: 0.6 })
        Kit.enter(v, cta, at + 0.45, { y: 18, dur: 0.6 })
        if (url) Kit.enter(v, url, at + 0.6, { y: 10, dur: 0.6 })
        v.sfx("pop", at, { gain: -4 })
        const cursor = Kit.cursor(v, A.P.fg.g)
        const clickAt = o.click ?? at + 1.5
        const target = [cx + cw * 0.18, ctaY + 50]
        cursor.glide(clickAt - 0.75, [v.W * 0.78, v.H * 0.95], target, 0.7)
        cursor.click(clickAt, target[0], target[1])
        L.press(cta, clickAt)
        tl.to(cta, { backgroundColor: "#0849CC", duration: 0.12, ease: "none" }, clickAt)
        return { logo, tagline: tag, cta, url, cursor }
      }

      /** A cursor (in an SVG plane group, e.g. A.P.fg.g). */
      L.cursor = (g) => Kit.cursor(v, g)

      // ── transitions ──
      L.push = (A, B, at, o = {}) => Kit.push(v, A, B, at, Object.assign({ dir: "left", dur: 0.6 }, o))
      L.zoomThrough = (A, B, at, x, y, o = {}) => Kit.zoomThrough(v, A, B, at, x, y, Object.assign({ zoom: 5, dur: 0.55 }, o))
      L.fly = (el, at, from, to, o = {}) => Kit.fly(v, el, at, from, to, o)
      /** Ink + accent panels sweeping across (horizontal). Swap shots at .mid. */
      L.panels = (at, o = {}) => Kit.panels(v, at, Object.assign({ colors: ["var(--ink)", "var(--accent)"], dir: "left", dur: 0.45, each: 0.09 }, o))

      return L
    },
  })
})()
