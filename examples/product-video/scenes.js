/*
 * Tidy, a product video in the Clean look (16:9, 21.5 s, no voice).
 * Four shots, mostly one continuous take:
 *   1 · the problem   snippets from other apps float in depth, then collapse into the logo
 *   2 · the product   the logo lands in the app's top bar; Auto-plan sorts the week
 *   3 · the assistant a whip pan to the assistant, which answers and lists the steps
 *   4 · the numbers   a dive into a step opens the numbers; a wave wipe to the end card
 * Every name and number on screen is made up.
 */
Kit.start(window.VIDEO, (v) => {
  const L = Kit.use(v, "clean")
  const { safe } = v
  const tl = v.tl
  const G = window.gsap
  Kit.finish(v, { grain: 0.035, vignette: 0.16, tint: "rgb(40,50,90)" })

  // the same tasks in every app shot (d = days until due, for sorting)
  const TASKS = [
    { task: "Draft launch notes", who: ["AL", 0, "Alma"], due: ["Thu", "accent"], pct: 0.4, d: 3 },
    { task: "Fix sign-in bug", who: ["MR", 1, "Maya"], due: ["Today", "loss"], pct: 0.7, d: 0 },
    { task: "Update price page", who: ["KO", 3, "Kofi"], due: ["Fri", ""], pct: 0.2, d: 4 },
    { task: "Review Q3 budget", who: ["JS", 2, "Jon"], due: ["Tomorrow", "warn"], pct: 0.55, d: 1 },
    { task: "Plan team offsite", who: ["NB", 4, "Nora"], due: ["Wed", ""], pct: 0.1, d: 2 },
    { task: "Ship welcome emails", who: ["AL", 0, "Alma"], due: ["Mon", ""], pct: 0.85, d: 6 },
  ]

  // ── 1 · the problem (0 – 3.35) ──────────────────────────────────────────
  const A = L.shot("problem")
  Kit.show(v, A.S, 0)
  // frame 0 is a finished poster: the words and cards are already there, the motion plays on top
  L.eyebrow(A.P.mid.el, "Sound familiar?", { x: safe.x, y: 336 })
  const t1 = L.title(A.P.mid.el, "Your tasks live|^in ten places.^", { x: safe.x, y: 410, size: 122, w: 900 })
  const SNIPS = [
    // plane, x, y, tilt Y, turn, icon, colour, title, line, time, badge
    ["bg", 1180, 120, -16, -3, "inbox", "#4c7cf3", "Re: launch checklist", "Mail · 3 unread", "9:41", 3],
    ["mid", 1290, 300, -20, 2, "send", "#1fb57a", "Send me the deck?", "Chat · #launch", "9:52", 7],
    ["fg", 1020, 470, -12, -2, "card", "#F4A83A", "Budget v4 FINAL", "Docs · edited 2 min ago", "10:05"],
    ["bg", 1460, 560, -22, 3, "clock", "#f0577c", "Review at 4:00 pm", "Calendar · today", "10:10"],
    ["mid", 1180, 700, -15, -1, "grid", "#18a8a0", "Price page to-dos", "Sheets · 12 rows", "10:31"],
    ["fg", 1290, 860, -18, 2, "star", "#8b5cf6", "Call the print shop", "Notes · pinned", "11:02"],
  ]
  const snips = SNIPS.map(([pl, x, y, ry, rz, ic, color, title, sub, time, badge], i) => {
    const el = L.snippet(A.P[pl].el, { x, y, icon: ic, color, title, sub, time, badge, w: 470 })
    G.set(el, { transformPerspective: 1800, rotationY: ry, rotationX: 6, rotation: rz, scale: pl === "bg" ? 0.86 : pl === "fg" ? 1.06 : 1 })
    // each card floats forward and up on its own slow curve
    tl.fromTo(el, { z: -180, y: 40 }, { z: 0, y: -22 - (i % 3) * 10, duration: 2.7, ease: "sine.out", immediateRender: true }, 0)
    const dot = el.querySelector(".c-dot")
    if (dot) {
      tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.45, ease: "land", immediateRender: true }, 0.5 + i * 0.25)
      v.sfx("pop", 0.5 + i * 0.25, { gain: -10, pitch: 1.1 })
    }
    return { el, pl }
  })
  Kit.focus(v, A.P.bg.el, 0, { from: 7, blur: 7, dur: 0.01 })
  A.P.drift(0, 3.4, { x: 30, zoom: 1.05, from: { x: -10 } })
  // everything collapses into one point: the logo is born there
  const CX = v.W / 2
  const CY = 470
  snips.forEach(({ el }, i) => {
    const b = Kit.box(el, v.stage)
    tl.to(el, { x: CX - (b.x + b.w / 2), y: CY - (b.y + b.h / 2), scale: 0.12, rotationY: 0, rotation: 0, autoAlpha: 0, duration: 0.55, ease: "power3.in" }, 2.75 + i * 0.03)
  })
  Kit.unreveal(v, t1, 2.7, { by: "words", each: 0.03 })
  v.sfx("riser", 2.6, { dur: 0.8, gain: -8 })

  // ── 2 · the product (3.35 – 9.9): one continuous take ─────────────────
  const B = L.shot("product")
  Kit.cut(v, A, B, 3.35, { flash: "#ffffff", strength: 0.65, frames: 3, sound: "hit", gain: -6 })
  const big = L.logo(B.P.mid.el, { size: 150, name: "Tidy", nameSize: 176, gap: 38 })
  const bw = big.el.offsetWidth
  Object.assign(big.el.style, { left: `${CX - bw / 2}px`, top: `${CY - 75}px`, zIndex: "5" }) // above the app it flies into
  L.logoIn(big, 3.38)
  Kit.leak(v, 3.4, { dur: 1.4 })
  const tag = L.title(B.P.mid.el, "^One calm list for every task.^", { x: CX, y: CY + 130, size: 60, w: 1400, align: "center" })
  L.reveal(tag, 3.85, { each: 0.05 })
  Kit.unreveal(v, tag, 4.7, { by: "words", each: 0.02 })

  // the app rises; the big logo lands in its top bar (a match cut)
  const app = L.app(B.P.mid.el, { x: 700, y: 128, w: 1120, h: 836, name: "Tidy", search: "Search tasks", at: 4.95, nav: [["home", "Home"], ["inbox", "Inbox", 4], ["grid", "Projects"], ["chart", "Reports"], ["users", "Team"], ["settings", "Settings"]] })
  L.flyTo(big.mark, app.logo.mark, 5.15, { dur: 0.85 })
  L.flyTo(big.name, app.top.querySelector(".c-app-name"), 5.19, { dur: 0.85 })
  L.heading(app.body, "This week", { x: 34, y: 30, sub: "6 tasks · 1 due today" })
  L.tabs(app.body, ["List", "Board", "Calendar"], { x: 300, y: 40 })
  const plan = L.button(app.body, "Auto-plan", { primary: true, icon: "spark" })
  plan.style.left = `${app.box.w - 34 - plan.offsetWidth}px`
  plan.style.top = "38px"
  const tw = app.box.w - 68
  const T = L.tasks(app.body, { x: 34, y: 132, w: tw, rows: TASKS, at: 5.45, each: 0.07, sortAt: 7.75, sortBy: "d", desc: false })

  L.eyebrow(B.P.mid.el, "Plan", { x: safe.x, y: 358, at: 5.85 })
  const t2 = L.title(B.P.mid.el, "Plan the week|^in one click.^", { x: safe.x, y: 424, size: 88, w: 560 })
  L.reveal(t2, 5.95)
  L.text(B.P.mid.el, "Tidy puts what is due first, so you start in the right place.", { x: safe.x, y: 634, w: 500, size: 27, at: 6.5 })

  const cur = L.cursor(B.P.fg.g)
  const pb = Kit.box(plan, v.stage)
  const px = pb.x + pb.w * 0.55
  const py = pb.y + pb.h * 0.6
  cur.glide(6.85, [1500, 1060], [px, py], 0.75)
  cur.click(7.6, px, py)
  L.press(plan, 7.6)
  Kit.sheen(v, plan, 7.62, { dur: 0.7 })
  cur.leave(8.3, [1760, 1000])
  const top = T.order[0]
  T.light(top, 8.35)
  T.tick(T.order[1], 8.9)
  L.toast(app.body, "Week planned: 6 tasks in order", { x: 34, y: 640, at: 8.55, out: 9.55 })
  // the camera: settle on the logo, then lean in toward the table while it sorts
  B.P.move(3.35, 2.2, { zoom: 1.0 }, { from: { zoom: 1.08 }, ease: "power2.out" })
  B.P.move(5.6, 4.3, B.P.aim(420, 560, 1.06), { ease: "power1.inOut" })

  // ── 3 · the assistant (whip pan, 9.9 – 13.9) ──────────────────────────
  const C = L.shot("assistant")
  L.whip(B, C, 9.85)
  const app3 = L.app(C.P.mid.el, { x: 100, y: 128, w: 1180, h: 836, name: "Tidy", search: "Search tasks", active: 1, nav: [["home", "Home"], ["inbox", "Inbox", 4], ["grid", "Projects"], ["chart", "Reports"], ["users", "Team"], ["settings", "Settings"]] })
  L.heading(app3.body, "Today", { x: 30, y: 30, sub: "Sorted by due date" })
  const lw = app3.box.w - 440 - 56
  L.tasks(app3.body, {
    x: 30,
    y: 132,
    w: lw,
    rows: [TASKS[1], TASKS[3], TASKS[4], TASKS[0], TASKS[2]],
    cols: [
      { label: "Task", key: "task", w: lw * 0.7, fmt: (t) => `<span class="c-task"><span class="c-box"></span>${t}</span>` },
      { label: "Due", key: "due", w: lw * 0.3, fmt: (d) => L.chip(d[0], d[1]) },
    ],
  })
  const ai = L.assistant(app3.body, { w: 440, name: "Assistant" })
  Kit.enter(v, ai.el, 10.2, { x: 120, y: 0, dur: 0.8, ease: "rise" })
  ai.ask(10.55, "What should I do first?")
  ai.answer(11.3, "Start with the sign-in bug. Two other tasks wait on it.")
  ai.steps(12.25, [["Fix sign-in bug", "1 h"], ["Review Q3 budget", "45 min"], ["Plan team offsite", "30 min"]])
  L.eyebrow(C.P.mid.el, "Ask", { x: 1372, y: 358, at: 10.3 })
  const t3 = L.title(C.P.mid.el, "Not sure|what is next?|^Just ask.^", { x: 1372, y: 424, size: 74, w: 440 })
  L.reveal(t3, 10.4)
  C.P.drift(9.85, 4.2, { x: -30, zoom: 1.04 })

  // ── 4 · the numbers (dive into the first step, 13.9 – 18.2) ───────────
  const D = L.shot("numbers")
  const step1 = app3.body.querySelector(".c-step")
  const sb = Kit.box(step1, v.stage)
  L.zoomThrough(C, D, 13.75, sb.x + sb.w * 0.3, sb.y + sb.h / 2, { zoom: 7 })
  L.eyebrow(D.P.mid.el, "Sample data", { x: safe.x, y: 84, at: 14.3 })
  const t4 = L.title(D.P.mid.el, "Teams finish *more,* ^every week.^", { x: safe.x, y: 146, size: 74, w: 1500 })
  L.reveal(t4, 14.35)
  L.kpis(
    D.P.mid.el,
    [
      { label: "Tasks done", icon: "check", value: "1,284", sub: "this quarter", delta: "38%", spark: [3, 4, 3.6, 5, 4.8, 6, 7.2] },
      { label: "On time", icon: "clock", value: "96%", sub: "of all due dates", delta: "11%", spark: [6, 6.4, 6.2, 7, 7.4, 7.3, 8] },
      { label: "Hours saved", icon: "bolt", value: "6.5 h", sub: "per person, per week", delta: "2.1 h", spark: [2, 2.6, 3.1, 3, 4.2, 4.6, 5.4] },
    ],
    { x: safe.x, y: 262, w: safe.w, h: 214, gap: 26, at: 14.5 },
  )
  L.chart(D.P.mid.el, {
    x: safe.x,
    y: 504,
    w: safe.w,
    h: 492,
    title: "Tasks done per week",
    note: "Last 12 weeks · dotted line: the year before",
    values: [42, 45, 44, 51, 49, 56, 60, 58, 66, 71, 74, 81],
    compare: [38, 40, 39, 41, 43, 42, 44, 45, 44, 47, 48, 50],
    min: 30,
    max: 90,
    at: 14.9,
    tag: "81 tasks",
    tagLabel: "This week",
    labels: ["Week 1", "Week 4", "Week 8", "Week 12"],
  })
  D.P.move(13.75, 4.5, { zoom: 1, y: -16 }, { from: { zoom: 1.03, y: 10 }, ease: "power2.out" })

  // ── 5 · the end card (wave wipe, 18.2 – 21.5) ──────────────────────────
  const w = L.wipe(17.7)
  const E = L.shot("end")
  Kit.show(v, E.S, w.mid)
  Kit.hide(v, D.S, w.mid)
  L.endCard(E, { name: "Tidy", tagline: "Every task in its place.", cta: "Start free", url: "tidy.example", at: w.mid + 0.15, click: 20.2 })
  E.P.drift(w.mid, 21.5 - w.mid, { x: -20, zoom: 1.04 })
})
