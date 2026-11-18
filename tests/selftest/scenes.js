// Two shots, a masked title with a mark, a count-up, a push and a pop:
// enough to prove the timeline, the camera and the sound cues all work.
Kit.start(window.VIDEO, (v) => {
  const A = Kit.shot(v, "light")
  const B = Kit.shot(v, "dark")
  for (const [s, bg] of [[A.S, "#EDEFF2"], [B.S, "#121318"]]) Object.assign(s.style, { position: "absolute", inset: "0", background: bg })

  Kit.show(v, A.S, 0)
  const t = Kit.title(A.P.mid.el, "Engine *check*", { x: v.safe.x, y: 400, w: 1400, size: 150, color: "#15161A" })
  Kit.reveal(v, t, 0.05, { by: "words" })
  Kit.mark(v, t.em[0], 0.45, { kind: "bar", color: "#2C64F0" })
  A.P.move(0, 0.9, { zoom: 1.03 }, { from: { zoom: 1 } })
  v.sfx("swish", 0.05)

  Kit.push(v, A, B, 0.9, { dir: "left" })
  const n = Kit.h("div", { style: { position: "absolute", left: `${v.safe.x}px`, top: "420px", font: "700 180px/1 sans-serif", color: "#F4F5F7", fontVariantNumeric: "tabular-nums" } }, B.P.mid.el, "0%")
  Kit.count(v, n, 0, 100, 1.25, 0.6, (x) => `${Math.round(x)}%`)
  v.sfx("pop", 1.85)
  Kit.finish(v, { grain: 0.04, vignette: 0.2 })
})
