/*
 * Hush, a reel in the Bold look (9:16, 14 s, no voice).
 *   1 · every ping   notifications pile up behind a huge poster headline
 *   2 · meet Hush    a dive into the last word opens on the phone: tap Start, the ring starts
 *   3 · pings wait   new notifications fly into the phone and are held for later
 *   4 · the number   a slanted wipe to a big rolling number and a week of bars (sample data)
 *   5 · end card     a whip up to the logo, the line and the button
 * The product, names and numbers are all made up.
 */
Kit.start(window.VIDEO, (v) => {
  const L = Kit.use(v, "bold")
  const { safe, W } = v
  const tl = v.tl
  const G = window.gsap
  const h = Kit.h
  Kit.finish(v, { grain: 0.06, vignette: 0.5 })

  const APPS = [
    ["send", "#2f8cff", "Team chat", "3 new messages", "now"],
    ["inbox", "#ff5a4f", "Mail", "Re: quick question", "1m"],
    ["users", "#8f5bff", "Social", "Sam liked your post", "2m"],
    ["card", "#18b07a", "Bank", "Payment received", "4m"],
    ["bell", "#ff9f1c", "Reminders", "Water the plants", "6m"],
    ["play", "#ff3d8b", "Video", "New episode is out", "9m"],
  ]

  // ── 1 · every ping (0 – 2.75): frame 0 is already the poster ──────────
  const A = L.shot("ping")
  Kit.show(v, A.S, 0)
  L.kicker(A.P.mid.el, "Sound familiar?", { y: 262 })
  const T1 = L.big(A.P.mid.el, [{ text: "Every", kind: "lite", max: 170 }, { text: "ping", kind: "accent", max: 330 }, "breaks your", { text: "focus.", max: 330 }], { y: 330 })
  const ping = T1.lines[1].el
  // notifications pile up behind the words, out of focus (decoration: the layout check skips them)
  APPS.forEach(([ic, color, title, sub, time], i) => {
    const n = L.notif(A.P.bg.el, { x: i % 2 ? 340 : 80, y: 1390 + i * 92, icon: ic, color, title, sub, time })
    n.classList.add("no-check")
    G.set(n, { transformPerspective: 1600, rotationY: i % 2 ? -16 : 16, rotation: i % 2 ? 3 : -3 })
    const t0 = i < 2 ? 0 : 0.05 + (i - 1) * 0.36
    if (i < 2) return G.set(n, { autoAlpha: 0.9 })
    tl.fromTo(n, { autoAlpha: 0, y: -120, scale: 0.9 }, { autoAlpha: 0.9, y: 0, scale: 1, duration: 0.6, ease: "land", immediateRender: true }, t0)
    // each ping makes the word jump
    tl.fromTo(ping, { scale: 1 }, { scale: 1.05, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out", transformOrigin: "0% 60%", immediateRender: false }, t0 + 0.05)
    v.sfx("tick", t0 + 0.05, { gain: -6, pitch: 1 + i * 0.07 })
  })
  Kit.focus(v, A.P.bg.el, 0, { from: 6, blur: 6, dur: 0.01 })
  A.P.drift(0, 2.8, { x: 0, y: -24, zoom: 1.03, from: { x: 0, y: 10 } })

  // ── 2 · meet Hush (dive into "focus.", 2.75 – 5.6) ────────────────────
  const B = L.shot("phone", { scenery: "rays" })
  const last = T1.lines[3]
  const lb = Kit.box(last.el.querySelector(".ln"), v.stage)
  L.zoomThrough(A, B, 2.6, lb.x + lb.w * 0.35, lb.y + lb.h * 0.5)
  const k2 = L.kicker(B.P.mid.el, "Meet", { y: 252, at: 3.15 })
  const T2 = L.big(B.P.mid.el, [{ text: "Hush.", kind: "accent", max: 220 }], { y: 316, at: 3.2 })
  const sub2 = L.big(B.P.mid.el, [{ text: "one tap to deep focus", kind: "lite", max: 60 }], { y: 316 + T2.h + 24, at: 3.5 })

  const ph = L.phone(B.P.mid.el, { x: (W - 520) / 2, y: 640, w: 520, at: 3.1 })
  const scr = ph.screen
  const cx = ph.sw / 2
  L.screenText(scr, "9:41", { x: 40, y: 26, size: 24, cls: "b-scr-h" })
  L.screenText(scr, "Deep work", { x: 40, y: 104, size: 42, cls: "b-scr-h" })
  L.screenText(scr, "Session 2 of 4", { x: 40, y: 158, size: 25, cls: "b-scr-m" })
  const rg = v.svg(scr)
  rg.parentNode.setAttribute("viewBox", `0 0 ${ph.sw} ${ph.sh}`)
  const R = Kit.ring(v, rg, { cx, cy: 470, r: 160, w: 22, value: 1, at: 3.7, dur: 0.9 })
  // after Start, the ring drains slowly as the session runs
  tl.to(R.arc, { drawSVG: "0% 97%", duration: 9, ease: "none" }, 4.75)
  const timer = L.screenText(scr, "25:00", { x: 0, y: 400, w: ph.sw, size: 118, cls: "b-timer", align: "center" })
  v.onFrame((t) => {
    const left = Math.max(0, 25 * 60 - Math.max(0, t - 4.75) * 1)
    timer.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(Math.floor(left % 60)).padStart(2, "0")}`
  })
  // a tab bar of icons at the bottom of the screen
  const tabs = h("div", { style: { position: "absolute", left: "0", right: "0", top: `${ph.sh - 120}px`, display: "flex", justifyContent: "space-around", color: "rgba(244,245,240,0.45)" } }, scr)
  tabs.innerHTML = ["clock", "chart", "bell", "settings"].map((n, i) => `<span style="color:${i === 0 ? "#C8FF2E" : "inherit"}">${Kit.icon(n, 40, "currentColor", 2)}</span>`).join("")
  const start = L.button(scr, "Start", { x: cx - 150, y: 680, w: 300, h: 92, size: 32 })
  const sb = Kit.box(start, v.stage)
  L.tap(start, 4.65, sb.x + sb.w / 2, sb.y + sb.h / 2, B.P.fg.g)
  v.onFrame((t) => (start.textContent = t >= 4.75 ? "Focusing" : "Start"))
  tl.to(start, { backgroundColor: "rgba(244,245,240,0.1)", color: "#F4F5F0", boxShadow: "inset 0 0 0 2px rgba(244,245,240,0.25)", duration: 0.25, ease: "none" }, 4.75)
  // the held-for-later pill, empty until the first ping arrives
  const held = h("div", { class: "b-held", style: { left: "40px", top: "214px", height: "58px", fontSize: "25px" } }, scr)
  const heldN = h("i", { style: { width: "36px", height: "36px", fontSize: "20px" } }, held, "0")
  h("span", {}, held, "held for later")
  tl.set(held, { autoAlpha: 0 }, 0)
  // the camera: one smooth move from where the dive lands (3.84 s) down to the phone, no stops
  B.P.path([{ t: 3.84 }, { t: 5.6, zoom: 1.015, y: -8 }, { t: 8.6, ...B.P.aim(540, 1420, 1.05) }])

  // ── 3 · pings wait (5.6 – 8.55): one take, the words change ───────────
  T2.out(5.5)
  Kit.clipOut(v, k2, 5.45, { from: "left", dur: 0.35 })
  sub2.out(5.5)
  L.kicker(B.P.mid.el, "While you focus", { y: 252, at: 5.9 })
  const T3 = L.big(B.P.mid.el, [{ text: "Pings wait.", max: 220 }], { y: 316, at: 6.0 })
  const sub3 = L.big(B.P.mid.el, [{ text: "nothing buzzes until you are done", kind: "lite", max: 60 }], { y: 316 + T3.h + 24, at: 6.3 })
  void sub3
  tl.fromTo(held, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "land", immediateRender: false }, 6.35)
  const target = Kit.box(held, v.stage)
  APPS.slice(0, 5).forEach(([ic, color, title, sub, time], i) => {
    const fromLeft = i % 2 === 0
    const n = L.notif(B.P.fg.el, { x: fromLeft ? -760 : W + 120, y: 980 + (i % 3) * 120, icon: ic, color, title, sub, time })
    n.classList.add("no-check")
    const nb = { x: fromLeft ? -760 : W + 120, y: 980 + (i % 3) * 120, w: 640, h: 128 }
    const t0 = 6.4 + i * 0.36
    tl.set(n, { autoAlpha: 0 }, 0)
    tl.set(n, { autoAlpha: 1 }, t0)
    tl.fromTo(n, { x: 0, y: 0, scale: 1, rotation: fromLeft ? -8 : 8 }, { x: target.x + 30 - (nb.x + nb.w / 2), y: target.y + 29 - (nb.y + nb.h / 2), scale: 0.08, rotation: 0, duration: 0.55, ease: "power3.in", immediateRender: false }, t0)
    tl.set(n, { autoAlpha: 0 }, t0 + 0.55)
    tl.fromTo(held, { scale: 1 }, { scale: 1.08, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.out", transformOrigin: "20% 50%", immediateRender: false }, t0 + 0.55)
    v.sfx("swish", t0 + 0.1, { gain: -9, pitch: 1 + i * 0.05 })
    v.sfx("pop", t0 + 0.55, { gain: -8, pitch: 1.2 + i * 0.05 })
  })
  v.onFrame((t) => (heldN.textContent = String(Math.max(0, Math.min(5, Math.floor((t - 6.4 - 0.55) / 0.36) + 1)))))

  // ── 4 · the number (slanted wipe, 8.55 – 11.3) ─────────────────────────
  const w1 = L.wipe(8.3)
  const C = L.shot("number", { scenery: "stars" })
  Kit.show(v, C.S, w1.mid)
  Kit.hide(v, B.S, w1.mid)
  L.kicker(C.P.mid.el, "Sample data", { y: 262, at: w1.mid + 0.1 })
  const N = L.count(C.P.mid.el, { y: 320, value: "+4.5", suffix: " h", at: w1.mid + 0.15, max: 360 })
  L.big(C.P.mid.el, [{ text: "more deep work", kind: "lite", max: 80 }, { text: "every week", kind: "lite", max: 80 }], { y: 320 + N.size * 1.02, at: w1.mid + 0.5 })
  const bg = v.svg(C.P.mid.el)
  const vals = [2.1, 2.8, 2.4, 3.3, 3.9, 3.1, 4.5]
  const bx = safe.x + 10
  const bwid = safe.w - 20
  L.bars = Kit.bars(v, bg, { x: bx, y: 1000, w: bwid, h: 360, values: vals, at: w1.mid + 0.6, max: 5, gap: 0.45, hi: 6, radius: 16 })
  ;["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => {
    const step = bwid / (7 + 6 * 0.45)
    const el = h("div", { class: "b-axis", style: { left: `${bx + i * step * 1.45}px`, top: "1384px", width: `${step}px` } }, C.P.mid.el, d)
    Kit.enter(v, el, w1.mid + 0.7 + i * 0.05, { y: 12, dur: 0.5 })
  })
  C.P.drift(w1.mid, 11.4 - w1.mid, { x: 0, y: -20, zoom: 1.05, from: { x: 0 } })

  // ── 5 · end card (whip up, 11.3 – 14) ───────────────────────────────────
  const D = L.shot("end", { scenery: "rays" })
  L.whip(C, D, 11.2)
  const end = L.endCard(D, { name: "Hush", tagline: "Quiet phone. Loud work.", cta: "Try it free", at: 11.42, tap: 13.2 })
  const url = h("div", { class: "b-tag", style: { left: "0px", width: `${W}px`, top: `${end.cta.offsetTop + 170}px`, fontSize: "30px", letterSpacing: "0.12em" } }, D.P.mid.el, "HUSH.EXAMPLE")
  Kit.enter(v, url, 12.3, { y: 14, dur: 0.7, ease: "rise" })
  D.P.drift(11.2, 2.8, { x: 0, y: -16, zoom: 1.04, from: { x: 0 } })
})
