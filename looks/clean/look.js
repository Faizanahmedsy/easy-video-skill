/*
 * Clean: a light studio look for product videos (16:9 first).
 *
 *   const L = Kit.use(v, "clean")
 *   const A = L.shot("intro")                       // three depth planes, soft bokeh front and back
 *   L.eyebrow(A.P.mid.el, "Meet Tidy", { x: v.safe.x, y: 300, at: 0.2 })
 *   const t = L.title(A.P.mid.el, "One calm list|^for every task.^", { x: v.safe.x, y: 360 })
 *   L.reveal(t, 0.3)
 *   const app = L.app(A.P.mid.el, { x: 760, y: 140, w: 1040, h: 800, name: "Tidy", at: 0.4 })
 *   A.P.drift(0, 4)                                  // the slow camera every shot has
 *
 * Config: backdrop "glow dots" gives the lit ground with a faint dot grid.
 * Every helper is listed in looks/clean/LOOK.md.
 */
;(function () {
  const { h, icon } = window.Kit
  const G = window.gsap
  const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

  Kit.look("clean", {
    init(v) {
      const L = {}
      const tl = v.tl
      L.colors = { ground: "#F0F2F6", card: "#FFFFFF", ink: "#0B1020", muted: "#5A6378", accent: "#2E5CFF", gain: "#12A150", loss: "#E0463A", warn: "#E8A317" }

      /**
       * A shot: three depth planes (A.P.bg / mid / fg) with soft out-of-focus
       * discs behind and in front, so every shot has depth. o: { bokeh: false, depths }
       */
      L.shot = (name, o = {}) => {
        const A = Kit.shot(v, name, o.depths)
        if (o.bokeh !== false) {
          const seed = hash(name)
          Kit.bokeh(v, A.P.bg.el, { count: 9, size: [18, 80], opacity: [0.35, 0.8], soft: 0.3, colors: ["#fff", "var(--glow-1)", "var(--glow-2)"], seed })
          for (const [i, x] of [[0, -0.06], [1, 0.82]].map(([i, x]) => [i, x * v.W]))
            Kit.bokeh(v, A.P.fg.el, { count: 2, size: [150, 260], opacity: [0.18, 0.32], soft: 0.8, colors: ["#fff", "var(--glow-1)", "var(--glow-3)"], seed: seed + 11 + i, area: { x, y: 0, w: v.W * 0.24, h: v.H } })
        }
        return A
      }

      /** A small uppercase label in a pill, with an accent dot. o: { x, y, at } */
      L.eyebrow = (parent, text, o = {}) => {
        const el = h("div", { class: "c-eyebrow", style: { left: `${o.x ?? v.safe.x}px`, top: `${o.y ?? v.safe.y}px` } }, parent)
        h("i", {}, el)
        h("span", {}, el, text)
        if (o.at !== undefined) {
          Kit.enter(v, el, o.at, { y: 14, dur: 0.6, ease: "rise" })
          tl.fromTo(el.querySelector("i"), { scale: 0 }, { scale: 1, duration: 0.5, ease: "land", immediateRender: false }, o.at + 0.15)
        }
        return el
      }
      L.label = L.eyebrow

      /** A headline (Outfit). *word* = accent, ^word^ = light and quiet, | = new line. Same options as Kit.title. */
      L.title = (parent, str, o = {}) => Kit.title(parent, str, Object.assign({ size: 108, w: 1000 }, o))
      /** The look's title entrance: word by word, each rising out of its mask with a small tip. */
      L.reveal = (t, at, o = {}) => Kit.reveal(v, t, at, Object.assign({ by: "words", each: 0.065, dur: 1.0, rotate: 3 }, o))

      /** A paragraph of muted body text. o: { x, y, w, size, at } */
      L.text = (parent, str, o = {}) => {
        const el = h("div", { class: "c-body", style: { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w ?? 700}px`, fontSize: o.size ? `${o.size}px` : undefined } }, parent, str)
        if (o.at !== undefined) Kit.enter(v, el, o.at, { y: 22, dur: 0.8, ease: "rise" })
        return el
      }

      const CHECK = "M5.5,12.5 L10,17 L18.5,7.5"
      /** The product's mark (a rounded square with a check) and its name. o: { x, y, size, name, nameSize, gap } */
      L.logo = (parent, o = {}) => {
        const s = o.size ?? 44
        const el = h("div", { class: "c-logo", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, gap: `${o.gap ?? s * 0.3}px` } }, parent)
        const mark = h("div", { class: "c-logo-mark", style: { width: `${s}px`, height: `${s}px`, borderRadius: `${s * 0.3}px`, fontSize: `${s}px` } }, el)
        const svg = h("svg", { viewBox: "0 0 24 24", width: s * 0.62, height: s * 0.62 }, mark)
        const check = h("path", { d: CHECK, fill: "none", stroke: "currentColor", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg)
        let name = null
        if (o.name) name = h("div", { class: "c-logo-name", style: { fontSize: `${o.nameSize ?? s * 0.9}px` } }, el, o.name)
        return { el, mark, check, name, size: s }
      }
      /** The logo arrives: the mark lands with a small turn, the check draws, the name wipes in. Returns the end time. */
      L.logoIn = (lg, at) => {
        tl.fromTo(lg.mark, { scale: 0, rotation: -16 }, { scale: 1, rotation: 0, duration: 0.8, ease: "land", immediateRender: true }, at)
        Kit.hideUntil(v, lg.check, at + 0.25)
        tl.fromTo(lg.check, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.45, ease: "power2.inOut", immediateRender: false }, at + 0.25)
        if (lg.name) {
          tl.fromTo(lg.name, { clipPath: "inset(-20% 100% -20% 0%)", x: -lg.size * 0.4 }, { clipPath: "inset(-20% 0% -20% 0%)", x: 0, duration: 0.8, ease: "glide", immediateRender: true }, at + 0.2)
        }
        v.sfx("pop", at, { gain: -4 })
        return at + 1
      }

      /** A person's initials in a coloured circle (HTML, for tables and top bars). */
      L.face = (initials, i = 0) => `<span class="c-face f${i % 5}">${initials}</span>`

      /**
       * An app window: window lights, logo, name, search, team faces, and a left nav.
       * o: { x, y, w, h, name, nav: [[icon, label, count], …], active, search, faces: [["AL", 0], …],
       *      topH, navW, at (rises and untilts from 3D) }
       * → { el, top, logo, nav, items, body, box } (body = the content area; box = its place on the stage)
       */
      L.app = (parent, o) => {
        const topH = o.topH ?? 70
        const navW = o.navW ?? 236
        const el = Kit.card(parent, { x: o.x, y: o.y, w: o.w, h: o.h, cls: "c-app c-lift" })
        const top = h("div", { class: "c-app-top", style: { height: `${topH}px` } }, el)
        h("div", { class: "c-lights" }, top).innerHTML = "<i></i><i></i><i></i>"
        const logo = L.logo(top, { size: 34 })
        logo.el.style.position = "relative"
        h("div", { class: "c-app-name" }, top, o.name || "App")
        if (o.search !== false) h("div", { class: "c-search" }, top).innerHTML = `${icon("search", 20)}<span>${o.search || "Search"}</span><kbd>/</kbd>`
        const end = h("div", { class: "c-top-end" }, top)
        const faces = o.faces || [["AL", 0], ["MR", 1], ["JS", 2]]
        end.innerHTML = `<span class="c-faces">${faces.map(([n, i]) => L.face(n, i)).join("")}</span>${icon("bell", 24)}`
        const nav = h("div", { class: "c-app-nav", style: { top: `${topH}px`, width: `${navW}px` } }, el)
        h("div", { class: "c-nav-sec" }, nav, o.section || "Workspace")
        const navList = o.nav || [["home", "Home"], ["inbox", "Inbox", 4], ["grid", "Projects"], ["chart", "Reports"], ["settings", "Settings"]]
        const items = navList.map(([ic, label, n], i) => {
          const it = h("div", { class: `c-nav-item ${i === (o.active ?? 0) ? "on" : ""}` }, nav)
          it.innerHTML = `${icon(ic, 22)}<span>${label}</span>${n ? `<b>${n}</b>` : ""}`
          return it
        })
        const body = h("div", { class: "c-app-body", style: { left: `${navW}px`, top: `${topH}px` } }, el)
        const box = { x: o.x + navW, y: o.y + topH, w: o.w - navW, h: o.h - topH }
        if (o.at !== undefined) {
          Kit.enter(v, el, o.at, { y: 90, dur: 1.1, ease: "rise" })
          Kit.tilt(v, el, o.at, 1.4, {}, { from: { rx: 16, ry: o.x > v.W / 2 ? -14 : 14 }, origin: "50% 100%" })
        }
        return { el, top, logo, nav, items, body, box }
      }

      /** A heading inside a card or app body, with an optional quiet line under it. o: { x, y, size, sub } */
      L.heading = (parent, text, o = {}) => {
        const el = h("div", { class: "c-h", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, fontSize: o.size ? `${o.size}px` : undefined } }, parent, text)
        if (o.sub) h("small", {}, el, o.sub)
        return el
      }
      /** A segmented control. o: { x, y, on } → el */
      L.tabs = (parent, list, o = {}) => {
        const el = h("div", { class: "c-tabs", style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px` } }, parent)
        list.forEach((t, i) => h("span", { class: i === (o.on ?? 0) ? "on" : "" }, el, t))
        return el
      }

      /** A button. o: { x, y, primary, icon, iconAfter, cls } */
      L.button = (parent, text, o = {}) => {
        const el = h("div", { class: `c-btn ${o.primary ? "primary" : ""} ${o.cls || ""}`, style: { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px` } }, parent)
        el.innerHTML = `${o.icon ? icon(o.icon, 20) : ""}<span>${text}</span>${o.iconAfter ? icon(o.iconAfter, 22) : ""}`
        return el
      }
      /** A press on a button (down and back): pair it with a cursor click. */
      L.press = (el, at) => tl.to(el, { scale: 0.94, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" }, at)

      /** A status chip as HTML (for table cells). kind: "accent" | "gain" | "loss" | "warn" | "" */
      L.chip = (text, kind = "") => `<span class="c-chip ${kind}">${text}</span>`

      /**
       * A task table: rows slide in, can re-sort, and rows can be ticked off.
       * rows: [{ task, who: ["AL", 0, "Alma"], due: ["Today", "loss"], pct: 0.6, done }]
       * o: { x, y, w, rowH, at, sortAt, sortBy, desc, cols } → Kit.table result + .tick(row, at) + .light(row, at)
       */
      L.tasks = (parent, o) => {
        const w = o.w
        const cols = o.cols || [
          { label: "Task", key: "task", w: w * 0.42, fmt: (t, d) => `<span class="c-task"><span class="c-box ${d.done ? "done" : ""}">${d.done ? icon("check", 18, "currentColor", 3) : ""}</span>${t}</span>` },
          { label: "Owner", key: "who", w: w * 0.2, fmt: (p) => `<span class="c-who">${L.face(p[0], p[1])}${p[2] || ""}</span>` },
          { label: "Due", key: "due", w: w * 0.17, fmt: (d) => L.chip(d[0], d[1]) },
          { label: "Progress", key: "pct", w: w * 0.21, fmt: (p) => `<span class="c-bar"><i style="width:${Math.round(p * 100)}%"></i></span><span class="c-pct">${Math.round(p * 100)}%</span>` },
        ]
        const T = Kit.table(v, parent, Object.assign({ rowH: 72, headH: 46 }, o, { cols, cls: `c-table ${o.cls || ""}` }))
        /** Tick a row's box: it fills green and a check draws. */
        T.tick = (row, at) => {
          const b = row.el.querySelector(".c-box")
          const ck = h("span", { style: { display: "grid", placeItems: "center" } }, b)
          ck.innerHTML = icon("check", 18, "currentColor", 3)
          tl.set(ck, { scale: 0 }, 0)
          tl.to(b, { backgroundColor: L.colors.gain, boxShadow: "inset 0 0 0 0px rgba(0,0,0,0)", duration: 0.2, ease: "none" }, at)
          tl.to(ck, { scale: 1, duration: 0.4, ease: "land" }, at + 0.05)
          v.sfx("pop", at, { gain: -8, pitch: 1.2 })
        }
        /** Light a row with an accent band that wipes across it. */
        T.light = (row, at, out) => {
          const hi = h("div", { class: "c-hi", style: { top: "4px", bottom: "4px" } }, row.el)
          row.el.insertBefore(hi, row.el.firstChild)
          tl.set(hi, { scaleX: 0 }, 0)
          tl.to(hi, { scaleX: 1, duration: 0.5, ease: "glide" }, at)
          if (out !== undefined) tl.to(hi, { autoAlpha: 0, duration: 0.4 }, out)
          return hi
        }
        return T
      }

      /**
       * KPI tiles: an icon, a label, a number that rolls into place, a change chip and a sparkline.
       * items: [{ label, icon, value: "1,284", sub, delta: "18%", down, spark: [numbers] }]
       * o: { x, y, w, h, gap, at, each } → { el, tiles }
       */
      L.kpis = (parent, items, o) => {
        const gap = o.gap ?? 24
        const el = h("div", { class: "kpis c-kpis", style: { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w}px`, gap: `${gap}px`, gridTemplateColumns: `repeat(${items.length}, 1fr)` } }, parent)
        const colW = (o.w - gap * (items.length - 1)) / items.length
        const size = Math.min(o.max ?? 72, ...items.map((it) => Kit.fit(v, it.value, colW - 56, "kpi-value", { style: { fontFamily: "Outfit", fontWeight: 640, letterSpacing: "-0.035em" } })))
        const tiles = items.map((it, i) => {
          const tile = h("div", { class: "kpi", style: { height: o.h ? `${o.h}px` : undefined } }, el)
          h("div", { class: "kpi-label" }, tile).innerHTML = `<i>${icon(it.icon || "chart", 22)}</i><span>${it.label}</span>`
          const val = h("div", { class: "kpi-value", style: { fontSize: `${size}px` } }, tile, it.value)
          h("div", { class: "kpi-sub" }, tile, it.sub || "")
          const t0 = (o.at ?? 0) + i * (o.each ?? 0.14)
          if (o.at !== undefined) {
            Kit.roll(v, val, it.value, t0 + 0.1, { dur: 1.1 })
            v.sfx("tick", t0 + 0.1, { pitch: 0.95 + i * 0.08, gain: -6 })
          }
          let chip = null
          if (it.delta) {
            chip = h("div", { class: `c-delta ${it.down ? "down" : ""}` }, tile)
            chip.innerHTML = `${icon(it.down ? "down" : "up", 16, "currentColor", 2.6)}<span>${it.delta}</span>`
            if (o.at !== undefined) {
              tl.set(chip, { autoAlpha: 0 }, 0)
              tl.fromTo(chip, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "land", immediateRender: false }, t0 + 0.9)
            }
          }
          if (it.spark) {
            const sw = Math.min(150, colW * 0.36)
            const sh = 56
            const svg = h("svg", { class: "c-spark", width: sw, height: sh, viewBox: `0 0 ${sw} ${sh}`, style: { right: "26px", bottom: "26px" } }, tile)
            Kit.lineChart(v, h("g", {}, svg), { x: 2, y: 4, w: sw - 4, h: sh - 8, values: it.spark, at: t0 + 0.4, dur: 1, grid: -1, dot: 5, min: Math.min(...it.spark) * 0.9 })
          }
          return { tile, val, chip }
        })
        if (o.at !== undefined) Kit.enter(v, tiles.map((t) => t.tile), o.at, { y: 40, each: o.each ?? 0.14, dur: 0.8, ease: "rise" })
        return { el, tiles, size }
      }

      /**
       * A chart card: a line chart that draws itself over a dotted grid, axis labels,
       * a guide line and a value tag on one point, and an optional quiet comparison line.
       * o: { x, y, w, h, title, note, values, compare, at, dur, min, max, labels: [..], tag: "81", tagLabel, tagAt: index }
       */
      L.chart = (parent, o) => {
        const el = Kit.card(parent, { x: o.x, y: o.y, w: o.w, h: o.h, cls: "c-chart" })
        const head = h("div", { class: "c-chart-head" }, el)
        head.innerHTML = `${o.title || ""}${o.note ? `<span>${o.note}</span>` : ""}`
        const svg = h("svg", { width: o.w, height: o.h, viewBox: `0 0 ${o.w} ${o.h}` }, el)
        const g = h("g", {}, svg)
        const pad = { l: 40, r: 40, t: 100, b: 58 }
        const box = { x: pad.l, y: pad.t, w: o.w - pad.l - pad.r, h: o.h - pad.t - pad.b }
        if (o.compare) {
          // a quiet dotted line, uncovered left to right (a mask, so the dots stay dots)
          const mx = o.max ?? Math.max(...o.values)
          const mn = o.min ?? 0
          const pts = o.compare.map((val, i) => [box.x + (i / (o.compare.length - 1)) * box.w, box.y + box.h - ((val - mn) / (mx - mn || 1)) * box.h])
          const id = v.uid("cmp")
          const clip = h("rect", { x: box.x - 10, y: box.y - 20, width: 0, height: box.h + 40 }, h("clipPath", { id }, v.defs))
          h("path", { d: Kit.smooth(pts), fill: "none", stroke: "#98A2B6", "stroke-width": 3.5, "stroke-dasharray": "1 10", "stroke-linecap": "round", "clip-path": `url(#${id})` }, g)
          tl.fromTo(clip, { attr: { width: 0 } }, { attr: { width: box.w + 20 }, duration: o.dur ?? 1.4, ease: "inout", immediateRender: false }, o.at - 0.1)
        }
        const C = Kit.lineChart(v, g, Object.assign({}, box, { values: o.values, at: o.at, dur: o.dur ?? 1.4, min: o.min, max: o.max, grid: o.grid ?? 4 }))
        if (o.labels) {
          o.labels.forEach((txt, i) => {
            const x = pad.l + (i / (o.labels.length - 1)) * box.w
            const a = h("div", { class: "c-axis", style: { top: `${o.h - pad.b + 20}px`, left: `${x}px` } }, el, txt)
            a.style.transform = i === 0 ? "none" : i === o.labels.length - 1 ? "translateX(-100%)" : "translateX(-50%)"
          })
        }
        let tag = null
        if (o.tag) {
          const idx = o.tagAt ?? C.pts.length - 1
          const [lx, ly] = C.pts[idx]
          const guide = h("path", { d: `M${lx},${ly}V${pad.t + box.h}`, stroke: "var(--accent)", "stroke-width": 2, "stroke-dasharray": "3 6", opacity: 0.5 }, g)
          Kit.hideUntil(v, guide, C.end)
          tl.fromTo(guide, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.4, immediateRender: false }, C.end)
          tag = h("div", { class: "c-tag", style: { left: `${lx}px`, top: `${ly}px` } }, el)
          tag.innerHTML = `${o.tagLabel ? `<small>${o.tagLabel}</small>` : ""}${o.tag}`
          const right = lx > o.w * 0.7
          G.set(tag, { xPercent: right ? -100 : 0, x: right ? -22 : 22, yPercent: -50 })
          tl.set(tag, { autoAlpha: 0 }, 0)
          tl.fromTo(tag, { autoAlpha: 0, y: 14, scale: 0.85 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "land", immediateRender: false }, C.end + 0.05)
          v.sfx("pop", C.end + 0.05, { gain: -6 })
        }
        return Object.assign(C, { el, tag })
      }

      /**
       * The assistant side panel (a spark mark, no face). o: { w, name }
       * → { el, ask(at, text), answer(at, text, cps), steps(at, [[text, meta], …]) }
       */
      L.assistant = (parent, o = {}) => {
        const el = h("div", { class: "c-assist", style: { width: `${o.w ?? 420}px` } }, parent)
        h("div", { class: "c-assist-head" }, el).innerHTML = `<span class="c-spark-ico">${icon("spark", 20, "currentColor", 2)}</span><span>${o.name || "Assistant"}</span><small>Online</small>`
        const msgs = h("div", { class: "c-msgs" }, el)
        const bubble = (kind, text) => {
          const b = h("div", { class: `c-msg ${kind}` }, msgs)
          h("span", { class: "ghost" }, b, text)
          return { b, typed: h("span", { class: "typed" }, b) }
        }
        const caret = (parentEl, from, to) => {
          const c = h("span", { class: "c-caret" }, parentEl)
          v.onFrame((t) => {
            const on = t >= from && t < to && Math.floor((t - from) * 2.2) % 2 === 0
            c.style.visibility = on ? "visible" : "hidden"
          })
        }
        return {
          el,
          ask(at, text, cps = 36) {
            const { b, typed } = bubble("user", text)
            Kit.enter(v, b, at, { y: 18, scale: 0.96, dur: 0.5, ease: "land" })
            v.sfx("key", at + 0.1, { gain: -10 })
            return Kit.typeOn(v, typed, text, at + 0.12, cps)
          },
          answer(at, text, cps = 64) {
            const { b, typed } = bubble("bot", text)
            Kit.enter(v, b, at, { y: 18, dur: 0.5, ease: "rise" })
            const txt = h("span", {}, typed)
            const end = Kit.typeOn(v, txt, text, at + 0.25, cps)
            caret(typed, at + 0.2, end + 0.6)
            return end
          },
          steps(at, list) {
            const els = list.map((s, i) => {
              const [text, meta] = Array.isArray(s) ? s : [s, ""]
              const row = h("div", { class: "c-step" }, msgs)
              row.innerHTML = `<i>${i + 1}</i><span>${text}</span>${meta ? `<em>${meta}</em>` : ""}`
              const num = row.querySelector("i")
              const t0 = at + 0.5 + i * 0.3
              tl.to(num, { backgroundColor: L.colors.gain, color: "#fff", duration: 0.2, ease: "none" }, t0)
              v.sfx("tick", t0, { gain: -10, pitch: 1.1 + i * 0.08 })
              return row
            })
            Kit.enter(v, els, at, { y: 16, dur: 0.5, each: 0.12, ease: "rise" })
            return at + 0.5 + 0.3 * list.length
          },
        }
      }

      /** A toast that slides up and leaves. o: { x, y, at, out, icon } */
      L.toast = (parent, text, o) => {
        const el = h("div", { class: "c-toast", style: { left: `${o.x}px`, top: `${o.y}px` } }, parent)
        el.innerHTML = `<span class="c-spark-ico">${icon(o.icon || "check", 20, "currentColor", 2.6)}</span><span>${text}</span>`
        Kit.enter(v, el, o.at, { y: 36, scale: 0.94, dur: 0.6, ease: "land" })
        v.sfx("chime", o.at, { gain: -8 })
        if (o.out !== undefined) tl.to(el, { autoAlpha: 0, y: 14, duration: 0.35, ease: "power2.in" }, o.out)
        return el
      }

      /**
       * A snippet card from another app (a mail, a chat, a doc): for "too many places" shots.
       * o: { x, y, icon, color, app, title, sub, time, badge, w } → el
       */
      L.snippet = (parent, o) => {
        const el = Kit.card(parent, { x: o.x, y: o.y, w: o.w, cls: "c-src c-lift" })
        el.innerHTML = `<span class="c-app-ico" style="background:${o.color || "var(--accent)"}">${icon(o.icon || "inbox", 28, "currentColor", 2.2)}</span><b>${o.title}</b><span>${o.sub || ""}</span>${o.time ? `<em>${o.time}</em>` : ""}`
        if (o.badge) h("span", { class: "c-dot" }, el.querySelector(".c-app-ico"), String(o.badge))
        el.querySelector(".c-app-ico").style.position = "relative"
        return el
      }

      /**
       * Match cut: `el` flies onto `target` (any two elements on the stage) and lands
       * at its size; `el` hides and `target` shows when it lands. Returns the end time.
       */
      L.flyTo = (el, target, at, o = {}) => {
        const a = Kit.box(el, v.stage)
        const b = Kit.box(target, v.stage)
        const s = (o.byWidth ? b.w / a.w : b.h / a.h) || 1
        const dur = o.dur ?? 0.8
        Kit.fly(v, el, at, { x: 0, y: 0, s: 1 }, { x: b.x + b.w / 2 - (a.x + a.w / 2), y: b.y + b.h / 2 - (a.y + a.h / 2), s }, { dur, ease: o.ease || "glide" })
        tl.set(target, { autoAlpha: 0 }, 0)
        tl.set(target, { autoAlpha: 1 }, at + dur)
        tl.set(el, { autoAlpha: 0 }, at + dur)
        return at + dur
      }

      /**
       * The end card in shot A: logo, name, a light tagline, a CTA with a sheen, a cursor click.
       * o: { name, tagline, cta, url, at, click } → { logo, tagline, cta, url, cursor }
       */
      L.endCard = (A, o) => {
        const at = o.at
        const cx = v.W / 2
        const p = A.P.mid.el
        const nameSize = o.nameSize ?? 168
        const markSize = nameSize * 0.84
        const logo = L.logo(p, { size: markSize, name: o.name, nameSize, gap: nameSize * 0.22 })
        const lw = Kit.measure(v, o.name, "c-logo-name", { fontFamily: "Outfit", fontWeight: 680, letterSpacing: "-0.045em" }) * (nameSize / 100) + markSize + nameSize * 0.22
        const top = v.H * 0.5 - markSize * 1.05
        Object.assign(logo.el.style, { left: `${cx - lw / 2}px`, top: `${top}px` })
        const tagY = top + markSize + 48
        const tag = h("div", { class: "c-tagline", style: { left: "0px", width: `${v.W}px`, top: `${tagY}px` } }, p, o.tagline || "")
        const cta = L.button(p, o.cta || "Get started", { primary: true, iconAfter: "arrow", cls: "c-cta" })
        const cw = cta.offsetWidth
        const ctaY = tagY + 92
        Object.assign(cta.style, { left: `${cx - cw / 2}px`, top: `${ctaY}px` })
        let url = null
        if (o.url) url = h("div", { class: "c-url", style: { left: "0px", width: `${v.W}px`, top: `${ctaY + 78 + 34}px` } }, p, o.url)
        L.logoIn(logo, at)
        Kit.enter(v, tag, at + 0.35, { y: 22, dur: 0.8, ease: "rise" })
        Kit.enter(v, cta, at + 0.5, { y: 22, scale: 0.94, dur: 0.8, ease: "land" })
        if (url) Kit.enter(v, url, at + 0.65, { y: 12, dur: 0.7, ease: "rise" })
        Kit.sheen(v, cta, at + 1.0, { dur: 1 })
        Kit.leak(v, at + 0.1, { dur: 1.6, color: "rgba(255,255,255,0.7)" })
        const cursor = Kit.cursor(v, A.P.fg.g)
        const clickAt = o.click ?? at + 1.6
        const target = [cx + cw * 0.2, ctaY + 52]
        cursor.glide(clickAt - 0.8, [v.W * 0.8, v.H * 1.02], target, 0.75)
        cursor.click(clickAt, target[0], target[1])
        L.press(cta, clickAt)
        return { logo, tagline: tag, cta, url, cursor }
      }

      /** A cursor (in an SVG plane group, e.g. A.P.fg.g): .glide, .click, .leave */
      L.cursor = (g) => Kit.cursor(v, g)

      // ── transitions ──
      L.push = (A, B, at, o = {}) => Kit.push(v, A, B, at, Object.assign({ dir: "left", dur: 0.7 }, o))
      L.whip = (A, B, at, o = {}) => Kit.whip(v, A, B, at, Object.assign({ dir: "left", dur: 0.55 }, o))
      L.zoomThrough = (A, B, at, x, y, o = {}) => Kit.zoomThrough(v, A, B, at, x, y, Object.assign({ zoom: 6, dur: 0.6 }, o))
      L.fly = (el, at, from, to, o = {}) => Kit.fly(v, el, at, from, to, o)
      /** A curved accent wave crosses the frame, then a pale one; swap shots at .mid. o: { dir, kind, colors } */
      L.wipe = (at, o = {}) => Kit.wipe(v, at, Object.assign({ kind: "wave", dir: "right", colors: ["var(--accent)", "#dce4ff"], dur: 0.85 }, o))
      /** Ink and accent panels sweep across; swap shots at .mid. */
      L.panels = (at, o = {}) => Kit.panels(v, at, Object.assign({ colors: ["var(--ink)", "var(--accent)"], dir: "left", dur: 0.45, each: 0.09 }, o))

      return L
    },
  })
})()
