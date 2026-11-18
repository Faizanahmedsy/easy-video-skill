/*
 * Tidy, a product video in the Clean look (16:9, 18.5 s, no voice).
 * Six shots: the problem → the product → feature 1 (sort) → feature 2 (assistant)
 * → the numbers → the end card. Every name and number on screen is made up.
 */
Kit.start(window.VIDEO, (v) => {
  const L = Kit.use(v, "clean")
  const { safe } = v
  const tl = v.tl
  Kit.finish(v, { grain: 0.035, vignette: 0.12 })

  // the same five tasks in every app shot (d = days until due, for sorting)
  const TASKS = [
    { task: "Draft launch notes", team: "Design", due: "Thu", d: 3, st: ["In progress", "accent"] },
    { task: "Fix sign-in bug", team: "Web", due: "Today", d: 0, st: ["Urgent", "loss"] },
    { task: "Update price page", team: "Web", due: "Fri", d: 4, st: ["To do", ""] },
    { task: "Review Q3 budget", team: "Ops", due: "Tomorrow", d: 1, st: ["To do", ""] },
    { task: "Plan team offsite", team: "People", due: "Wed", d: 2, st: ["Waiting", ""] },
  ]
  const cols = (w) => [
    { label: "Task", key: "task", w: w * 0.43 },
    { label: "Team", key: "team", w: w * 0.17 },
    { label: "Due", key: "due", w: w * 0.18 },
    { label: "Status", key: "st", w: w * 0.22, fmt: (s) => L.chip(s[0], s[1]) },
  ]

  // ── 1 · the problem (0 – 3.3) ──
  const A = L.shot("problem")
  Kit.show(v, A.S, 0)
  L.label(A.P.mid.el, "Sound familiar?", { x: safe.x, y: 330, at: 0.1 })
  const t1 = L.title(A.P.mid.el, "Your tasks live|in *ten places.*", { x: safe.x, y: 384, size: 116, w: 900 })
  Kit.reveal(v, t1, 0.2, { by: "words" })
  Kit.mark(v, t1.em[0], 1.05, { kind: "bar" })
  const NOTES = [
    ["Email", "Reply to the design review", 1080, 170, -4],
    ["Chat", "Send the launch deck", 1300, 300, 3],
    ["Notes", "Book the meeting room", 1040, 440, 2],
    ["Sheet", "Update the Q3 budget", 1330, 580, -3],
    ["Sticky", "Call the print shop", 1090, 720, -2],
    ["Docs", "Fix the price page", 1350, 850, 4],
  ]
  const notes = NOTES.map(([tag, text, x, y, r]) => L.note(A.P.fg.el, text, { tag, x, y, rotate: r }))
  Kit.enter(v, notes, 0.45, { y: 50, scale: 0.85, each: 0.11, dur: 0.55, ease: "pop" })
  notes.forEach((_, i) => v.sfx("pop", 0.45 + i * 0.11, { gain: -10, pitch: 0.9 + i * 0.05 }))
  Kit.float(v, notes, { y: -10 }, { period: 2.6 })
  A.P.move(0, 3.4, { zoom: 1.05 }, { from: { zoom: 1 } })

  // panels sweep across; the product appears behind them
  const pan = L.panels(2.75)
  const B = L.shot("reveal")
  Kit.show(v, B.S, pan.mid)
  Kit.hide(v, A.S, pan.mid)

  // ── 2 · the product (3.3 – 6.0): the logo flies into the app's top bar ──
  const app1 = L.app(B.P.mid.el, { x: 260, y: 300, w: 1400, h: 860, name: "Tidy", search: "Search tasks", at: 4.05 })
  L.heading(app1.body, "This week", { x: 36, y: 30 })
  const t2tbl = L.table(app1.body, { x: 36, y: 100, w: app1.box.w - 72, cols: cols(app1.box.w - 72), rows: TASKS, at: 4.6 })
  void t2tbl
  const big = L.logo(B.P.fg.el, { size: 132, name: "Tidy", nameSize: 150 })
  const bigW = big.el.offsetWidth
  Object.assign(big.el.style, { left: `${v.W / 2 - bigW / 2}px`, top: `${v.H / 2 - 66}px` })
  Kit.enter(v, big.mark, pan.mid + 0.05, { y: 0, scale: 0.5, dur: 0.5, ease: "pop" })
  Kit.enter(v, big.name, pan.mid + 0.15, { y: 0, x: -40, dur: 0.55 })
  // match cut: the big mark and name fly to the app's own mark and name
  const appName = app1.top.querySelector(".c-app-name")
  const flyTo = (el, target, at) => {
    const a = Kit.box(el, v.stage)
    const b = Kit.box(target, v.stage)
    const s = b.h / a.h
    L.fly(el, at, { x: 0, y: 0, s: 1 }, { x: b.x + b.w / 2 - (a.x + a.w / 2), y: b.y + b.h / 2 - (a.y + a.h / 2), s }, { dur: 0.8 })
  }
  flyTo(big.mark, app1.logo.mark, 4.2)
  flyTo(big.name, appName, 4.24)
  tl.set([app1.logo.mark, appName], { autoAlpha: 0 }, 0)
  tl.set([app1.logo.mark, appName], { autoAlpha: 1 }, 5.04)
  tl.set(big.el, { autoAlpha: 0 }, 5.04)
  const t2 = L.title(B.P.mid.el, "One calm list for *every task.*", { x: v.W / 2, y: 128, size: 92, w: 1700, align: "center" })
  Kit.reveal(v, t2, 4.5, { by: "words" })
  B.P.move(5.05, 1.2, { zoom: 1.03, y: -10 }, { from: { zoom: 1 } })

  // ── 3 · feature: sort the week (dive into the table) ──
  const C = L.shot("sort")
  const zt = L.zoomThrough(B, C, 5.95, 700, 640)
  void zt
  L.label(C.P.mid.el, "Plan", { x: safe.x, y: 330, at: 6.7 })
  const t3 = L.title(C.P.mid.el, "Sort the week|in *one click.*", { x: safe.x, y: 384, size: 88, w: 600 })
  Kit.reveal(v, t3, 6.75, { by: "words" })
  L.text(C.P.mid.el, "Tidy puts what is due first, so you know where to start.", { x: safe.x, y: 590, w: 500, at: 7.2 })
  const app2 = L.app(C.P.mid.el, { x: 740, y: 110, w: 1100, h: 860, name: "Tidy", search: "Search tasks", navW: 210 })
  L.heading(app2.body, "This week", { x: 32, y: 30 })
  const sortBtn = L.button(app2.body, "Sort by due", { icon: "clock", y: 26 })
  sortBtn.style.left = `${app2.box.w - 32 - sortBtn.offsetWidth}px`
  const tw = app2.box.w - 64
  L.table(app2.body, { x: 32, y: 100, w: tw, cols: cols(tw), rows: TASKS, at: 6.55, sortAt: 8.15, sortBy: "d", desc: false })
  const cur3 = L.cursor(C.P.fg.g)
  const sb = Kit.box(sortBtn, v.stage)
  const sx = sb.x + sb.w * 0.55
  const sy = sb.y + sb.h * 0.6
  cur3.glide(7.25, [1500, 900], [sx, sy], 0.7)
  cur3.click(8.0, sx, sy)
  L.press(sortBtn, 8.0)
  tl.to(sortBtn, { backgroundColor: "rgba(10,92,255,0.08)", color: "#0A5CFF", borderColor: "#0A5CFF", duration: 0.15, ease: "none" }, 8.02)
  cur3.leave(8.6, [1700, 1000])
  L.toast(app2.body, "5 tasks sorted by due date", { x: 32, y: 690, at: 8.75, out: 9.65 })

  // ── 4 · feature: ask the assistant (push left) ──
  const D = L.shot("assistant")
  L.push(C, D, 9.8)
  const app3 = L.app(D.P.mid.el, { x: 80, y: 110, w: 1160, h: 860, name: "Tidy", search: "Search tasks", navW: 210, active: 1 })
  L.heading(app3.body, "Today", { x: 32, y: 30 })
  const lw = app3.box.w - 440 - 64
  L.table(app3.body, {
    x: 32,
    y: 100,
    w: lw,
    cols: [
      { label: "Task", key: "task", w: lw * 0.66 },
      { label: "Due", key: "due", w: lw * 0.34 },
    ],
    rows: TASKS.slice(0, 4),
  })
  const ai = L.assistant(app3.body, { w: 440 })
  ai.ask(10.55, "What should I do first?")
  ai.answer(11.35, "Start with the sign-in bug. Two other tasks wait on it.")
  ai.steps(12.35, ["Fix sign-in bug", "Review Q3 budget", "Plan team offsite"])
  L.label(D.P.mid.el, "Ask", { x: 1330, y: 330, at: 10.4 })
  const t4 = L.title(D.P.mid.el, "What is next?|Get *a plan.*", { x: 1330, y: 384, size: 76, w: 520 })
  Kit.reveal(v, t4, 10.45, { by: "words" })
  L.text(D.P.mid.el, "The assistant reads your list and picks the order.", { x: 1330, y: 580, w: 470, at: 10.9 })

  // ── 5 · the numbers (push up) ──
  const E = L.shot("numbers")
  L.push(D, E, 13.3, { dir: "up" })
  L.label(E.P.mid.el, "Sample data", { x: safe.x, y: 96, at: 13.85 })
  const t5 = L.title(E.P.mid.el, "Teams get *more done*, every week.", { x: safe.x, y: 140, size: 72, w: 1680 })
  Kit.reveal(v, t5, 13.9, { by: "words" })
  L.kpis(
    E.P.mid.el,
    [
      { label: "Tasks done", to: 1284, sub: "this quarter", delta: "38%" },
      { label: "On time", to: 96, fmt: (n) => `${Math.round(n)}%`, sub: "of all due dates", delta: "11%" },
      { label: "Hours saved", to: 6.5, fmt: (n) => `${n.toFixed(1)} h`, sub: "per person, per week", delta: "2.1 h" },
    ],
    { x: safe.x, y: 268, w: safe.w, gap: 24, at: 14.1 },
  )
  L.chart(E.P.mid.el, {
    x: safe.x,
    y: 500,
    w: safe.w,
    h: 480,
    title: "Tasks done per week",
    note: "Last 12 weeks",
    values: [42, 45, 44, 51, 49, 56, 60, 58, 66, 71, 74, 81],
    min: 30,
    max: 90,
    at: 14.35,
    tag: "81 this week",
    labels: ["Week 1", "Week 12"],
  })

  // ── 6 · the end card (panels) ──
  const pan2 = L.panels(15.9)
  const F = L.shot("end")
  Kit.show(v, F.S, pan2.mid)
  Kit.hide(v, E.S, pan2.mid)
  L.endCard(F, { name: "Tidy", tagline: "Every task in its place.", cta: "Start free", url: "tidy.example", at: pan2.mid + 0.1, click: 17.75 })
  F.P.move(pan2.mid, 2.2, { zoom: 1.02 }, { from: { zoom: 1 } })
})
