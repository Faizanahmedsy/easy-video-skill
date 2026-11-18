/*
 * A reel in the Bold look (9:16, 13 s, no voice, loops).
 * Opening → three tips → the number → back to the opening picture.
 * Captions are timed by hand (L.words), since there is no voice-over.
 */
Kit.start(window.VIDEO, (v) => {
  const L = Kit.use(v, "bold")
  const { safe } = v
  Kit.finish(v, { grain: 0.05, vignette: 0.18 })

  // The opening picture. Built twice: at 0 s (already in place, so the first
  // frame reads on its own) and again at the end (sliding in), so the loop is seamless.
  const opening = (name, at, land) => {
    const A = L.shot(name, "black")
    L.shapes(A, { seed: 3, at: land ? at - 0.6 : 0, dur: land ? 13 - (at - 0.6) : 2.8, land })
    L.label(A.P.mid.el, "3 small habits", { x: safe.x, y: 420, bg: "white", at: land ? at : undefined })
    const S = L.stack(A.P.mid.el, [{ text: "Save", bg: "lime" }, { text: "an hour", bg: "white" }, { text: "every day", bg: "lime" }], { y: 510, at: land ? at + 0.05 : undefined, max: 330 })
    return { A, S }
  }

  // ── 0 · opening (0 – 2.8) ──
  const O = opening("open", 0, false)
  Kit.show(v, O.A.S, 0)
  O.A.P.move(0.1, 2.6, { zoom: 1.04 }, { from: { zoom: 1 } })

  // a tip shot: label, three blocks, captions
  const tip = (name, ground, n, lines, caption, at) => {
    const T = L.shot(name, ground)
    L.shapes(T, { seed: 10 + n, at, dur: 3 })
    const dark = ground === "black"
    L.label(T.P.mid.el, `Habit 0${n}`, { x: safe.x, y: 420, bg: dark ? "lime" : "black", at: at + 0.05 })
    const S = L.stack(T.P.mid.el, lines, { y: 510, at: at + 0.12, max: 260 })
    L.captions(T.P.fg.el, { words: L.words(caption, at + 0.55, 0.25), y: 510 + S.h + 70, from: at, to: at + 2.6 })
    return { T, S }
  }

  // ── 1 · habit one (panels stack) ──
  const p1 = L.panels(2.25)
  const H1 = tip("one", "lime", 1, [{ text: "Batch", bg: "black" }, { text: "your", bg: "white" }, { text: "email", bg: "black" }], "Check mail twice a day, not all day.", p1.mid)
  Kit.show(v, H1.T.S, p1.mid)
  Kit.hide(v, O.A.S, p1.mid)

  // ── 2 · habit two (push up) ──
  const H2 = tip("two", "white", 2, [{ text: "Say no", bg: "black" }, { text: "to extra", bg: "lime" }, { text: "meetings", bg: "black" }], "Keep the hour for real work.", 5.25)
  L.push(H1.T, H2.T, 4.95)

  // ── 3 · habit three (cut + lime flash) ──
  const H3 = tip("three", "black", 3, [{ text: "Plan", bg: "lime" }, { text: "tomorrow", bg: "white" }, { text: "tonight", bg: "lime" }], "Five minutes tonight saves an hour tomorrow.", 7.5)
  L.cut(H2.T, H3.T, 7.45)

  // ── 4 · the number (zoom through the last block) ──
  const N = L.shot("number", "lime")
  const last = H3.S.blocks[2]
  L.zoomThrough(H3.T, N, 9.85, last.x + last.w * 0.5, last.y + last.h * 0.5)
  L.shapes(N, { seed: 20, at: 10.2, dur: 1.8 })
  L.label(N.P.mid.el, "That adds up to", { x: safe.x, y: 420, bg: "black", at: 10.35 })
  L.count(N.P.mid.el, { y: 490, from: 0, to: 300, at: 10.4, dur: 1.0, color: "black", max: 560 })
  L.stack(N.P.mid.el, [{ text: "minutes back", bg: "black" }, { text: "every week", bg: "white" }], { y: 1100, at: 10.6, max: 190 })

  // ── 5 · back to the opening picture (panels), then hold: loops cleanly ──
  const p2 = L.panels(11.55, { colors: ["#F7F7F2", "#D6FF3D", "#0F0F12"] })
  const O2 = opening("again", p2.mid - 0.02, true)
  Kit.show(v, O2.A.S, p2.mid)
  Kit.hide(v, N.S, p2.mid)
})
